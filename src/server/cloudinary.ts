import { v2 as cloudinary } from "cloudinary";

const cloud_name = process.env.CLOUD_NAME ?? "";
const api_key = process.env.CLOUD_KEY ?? "";
const api_secret = process.env.CLOUD_SECRET ?? "";

if (cloud_name && api_key && api_secret) {
  cloudinary.config({ cloud_name, api_key, api_secret });
}

export function isCloudinaryConfigured(): boolean {
  return Boolean(cloud_name && api_key && api_secret);
}

export async function uploadImageToCloudinary(
  buffer: Buffer,
  mimetype: string
): Promise<string> {
  const b64 = buffer.toString("base64");
  const dataUri = `data:${mimetype || "application/octet-stream"};base64,${b64}`;
  const result = await cloudinary.uploader.upload(dataUri, {
    folder: "telegram-miniapp",
  });
  return result.secure_url;
}

export { cloudinary };
