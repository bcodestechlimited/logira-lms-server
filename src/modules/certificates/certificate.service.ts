import { StatusCodes } from "http-status-codes";
import CertificateTemplate from "../../models/certificate-template.model";
import { ApiSuccess } from "../../utils/response-handler";
import { ServiceResponse } from "../../utils/service-response";
import CertificateSignature from "./signature.model";
import { renderCertificatePdf } from "./certificate.renderer";
import { downloadBytes } from "./certificate.utils";
import { generateCertificateNumber } from "./certificate.helper";
import Course from "../../models/Course";
import Progress, { CourseStatusEnum } from "../../models/progress.model";
import mongoose from "mongoose";
import CertificateModel from "./certificate.model";
import { uploadService } from "../upload/upload.service";
import { emailService } from "../../Services/mail.service";

export class CertificateService {
  public saveCertificateTemplate = async (dto) => {
    await CertificateTemplate.deleteMany();
    const certificateTemplate = await CertificateTemplate.create({
      publicId: dto.publicId,
      url: dto.url,
    });

    if (!certificateTemplate) {
      return ServiceResponse.failure(
        "Failed to save certificate template",
        null,
        StatusCodes.BAD_REQUEST,
      );
    }

    return ApiSuccess.created("Certificate template saved successfully", {
      data: certificateTemplate,
    });
  };

  public saveCertificateSignature = async (dto) => {
    await CertificateSignature.deleteMany();
    const certificateSignature = await CertificateSignature.create({
      publicId: dto.publicId,
      url: dto.url,
    });

    if (!certificateSignature) {
      return ServiceResponse.failure(
        "Failed to save certificate signature",
        null,
        StatusCodes.BAD_REQUEST,
      );
    }

    return ApiSuccess.created("Certificate signature saved successfully", {
      data: certificateSignature,
    });
  };

  public getCertificateSignature = async () => {
    const certificateSignature = await CertificateSignature.findOne();

    if (!certificateSignature) {
      return ServiceResponse.failure(
        "Certificate signature not found",
        null,
        StatusCodes.NOT_FOUND,
      );
    }

    return ApiSuccess.ok("Certificate signature retrieved successfully", {
      data: certificateSignature,
    });
  };

  public getCertificateTemplate = async () => {
    const certificateTemplate = await CertificateTemplate.findOne();

    if (!certificateTemplate) {
      return ServiceResponse.failure(
        "Certificate template not found",
        null,
        StatusCodes.NOT_FOUND,
      );
    }

    return ApiSuccess.ok("Certificate template retrieved successfully", {
      data: certificateTemplate,
    });
  };

  public issueCertificate = async (
    userId: string,
    courseId: string,
    opts?: { session?: mongoose.ClientSession },
  ) => {
    const session = opts?.session;

    // 1) Idempotency: if already issued, return existing
    const existing = await CertificateModel.findOne({
      userId,
      courseId,
    }).session(session || null);
    if (existing) {
      return ServiceResponse.success(
        "Certificate already issued",
        { data: existing },
        StatusCodes.OK,
      );
    }

    // 2) Validate eligibility from Progress
    const progress = await Progress.findOne({ user: userId, course: courseId })
      .populate("user", "firstName lastName email")
      .populate("course", "title")
      .session(session || null)
      .lean();

    if (!progress) {
      return ServiceResponse.failure(
        "No progress found",
        null,
        StatusCodes.NOT_FOUND,
      );
    }

    if (progress.status !== CourseStatusEnum.COMPLETED) {
      return ServiceResponse.failure(
        "Course not completed",
        null,
        StatusCodes.BAD_REQUEST,
      );
    }

    // 3) Fetch course + user info needed for rendering
    const course = await Course.findById(courseId)
      .session(session || null)
      .lean();

    if (!course) {
      return ServiceResponse.failure(
        "Course not found",
        null,
        StatusCodes.NOT_FOUND,
      );
    }

    // You likely have User model; adapt this to how you store user details
    // For now assume progress contains user name snapshot or you fetch User model.
    // Replace this with your real user lookup:
    const studentName =
      (progress as any)?.user.firstName +
      " " +
      (progress as any)?.user.lastName;
    const courseTitle = (course as any)?.title || "Course Title";

    // 4) Get latest template/signature from DB
    // If you only store one record, just do findOne sort by createdAt desc
    const template = await CertificateTemplate.findOne({})
      .sort({ createdAt: -1 })
      .session(session || null)
      .lean();

    if (!template) {
      return ServiceResponse.failure(
        "No certificate template found",
        null,
        StatusCodes.NOT_FOUND,
      );
    }

    const signature = await CertificateSignature.findOne({})
      .sort({ createdAt: -1 })
      .session(session || null)
      .lean();

    if (!signature) {
      return ServiceResponse.failure(
        "No certificate signature found",
        null,
        StatusCodes.NOT_FOUND,
      );
    }

    // 5) Generate unique certificate number
    const issuedAt = new Date();
    const certificateNumber = await generateCertificateNumber(issuedAt);

    // 6) Download template PDF bytes + signature PNG bytes
    const templateBytes = await downloadBytes(template.url);
    const signatureBytes = await downloadBytes(signature.url);

    // 7) Render PDF (pdf-lib)
    const pdfBuffer = await renderCertificatePdf(
      {
        studentName: studentName.toUpperCase(),
        courseTitle: courseTitle.toUpperCase(),
        issuedOn: issuedAt,
        certificateNumber,
        signaturePngBytes: signatureBytes,
      },
      {
        templatePdfBytes: templateBytes,
      },
    );

    // 8) Upload generated PDF to Cloudinary
    const upload = await uploadService.uploadPdfBufferToCloudinary({
      pdfBuffer,
      folder: "lms-certificates/issued",
      publicId: certificateNumber,
    });

    // 9) Save Certificate record (must be in same session if provided)
    const created = await CertificateModel.create(
      [
        {
          student: userId,
          course: courseId,
          studentName,
          courseTitle,
          certificateNumber,
          issuedAt,
          pdfUrl: upload.url,
          cloudinaryPublicId: template.publicId,
          signaturePublicId: (signature as any).publicId,
          signatureUrl: signature.url,
        },
      ],
      session ? { session } : undefined,
    );

    // Send email notification to the student
    const emailPayload = {
      subject: `Certificate of completion - ${courseTitle.toUpperCase()}`,
      template: "certificate",
      to: (progress as any).user.email,
      variables: {
        userName: studentName.toLocaleUpperCase(),
        courseTitle: courseTitle.toUpperCase(),
        issueDate: issuedAt.toDateString(),
        certificateUrl: upload.url,
      },
    };
    await emailService.sendEmailTemplate(emailPayload);

    return ServiceResponse.success(
      "Certificate issued successfully",
      { data: created[0] },
      StatusCodes.CREATED,
    );
  };
}

export const certificateService = new CertificateService();
