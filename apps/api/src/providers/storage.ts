// File storage over the S3 protocol: RustFS locally, Cloudflare R2 later with the same code (D035).
import {
  GetObjectCommand,
  HeadBucketCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import type { Config } from "../config/config.ts";

/** Thrown when a file does not exist, so callers can answer "not found" instead of crashing. */
export class StorageNotFoundError extends Error {
  constructor(key: string) {
    super(`No file stored under "${key}".`);
    this.name = "StorageNotFoundError";
  }
}

function isNotFound(error: unknown): boolean {
  return error instanceof NoSuchKey || (error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404);
}

export function createStorageProvider(config: Config) {
  const client = new S3Client({
    endpoint: `http://${config.STORAGE_HOST}:${String(config.STORAGE_PORT)}`,
    region: config.STORAGE_REGION,
    forcePathStyle: true,
    credentials: { accessKeyId: config.STORAGE_ACCESS_KEY, secretAccessKey: config.STORAGE_SECRET_KEY },
  });
  const Bucket = config.STORAGE_BUCKET;
  return {
    async put(key: string, body: Uint8Array | string, contentType = "application/octet-stream"): Promise<void> {
      await client.send(new PutObjectCommand({ Bucket, Key: key, Body: body, ContentType: contentType }));
    },
    async get(key: string): Promise<Uint8Array> {
      try {
        const result = await client.send(new GetObjectCommand({ Bucket, Key: key }));
        if (!result.Body) throw new StorageNotFoundError(key);
        return await result.Body.transformToByteArray();
      } catch (error) {
        if (isNotFound(error)) throw new StorageNotFoundError(key);
        throw error;
      }
    },
    ping: async () => {
      await client.send(new HeadBucketCommand({ Bucket }));
    },
    close: async () => {
      client.destroy();
    },
  };
}
