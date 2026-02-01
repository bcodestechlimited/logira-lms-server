import Router from "express";
import { uploadController } from "./upload.controller";

const uploadRouter = Router();

uploadRouter
  .route("/public/signature")
  .post(uploadController.getPublicSignature);

export default uploadRouter;
