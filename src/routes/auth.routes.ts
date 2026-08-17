import { Router } from "express";
import { authController } from "../controllers/auth.controller.ts";
import { userController } from "../controllers/user.controller.ts";
import {
  checkUserRole,
  isAuthenticated,
  isLocalAuthenticated,
  validateUser,
} from "../Middlewares/Auth.ts";
import { apiLimiter } from "../Middlewares/RateLimiter.ts";
import validateRequest from "../Middlewares/validation.middleware.ts";
import {
  OnboardStaffSchema,
  RegisterSchema,
  ResetPasswordSchema,
  UpdatePasswordSchema,
  UserRequestForCourseExtensionSchema,
} from "../Schema/auth.schema.ts";

const router = Router();
router
  .route("/")
  .get(isAuthenticated, authController.getSession)
  .post(validateRequest(RegisterSchema), authController.register);

router.get(
  "/user-analytics",
  isLocalAuthenticated,
  checkUserRole(["admin", "superadmin"]),
  userController.getUserAnalytics,
);

router
  .route("/students")
  .get(apiLimiter, isLocalAuthenticated, userController.getAllUsers);

router.post("/activate-account", apiLimiter, authController.activateAccount);

router.get("/me", isAuthenticated, userController.getMe);

router.post("/forgot-password", apiLimiter, authController.forgotPassword);

router.post(
  "/reset-password",
  apiLimiter,
  validateRequest(ResetPasswordSchema),
  authController.resetPassword,
);

router.get(
  "/my-certificates",
  apiLimiter,
  isAuthenticated,
  userController.getMyCertificates,
);

router.get(
  "/my-enrolled-courses",
  apiLimiter,
  isLocalAuthenticated,
  userController.getMyEnrolledCourses,
);

router.get(
  "/my-assigned-courses",
  apiLimiter,
  isAuthenticated,
  userController.getMyAssignedCourses,
);

router.post(
  "/staff-onboarding",
  validateRequest(OnboardStaffSchema),
  authController.onboardStaff,
);

router.post(
  "/request-for-extension",
  validateRequest(UserRequestForCourseExtensionSchema),
  isAuthenticated,
  userController.userCanRequestForCourseExtension,
);

router.get(
  "/get-expired-courses",
  isAuthenticated,
  userController.getUserExpiredCourses,
);

router.post("/logout", isAuthenticated, userController.logout);

router.put(
  "/update-profile",
  apiLimiter,
  isAuthenticated,
  authController.updateProfile,
);

router.put(
  "/update-password",
  validateRequest(UpdatePasswordSchema),
  isAuthenticated,
  authController.updatePassword,
);

router.route("/login").post(authController.login);

router.get("/session", isLocalAuthenticated, authController.getSession);
router.get("/validate-user", isLocalAuthenticated, validateUser);

router.get(
  "/:id/course-analytics",
  apiLimiter,
  isLocalAuthenticated,
  checkUserRole(["admin", "superadmin"]),
  userController.getUserAnalytics,
);

router
  .route("/:id")
  .get(apiLimiter, isAuthenticated, userController.getAUserById);

export default router;
