import autoBind from "auto-bind";
import { UploadService } from "./upload.service";
import { PublicUploadSignatureDTO } from "./upload.schema";
import { Request, Response } from "express";

export class UploadController {
  constructor(private uploadService: UploadService) {
    autoBind(this);
  }

  public async getPublicSignature(req: Request, res: Response) {
    const dto = req.body as PublicUploadSignatureDTO;

    const result = await this.uploadService.createPublicSignature();

    res.status(result.status_code).json(result);
  }
}

export const uploadController = new UploadController(new UploadService());
