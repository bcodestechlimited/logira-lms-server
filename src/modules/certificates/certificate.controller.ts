import { Request, Response } from "express";
import { certificateService, CertificateService } from "./certificate.service";

export class CertificateController {
  constructor(private certificateService: CertificateService) {}

  public saveCertificateTemplate = async (req: Request, res: Response) => {
    const dto = req.body as { publicId: string; url: string };
    const result = await this.certificateService.saveCertificateTemplate(dto);
    res.status(200).json({
      message: "Active certificate template retrieved successfully",
      data: result,
    });
  };

  public saveCertificateSignature = async (req: Request, res: Response) => {
    const dto = req.body as { publicId: string; url: string };
    const result = await this.certificateService.saveCertificateSignature(dto);
    res.status(200).json({
      message: "Active certificate template retrieved successfully",
      data: result,
    });
  };

  public getActiveCertificateTemplate = async (req: Request, res: Response) => {
    const result = await this.certificateService.getCertificateTemplate();
    res.status(200).json({
      message: "Active certificate template retrieved successfully",
      data: result,
    });
  };

  public getCertificateSignature = async (req: Request, res: Response) => {
    const result = await this.certificateService.getCertificateSignature();
    res.status(200).json({
      message: "Active certificate signature retrieved successfully",
      data: result,
    });
  };
}

export const certificateController = new CertificateController(
  certificateService,
);
