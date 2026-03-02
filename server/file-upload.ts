import { Storage } from "@google-cloud/storage";

const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;

function getStorage() {
  return new Storage({ apiEndpoint: "https://storage.googleapis.com" });
}

export async function uploadFile(
  buffer: Buffer,
  fileName: string,
  contentType: string
): Promise<string> {
  if (!bucketId) throw new Error("Object storage not configured");

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

export async function deleteFile(publicUrl: string): Promise<void> {
  if (!bucketId) return;
  try {
    const storage = getStorage();
    const bucket = storage.bucket(bucketId);
    const match = publicUrl.match(/\/progress-images\/(.+)$/);
    if (!match) return;
    const filePath = `public/progress-images/${match[1]}`;
    await bucket.file(filePath).delete();
  } catch {}
}
