import { model, Schema } from "mongoose";

export interface ICertificateCounter extends Document {
  year: number;
  seq: number;
  createdAt: Date;
  updatedAt: Date;
}

const CertificateCounterSchema = new Schema<ICertificateCounter>(
  {
    year: { type: Number, required: true, unique: true, index: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

const CertificateCounter = model<ICertificateCounter>(
  "CertificateCounter",
  CertificateCounterSchema,
);

export default CertificateCounter;
