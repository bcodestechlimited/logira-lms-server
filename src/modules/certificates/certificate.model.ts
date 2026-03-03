import { model, Schema } from "mongoose";
import {
  CertificateModelInterface,
  CertificateModelStatusEnum,
} from "./certificate.interface";

const certificateSchema = new Schema<CertificateModelInterface>(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    course: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    studentName: {
      type: String,
      required: true,
    },
    courseTitle: {
      type: String,
      required: true,
    },
    certificateNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    issuedAt: {
      type: Date,
      required: true,
    },
    pdfUrl: {
      type: String,
      required: true,
    },
    cloudinaryPublicId: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(CertificateModelStatusEnum),
      default: CertificateModelStatusEnum.pending,
    },
    revokedAt: Date,
    revokedReason: String,
  },
  {
    timestamps: true,
  },
);

const CertificateModel = model<CertificateModelInterface>(
  "CertificateModel",
  certificateSchema,
);
export default CertificateModel;
