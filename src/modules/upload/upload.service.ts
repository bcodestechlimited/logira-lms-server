import autoBind from "auto-bind";
import {
  buildFolder,
  buildPublicId,
  cleanPublicId,
  randomNonce,
  signCloudinaryParams,
} from "./upload.helpers";
import { ApiSuccess } from "../../utils/response-handler";
import { APP_CONFIG } from "../../config/app.config";
import cloudinary from "../../config/cloudinary.config";

export class UploadService {
  constructor() {
    autoBind(this);
  }

  public async createSignature({
    userKey,
    fileBase,
    entity,
    replace = false,
    resource_type = "auto",
    type = "upload",
  }: {
    userKey: string;
    fileBase: string;
    entity?: string;
    replace?: boolean;
    resource_type?: "auto" | "image" | "raw" | "video";
    type?: "upload" | "private" | "authenticated";
  }) {
    const folder = buildFolder(userKey, entity);
    const public_id = buildPublicId(fileBase, replace);
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = randomNonce();
    const context = `nonce=${nonce}`;
    const overwrite = !!replace;

    const paramsToSign = {
      timestamp,
      folder,
      public_id,
      context,
    };

    const signature = signCloudinaryParams(
      paramsToSign,
      APP_CONFIG.CLOUDINARY_SECRET,
    );

    return ApiSuccess.ok("Upload signature created successfully", {
      cloudName: APP_CONFIG.CLOUDINARY_NAME,
      apiKey: APP_CONFIG.CLOUDINARY_API_KEY,
      signature,
      timestamp,
      folder,
      public_id,
      overwrite,
      context,
    });
  }

  public async createPublicSignature() {
    const folder = "guest_uploads/quarantine";
    const public_id = `${randomNonce()}`;
    const timestamp = Math.floor(Date.now() / 1000);
    const tags = "guest,unverified";
    const context = `source=public_api`;
    const upload_preset = "logira";

    const paramsToSign = {
      timestamp,
      folder,
      public_id,
      tags,
      context,
      upload_preset,
    };

    const signature = signCloudinaryParams(
      paramsToSign,
      APP_CONFIG.CLOUDINARY_SECRET,
    );

    return ApiSuccess.ok("Public upload signature created", {
      cloudName: APP_CONFIG.CLOUDINARY_NAME,
      apiKey: APP_CONFIG.CLOUDINARY_API_KEY,
      signature,
      timestamp,
      folder,
      public_id,
      tags,
      context,
      upload_preset,
    });
  }

  uploadPdfBufferToCloudinary = async (args: {
    pdfBuffer: Buffer;
    folder: string;
    publicId: string;
  }) => {
    return new Promise<{ publicId: string; url: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: "raw",
          folder: args.folder,
          public_id: cleanPublicId(args.publicId),
          format: "pdf",
        },
        (err, result) => {
          console.log("err", err);
          if (err || !result) return reject(err);
          resolve({ publicId: result.public_id, url: result.secure_url });
        },
      );

      stream.end(args.pdfBuffer);
    });
  };
}

export const uploadService = new UploadService();
