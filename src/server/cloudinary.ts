import { v2 as cloudinary } from "cloudinary";

const cloud_name = process.env.CLOUD_NAME ?? "";
const api_key = process.env.CLOUD_KEY ?? "";
const api_secret = process.env.CLOUD_SECRET ?? "";

if (cloud_name && api_key && api_secret) {
  cloudinary.config({ cloud_name, api_key, api_secret });
}

export { cloudinary };
