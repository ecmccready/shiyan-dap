import fs from "node:fs";
import path from "node:path";

const localDir = path.join(process.cwd(), "src/data");

function localPath(key: string) {
  return path.join(localDir, key);
}

export function persistLocalGet<T>(key: string): T | null {
  try {
    const file = localPath(key);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

export function persistLocalPut(key: string, value: unknown) {
  try {
    fs.mkdirSync(localDir, { recursive: true });
    fs.writeFileSync(localPath(key), JSON.stringify(value, null, 2));
    return true;
  } catch {
    return false;
  }
}

export function awsEnabled() {
  return Boolean(process.env.AWS_S3_BUCKET);
}

export async function persistGet<T>(key: string): Promise<T | null> {
  if (awsEnabled()) {
    try {
      const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
      const client = new S3Client({
        region: process.env.AWS_REGION || "eu-north-1",
      });
      const out = await client.send(
        new GetObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET,
          Key: key,
        })
      );
      const text = await out.Body?.transformToString();
      if (text) return JSON.parse(text) as T;
    } catch (error) {
      console.warn("AWS persistGet fallback:", error);
    }
  }
  return persistLocalGet<T>(key);
}

export async function persistPut(key: string, value: unknown) {
  persistLocalPut(key, value);
  if (!awsEnabled()) {
    return { ok: true, backend: "local" as const };
  }

  try {
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = new S3Client({
      region: process.env.AWS_REGION || "eu-north-1",
    });
    await client.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key,
        Body: JSON.stringify(value),
        ContentType: "application/json",
      })
    );
    return { ok: true, backend: "s3" as const };
  } catch (error) {
    console.warn("AWS persistPut fallback:", error);
    return {
      ok: true,
      backend: "local" as const,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}