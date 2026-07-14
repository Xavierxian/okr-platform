import express from "express";
import type { Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { deleteExpiredAuditLogs, seedDatabase } from "./storage";
import * as fs from "fs";
import * as path from "path";
import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { X509Certificate } from "node:crypto";
import helmet from "helmet";
import { requestIdMiddleware } from "./security";
import { buildHttpsRedirect, parsePublicHttpsOrigin } from "./tls";

const runtimeMode = (process.env.NODE_ENV || "development").trim();
if (runtimeMode !== "development" && runtimeMode !== "production") {
  throw new Error("NODE_ENV must be either development or production");
}

const app = express();
const log = console.log;

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

function setupCors(app: express.Application) {
  app.use((req, res, next) => {
    const origins = new Set<string>();

    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }

    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d: string) => {
        origins.add(`https://${d.trim()}`);
      });
    }

    if (process.env.PUBLIC_HTTPS_ORIGIN) {
      origins.add(process.env.PUBLIC_HTTPS_ORIGIN.replace(/\/$/, ""));
    }

    const origin = req.header("origin");

    // Allow localhost origins for Expo web development (any port)
    const isLocalhost =
      origin?.startsWith("http://localhost:") ||
      origin?.startsWith("http://127.0.0.1:");

    const isAllowed = !origin || origins.has(origin) || (process.env.NODE_ENV !== "production" && isLocalhost);
    if (!isAllowed) return res.status(403).json({ message: "请求来源不受信任" });

    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS",
      );
      res.header("Access-Control-Allow-Headers", "Content-Type, X-CSRF-Token, X-Request-Id");
      res.header("Access-Control-Allow-Credentials", "true");
    }

    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }

    next();
  });
}

function setupBodyParsing(app: express.Application) {
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use(express.urlencoded({ extended: false }));
}

function setupRequestLogging(app: express.Application) {
  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    res.on("finish", () => {
      if (!path.startsWith("/api")) return;

      const duration = Date.now() - start;
      log(JSON.stringify({
        level: "info",
        event: "http_request",
        requestId: req.requestId,
        method: req.method,
        path,
        statusCode: res.statusCode,
        durationMs: duration,
      }));
    });

    next();
  });
}

function setupSecurityHeaders(app: express.Application) {
  const isProd = process.env.NODE_ENV === "production";
  app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'", "https:", "wss:"],
        fontSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        // HTTP is supported only for development and internal testing.
        "upgrade-insecure-requests": isProd ? [] : null,
      },
    },
    hsts: isProd ? { maxAge: 31536000, includeSubDomains: true } : false,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  }));
  app.use("/api/auth", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use("/api/admin", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
}

function getAppName(): string {
  try {
    const appJsonPath = path.resolve(process.cwd(), "app.json");
    const appJsonContent = fs.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}

function serveExpoManifest(platform: string, res: Response) {
  const manifestPath = path.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json",
  );

  if (!fs.existsSync(manifestPath)) {
    return res
      .status(404)
      .json({ error: `Manifest not found for platform: ${platform}` });
  }

  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");

  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.send(manifest);
}

function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName,
}: {
  req: Request;
  res: Response;
  landingPageTemplate: string;
  appName: string;
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;

  log(`baseUrl`, baseUrl);
  log(`expsUrl`, expsUrl);

  const html = landingPageTemplate
    .replace(/BASE_URL_PLACEHOLDER/g, baseUrl)
    .replace(/EXPS_URL_PLACEHOLDER/g, expsUrl)
    .replace(/APP_NAME_PLACEHOLDER/g, appName);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}

