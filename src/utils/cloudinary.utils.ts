import { v2 as cloudinary, UploadApiErrorResponse } from "cloudinary";
import { APP_CONFIG } from "../config/app.config";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { UploadApiResponse } from "cloudinary";

cloudinary.config({
  cloud_name: APP_CONFIG.CLOUDINARY_NAME,
  api_key: APP_CONFIG.CLOUDINARY_API_KEY,
  api_secret: APP_CONFIG.CLOUDINARY_SECRET,
});

export const moveToSafeTemp = async (file: any) => {
  const ext = path.extname(file.name);
  const safePath = path.join(
    process.cwd(),
    "uploads",
    `${crypto.randomUUID()}${ext}`,
  );

  await fs.mkdir(path.dirname(safePath), { recursive: true });

  await fs.copyFile(file.tempFilePath, safePath);

  await fs.unlink(file.tempFilePath).catch((err) => {
    console.error("Cleanup failed, but file was moved:", err);
  });
  return safePath;
};

export const uploadToCloudinary = async (
  filePath: string,
  options: {
    folderName: string;
    resourceType: "image" | "video" | "raw";
    format?: string;
    overwrite?: boolean;
    public_id?: string;
  },
) => {
  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    cloudinary.uploader.upload_large(
      filePath,
      {
        use_filename: true,
        folder: options.folderName,
        chunk_size: 7_000_000, // >= 5MB recommended
        resource_type: options.resourceType,
        format: options.format,
        overwrite: options.overwrite,
        public_id: options.public_id,
      },
      (err?: UploadApiErrorResponse, res?: UploadApiResponse) => {
        if (err) return reject(err);
        if (!res) return reject(new Error("Cloudinary returned no response"));
        resolve(res);
      },
    );
  });

  return result.secure_url;
};
