import { Router } from "express";
import {
  checkUserRole,
  isAuthenticated,
  isLocalAuthenticated,
} from "../../Middlewares/Auth";
import { apiLimiter } from "../../Middlewares/RateLimiter";
import { couponController } from "./coupon.controller";

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
  .post(
    isLocalAuthenticated,
    apiLimiter,
    checkUserRole(["admin", "superadmin"]),
    couponController.sendCouponToUsersForACourse,
  );

couponRouter
  .route("/coupon-checkout")
  .post(apiLimiter, isAuthenticated, couponController.verifyCouponCode);

couponRouter
  .route("/course-checkout")
  .post(apiLimiter, isAuthenticated, couponController.courseCheckout);

couponRouter
  .route("/:id/extend-expiration")
  .patch(
    isLocalAuthenticated,
    checkUserRole(["admin", "superadmin"]),
    couponController.updateCouponExpiration,
  );

export default couponRouter;
