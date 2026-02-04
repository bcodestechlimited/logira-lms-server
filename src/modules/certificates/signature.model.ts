import { Document, model, Schema } from "mongoose";

export interface CertificateSignatureInterface extends Document {
  publicId: string;
  name: string;
  url: string;
  uploadedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const certificateSignatureSchema = new Schema<CertificateSignatureInterface>(
  {
    publicId: { type: String, required: true, unique: true },
    url: { type: String, required: true },
    uploadedAt: { type: Date, default: () => new Date() },
  },
  {
    timestamps: true,
  },
);

const CertificateSignature = model<CertificateSignatureInterface>(
  "CertificateSignature",
  certificateSignatureSchema,
);

export default CertificateSignature;
