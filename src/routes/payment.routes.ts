import { Router } from "express";
import { isAuthenticated } from "../Middlewares/Auth";
import paymentController from "../controllers/payment.controller";
import { apiLimiter } from "../Middlewares/RateLimiter";

const router = Router();

router.post(
  "/course-checkout",
  apiLimiter,
  isAuthenticated,
  paymentController.courseCheckout,
);

export default router;
