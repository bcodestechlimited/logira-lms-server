import { Router } from "express";
import {
  checkUserRole,
  isAuthenticated,
  isLocalAuthenticated,
} from "../../Middlewares/Auth";
import { couponController, CouponController } from "./coupon.controller";
import { apiLimiter } from "../../Middlewares/RateLimiter";

const couponRouter = Router();

couponRouter
  .route("/")
  .get(
    isLocalAuthenticated,
    checkUserRole(["admin", "superadmin"]),
    couponController.getCoupons,
  );

couponRouter
  .route("/analytics")
  .get(
    isLocalAuthenticated,
    checkUserRole(["admin", "superadmin"]),
    couponController.getCouponAnalytics,
  );

couponRouter
  .route("/issue-coupon")
  .post(isLocalAuthenticated, couponController.sendCouponToUsersForACourse);

couponRouter
  .route("/coupon-checkout")
  .post(apiLimiter, isAuthenticated, couponController.verifyCouponCode);

couponRouter
  .route("/course-checkout")
  .post(apiLimiter, isAuthenticated, couponController.courseCheckout);

export default couponRouter;
