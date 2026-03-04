import { Storage } from "@google-cloud/storage";
import * as fs from "fs";
import * as path from "path";

const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;

function getStorage() {
  return new Storage({ apiEndpoint: "https://storage.googleapis.com" });
}

const LOCAL_UPLOAD_DIR = path.resolve(process.cwd(), "assets", "uploads");

function ensureLocalDir() {
  if (!fs.existsSync(LOCAL_UPLOAD_DIR)) {
    fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
  }
}

export async function uploadFile(
  buffer: Buffer,
  fileName: string,
  contentType: string
): Promise<string> {
  if (bucketId) {
    const storage = getStorage();
    const bucket = storage.bucket(bucketId);
    const filePath = `public/progress-images/${fileName}`;
    const file = bucket.file(filePath);

    await file.save(buffer, {
      contentType,
      metadata: { cacheControl: "public, max-age=31536000" },
    });

    await file.makePublic();
    return file.publicUrl();
  }

  ensureLocalDir();
  const localPath = path.join(LOCAL_UPLOAD_DIR, fileName);
  fs.writeFileSync(localPath, buffer);
  return `/assets/uploads/${fileName}`;
}

export async function deleteFile(publicUrl: string): Promise<void> {
  const match = publicUrl.match(/\/(?:uploads|progress-images)\/([^/]+)$/);
  if (!match) return;

  if (bucketId) {
    try {
      const storage = getStorage();
      const bucket = storage.bucket(bucketId);
      const filePath = `public/progress-images/${match[1]}`;
      await bucket.file(filePath).delete();
    } catch {}
  } else {
    try {
      const localPath = path.join(LOCAL_UPLOAD_DIR, match[1]);
      if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
    } catch {}
  }
}
