import { Router } from "express";
import { courseModuleController } from "../controllers/course-module.controller";
import { checkUserRole, isAuthenticated, isLocalAuthenticated } from "../Middlewares/Auth";
import { apiLimiter } from "../Middlewares/RateLimiter";

const router = Router();

router.post(
  "/:moduleId/complete",
  apiLimiter,
  isAuthenticated,
  courseModuleController.markModuleCompleted,
);

/**
 * TODO: in this code make sure that it is the person that created the course that can create module
 */
router
  .route("/")
  .post(
    apiLimiter,
    isLocalAuthenticated,
    checkUserRole(["admin", "superadmin"]),
    courseModuleController.create,
  );

router
  .route("/:id")
  .put(
    isLocalAuthenticated,
    apiLimiter,
    checkUserRole(["admin", "superadmin"]),
    courseModuleController.update,
  )
  .get(isLocalAuthenticated, apiLimiter, courseModuleController.getCourseModuleById)
  .delete(
    apiLimiter,
    isLocalAuthenticated,
    checkUserRole(["admin", "superadmin"]),
    courseModuleController.deleteCourseModule,
  );

export default router;
