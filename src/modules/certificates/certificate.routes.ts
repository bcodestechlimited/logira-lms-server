import { Router } from "express";
import { apiLimiter } from "../../Middlewares/RateLimiter";
import { isLocalAuthenticated } from "../../Middlewares/Auth";
import { certificateController } from "./certificate.controller";

const certificateRouter = Router();

certificateRouter
  .route("/templates")
  .post(
    apiLimiter,
    isLocalAuthenticated,
    certificateController.saveCertificateTemplate,
  )
  .get(
    apiLimiter,
    isLocalAuthenticated,
    certificateController.getActiveCertificateTemplate,
  );

certificateRouter
  .route("/signatures")
  .post(
    apiLimiter,
    isLocalAuthenticated,
    certificateController.saveCertificateSignature,
  )
  .get(
    apiLimiter,
    isLocalAuthenticated,
    certificateController.getCertificateSignature,
  );

export default certificateRouter;
