import crypto from "crypto";
import { APP_CONFIG } from "../../config/app.config";
import { Signable } from "./upload.interface";

export const randomNonce = () => crypto.randomBytes(12).toString("hex");

export const slugify = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._/-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^[-_.\/]+|[-_.\/]+$/g, "");

export const buildFolder = (userKey: string, entity?: string) => {
  const ns = slugify(APP_CONFIG.UPLOAD_BASE_NAMESPACE);
  const own = encodeURIComponent(slugify(userKey));
  const ent = slugify(entity || APP_CONFIG.UPLOAD_DEFAULT_ENTITY);
  return `${ns}/${ent}/${own}`;
};

export const buildPublicId = (fileBase: string, replace: boolean) => {
  const b = slugify(fileBase);
  if (replace) return b;
  return `${b}-${Date.now()}-${randomNonce()}`;
};

export const signCloudinaryParams = (params: Signable, apiSecret: string) => {
  const toSign = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== "")
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return crypto
    .createHash("sha1")
    .update(toSign + apiSecret)
    .digest("hex");
};

export function cleanPublicId(input: string) {
  return input
    .trim()
    .replace(/\.pdf$/i, "")
    .replace(/\\/g, "/")
    .replace(/[^a-zA-Z0-9/_-]/g, "-")
    .replace(/\/+/g, "/")
    .replace(/^\/|\/$/g, "");
}
