import { StatusCodes } from "http-status-codes";
import CertificateTemplate from "../../models/certificate-template.model";
import { ApiSuccess } from "../../utils/response-handler";
import { ServiceResponse } from "../../utils/service-response";
import CertificateSignature from "./signature.model";

export class CertificateService {
  public issueCertificate = async (args: {
    studentId: string;
    courseId: string;
    studentName: string;
    courseTitle: string;
  }) => {
    // const existing = await CertificateModel.findOne();
  };

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
}

export const certificateService = new CertificateService();
