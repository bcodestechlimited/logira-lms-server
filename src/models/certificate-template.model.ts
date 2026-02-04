import { Document, Schema, model } from "mongoose";

export interface ICertificateTemplate extends Document {
  publicId: string;
  url: string;
  uploadedAt: Date;
  updatedAt: Date;
  createdAt: Date;
}

const CertificateTemplateSchema = new Schema<ICertificateTemplate>(
  {
    publicId: { type: String, required: true, unique: true },
    url: { type: String, required: true },
    uploadedAt: { type: Date, default: () => new Date() },
  },
  {
    timestamps: true,
  },
);

const CertificateTemplate = model<ICertificateTemplate>(
  "CertificateTemplate",
  CertificateTemplateSchema,
);

export default CertificateTemplate;