function configureExpoAndLanding(app: express.Application) {
  const templatePath = path.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html",
  );
  const landingPageTemplate = fs.readFileSync(templatePath, "utf-8");
  const appName = getAppName();

  const webBuildDir = path.resolve(process.cwd(), "static-build", "web");
  const webBuildExists = fs.existsSync(path.join(webBuildDir, "index.html"));

  log("Serving static Expo files with dynamic manifest routing");
  log(`Web build available: ${webBuildExists}`);

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api")) {
      return next();
    }

    if (req.path === "/" || req.path === "/manifest") {
      const platform = req.header("expo-platform");
      if (platform && (platform === "ios" || platform === "android")) {
        return serveExpoManifest(platform, res);
      }
    }

    if (webBuildExists) {
      return next();
    }

    if (req.path === "/") {
      return serveLandingPage({
        req,
        res,
        landingPageTemplate,
        appName,
      });
    }

    next();
  });

  app.use("/assets", express.static(path.resolve(process.cwd(), "assets")));
  app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

  if (webBuildExists) {
    app.use(express.static(webBuildDir));
    app.get("/{*splat}", (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith("/api")) return next();
      const platform = req.header("expo-platform");
      if (platform) return next();
      const indexPath = path.join(webBuildDir, "index.html");
      if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
      }
      next();
    });
    log("Serving Expo Web build from static-build/web");
  }

  app.use(express.static(path.resolve(process.cwd(), "static-build")));

  log("Expo routing: Checking expo-platform header on / and /manifest");
}

function setupErrorHandler(app: express.Application) {
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    const error = err as {
      status?: number;
      statusCode?: number;
      message?: string;
    };

    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });
}

(async () => {
  app.get("/healthz", (_req, res) => res.status(200).send("ok"));

  app.use(requestIdMiddleware);
  setupSecurityHeaders(app);
  setupCors(app);
  setupBodyParsing(app);
  setupRequestLogging(app);

  configureExpoAndLanding(app);

  await registerRoutes(app);

  await seedDatabase();

  setupErrorHandler(app);

  const cleanupTimer = setInterval(() => {
    deleteExpiredAuditLogs(180).catch((error) => console.error("Audit retention cleanup failed:", error));
  }, 24 * 60 * 60 * 1000);
  (cleanupTimer as unknown as NodeJS.Timeout).unref();

  const isProd = process.env.NODE_ENV === "production";
  if (!isProd) {
    const port = parseInt(process.env.PORT || "5000", 10);
    createHttpServer(app).listen({ port, host: "0.0.0.0" }, () => {
      log(`development HTTP server listening on port ${port}`);
    });
    return;
  }

  const certPath = process.env.HTTPS_CERT_PATH;
  const keyPath = process.env.HTTPS_KEY_PATH;
  const publicOrigin = process.env.PUBLIC_HTTPS_ORIGIN;
  if (!certPath || !keyPath || !publicOrigin) {
    throw new Error("HTTPS_CERT_PATH, HTTPS_KEY_PATH and PUBLIC_HTTPS_ORIGIN are required in production");
  }
  const parsedOrigin = parsePublicHttpsOrigin(publicOrigin);
  if (process.platform !== "win32" && (fs.statSync(keyPath).mode & 0o077) !== 0) {
    throw new Error("HTTPS private key must not be readable by group or other users");
  }
  const cert = fs.readFileSync(certPath, "utf8");
  const key = fs.readFileSync(keyPath, "utf8");
  const certificate = new X509Certificate(cert);
  const expiresInDays = Math.floor((Date.parse(certificate.validTo) - Date.now()) / (24 * 60 * 60 * 1000));
  if (expiresInDays <= 0) throw new Error("HTTPS certificate is expired");
  if (expiresInDays < 30) console.warn(`HTTPS certificate expires in ${expiresInDays} days`);

  const httpsPort = parseInt(process.env.HTTPS_PORT || "5000", 10);
  const httpPort = parseInt(process.env.HTTP_PORT || "5001", 10);
  createHttpsServer({ cert, key, minVersion: "TLSv1.2" }, app)
    .listen({ port: httpsPort, host: "0.0.0.0" }, () => {
      log(`production HTTPS server listening on port ${httpsPort}`);
    });

  createHttpServer((req, res) => {
    const target = buildHttpsRedirect(parsedOrigin, req.url);
    res.writeHead(308, { Location: target, "Cache-Control": "no-store" });
    res.end();
  }).listen({ port: httpPort, host: "0.0.0.0" }, () => {
    log(`HTTP redirect server listening on port ${httpPort}`);
  });
})();
