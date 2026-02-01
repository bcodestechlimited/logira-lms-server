import { Router } from "express";
import { couponController } from "../controllers/coupon.controller";
import {
  checkUserRole,
  isAuthenticated,
  isLocalAuthenticated,
} from "../Middlewares/Auth";
import { apiLimiter } from "../Middlewares/RateLimiter";
import validateRequest from "../Middlewares/validation.middleware";
import {
  CouponCheckoutSchema,
  CreateCouponSchema,
} from "../Schema/coupon.schema";

const router = Router();

router
  .route("/apply-coupon")
  .post(
    apiLimiter,
    isLocalAuthenticated,
    checkUserRole(["admin", "superadmin"]),
    couponController.applyCoupon,
  );

router
  .route("/analytics")
  .get(
    apiLimiter,
    isLocalAuthenticated,
    checkUserRole(["admin", "superadmin"]),
    couponController.getCouponAnalytics,
  );

router
  .route("/edit-coupon")
  .put(
    apiLimiter,
    isLocalAuthenticated,
    checkUserRole(["admin", "superadmin"]),
    couponController.editCoupon,
  );

// test: api
router.post(
  "/coupon-checkout",
  apiLimiter,
  isAuthenticated,
  validateRequest(CouponCheckoutSchema),
  couponController.couponCheckout,
);

// TODO: UPDTE COUPON STATUS
router
  .route("/update-status")
  .patch(
    apiLimiter,
    isLocalAuthenticated,
    checkUserRole(["admin", "superadmin"]),
    couponController.updateCouponStatus,
  );

router
  .route("/")
  .post(
    apiLimiter,
    validateRequest(CreateCouponSchema),
    isLocalAuthenticated,
    checkUserRole(["admin", "superadmin"]),
    couponController.createCoupon,
  )
  .get(
    apiLimiter,
    isLocalAuthenticated,
    checkUserRole(["admin", "superadmin"]),
    couponController.getCoupons,
  );

router
  .route("/:id/users")
  .get(
    apiLimiter,
    isLocalAuthenticated,
    checkUserRole(["admin", "superadmin"]),
    couponController.getCouponUsers,
  );

router
  .route("/:id/hard-delete")
  .delete(
    apiLimiter,
    isLocalAuthenticated,
    checkUserRole(["admin", "superadmin"]),
    couponController.deleteCoupon,
  );

router
  .route("/:id")
  .get(
    apiLimiter,
    isLocalAuthenticated,
    checkUserRole(["admin", "superadmin"]),
    couponController.getACouponById,
  )
  .delete(
    apiLimiter,
    isLocalAuthenticated,
    checkUserRole(["admin", "superadmin"]),
    couponController.softDeleteCoupon,
  );

export default router;
