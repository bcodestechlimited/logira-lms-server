import { Router } from "express";
import { courseModuleController } from "../controllers/course-module.controller";
import { checkUserRole, isAuthenticated } from "../Middlewares/Auth";
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
    isAuthenticated,
    checkUserRole(["admin", "superadmin"]),
    courseModuleController.create,
  );

router
  .route("/:id")
  .put(
    isAuthenticated,
    apiLimiter,
    checkUserRole(["admin", "superadmin"]),
    courseModuleController.update,
  )
  .get(isAuthenticated, apiLimiter, courseModuleController.getCourseModuleById)
  .delete(
    apiLimiter,
    isAuthenticated,
    checkUserRole(["admin", "superadmin"]),
    courseModuleController.deleteCourseModule,
  );

export default router;
