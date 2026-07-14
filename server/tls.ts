export function parsePublicHttpsOrigin(value: string): URL {
  const origin = new URL(value);
  if (origin.protocol !== "https:" || origin.pathname !== "/" || origin.search || origin.hash || origin.username || origin.password) {
    throw new Error("PUBLIC_HTTPS_ORIGIN must be an HTTPS origin without path, query, fragment or credentials");
  }
  return origin;
}

export function buildHttpsRedirect(publicOrigin: URL, requestUrl: string | undefined): string {
  const requestTarget = new URL(requestUrl || "/", "http://invalid.local");
  return new URL(`${requestTarget.pathname}${requestTarget.search}`, publicOrigin).toString();
}
