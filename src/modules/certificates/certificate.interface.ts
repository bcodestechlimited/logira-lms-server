import { Document, Types } from "mongoose";

export enum CertificateModelStatusEnum {
  issued = "issued",
  revoked = "revoked",
  pending = "pending",
}

export interface CertificateModelInterface extends Document {
  student: Types.ObjectId;
  course: Types.ObjectId;
  studentName: string;
  courseTitle: string;
  certificateNumber: string;
  issuedAt: Date;
  pdfUrl: string;
  cloudinaryPublicId: string;
  status: CertificateModelStatusEnum;
  revokedAt: Date;
  revokedReason: string;
  createdAt: Date;
  updatedAt: Date;
}
