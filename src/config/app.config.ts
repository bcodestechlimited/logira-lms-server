import "dotenv/config";

const purifyConfig = {
  ALLOWED_TAGS: [
    "p",
    "br",
    "strong",
    "em",
    "u",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "ul",
    "ol",
    "li",
    "blockquote",
    "a",
    "img",
  ],
  ALLOWED_ATTR: ["href", "src", "alt", "style"],
  ALLOWED_STYLES: [
    "color",
    "background-color",
    "font-size",
    "text-align",
    "margin",
    "padding",
    "font-weight",
  ],
};

const APP_CONFIG = Object.freeze({
  CORS_ORIGIN:
    process.env.CORS_ORIGIN ||
    "http://localhost:3000,http://localhost:5173,http://localhost:5174",
  SMTP_FROM_ADDRESS: process.env.SMTP_FROM_ADDRESS || "<support@logiralms.com>",
  SMTP_HOST: process.env.SMTP_HOST || "smtp.example.com",
  SMTP_PORT: process.env.SMTP_PORT || 587,
  SMTP_SECURE: process.env.SMTP_SECURE === "true",
  SMTP_EMAIL: process.env.SMTP_EMAIL || "user@example.com",
  SMTP_PASSWORD: process.env.SMTP_PASSWORD || "password",
  EMAIL_ACTIVATION_SECRET: process.env.EMAIL_ACTIVATION_SECRET || "",
  BASE_URL: process.env.BASE_URL || "",
  ACCESS_TOKEN_SECRET:
    process.env.ACCESS_TOKEN_SECRET || "my-super-secret-ics-@-academy",
  MONGO_URI: process.env.MONGO_URI || "",
  NODE_ENV: process.env.NODE_ENV || "development",
  CLOUDINARY_NAME: process.env.CLOUDINARY_NAME || "",
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_KEY || "",
  CLOUDINARY_SECRET: process.env.CLOUDINARY_SECRET || "",
  PURIFY_CONFIG: purifyConfig,
  CLIENT_FRONTEND_BASE_URL: process.env.CLIENT_FRONTEND_BASE_URL,
  ADMIN_FRONTEND_BASE_URL: process.env.ADMIN_FRONTEND_BASE_URL,
  SUPPORT_EMAIL: process.env.SUPPORT_EMAIL,
  COMPANY_NAME: process.env.COMPANY_NAME || "Logira LMS",
  LOGO_URL: process.env.LOGO_URL,
  UPLOAD_BASE_NAMESPACE: process.env.UPLOAD_BASE_NAMESPACE || "uploads",
  UPLOAD_DEFAULT_ENTITY: process.env.UPLOAD_DEFAULT_ENTITY || "default",
} as const);

export { APP_CONFIG };
