import express from "express";
import { courseController } from "../controllers/course.controller.ts";
import {
  checkUserRole,
  isAuthenticated,
  isLocalAuthenticated,
} from "../Middlewares/Auth.ts";
import { apiLimiter } from "../Middlewares/RateLimiter.ts";
import { uploadCertificate } from "../Middlewares/upload-file.ts";
import validateRequest from "../Middlewares/validation.middleware.ts";
import {
  CreateCourseAssessmentSchema,
  CreateCourseBenchmarkSchema,
  CreateCoursePricingSchema,
} from "../Schema/course.schema.ts";
import { CourseIdParamSchema } from "../utils/custom-validation.ts";

const router = express.Router();

router.get("/course-published", apiLimiter, courseController.getStudentCourses);

router
  .route("/")
  .get(courseController.getAllAdminCourses)
  .post(
    apiLimiter,
    isLocalAuthenticated,
    checkUserRole(["admin", "superadmin"]),
    courseController.uploadCourseController,
  );

router.post(
  "/assign-courses-to-staff",
  apiLimiter,
  isLocalAuthenticated,
  checkUserRole(["admin", "superadmin"]),
  courseController.bulkAssigningOfCourses,
);

router.post(
  "/upload-course-certificate",
  apiLimiter,
  isLocalAuthenticated,
  checkUserRole(["admin", "superadmin"]),
  uploadCertificate,
  courseController.uploadCourseCertificate,
);

router
  .route("/edit-benchmark")
  .put(
    apiLimiter,
    isLocalAuthenticated,
    checkUserRole(["admin", "superadmin"]),
    courseController.editCourseBenchmark,
  );

router
  .route("/course-assessment")
  .post(
    apiLimiter,
    isLocalAuthenticated,
    validateRequest(CreateCourseAssessmentSchema),
    checkUserRole(["admin", "superadmin"]),
    courseController.createCourseAssessment,
  );

router.post(
  "/course-benchmark",
  apiLimiter,
  isLocalAuthenticated,
  validateRequest(CreateCourseBenchmarkSchema),
  checkUserRole(["admin", "superadmin"]),
  courseController.createCourseBenchmark,
);

router
  .route("/course-pricing")
  .post(
    apiLimiter,
    isLocalAuthenticated,
    validateRequest(CreateCoursePricingSchema),
    checkUserRole(["admin", "superadmin"]),
    courseController.createCoursePricing,
  )
  .patch(
    apiLimiter,
    isLocalAuthenticated,
    checkUserRole(["admin", "superadmin"]),
    courseController.updateCoursePricing,
  );

router
  .route("/course-image/:courseId")
  .patch(
    apiLimiter,
    isLocalAuthenticated,
    checkUserRole(["admin", "superadmin"]),
    validateRequest(CourseIdParamSchema, "params"),
    courseController.updateCourseImage,
  );

router.get(
  "/:id/course-modules",
  apiLimiter,
  courseController.getCourseModules,
);

router.get(
  "/:id/course-assessment",
  apiLimiter,
  isAuthenticated,
  courseController.getCourseAssesments,
);

router.post(
  "/:id/course-assessment/submit",
  apiLimiter,
  isAuthenticated,
  courseController.submitCourseAssessment,
);

router.post(
  "/:courseId/launch-course",
  apiLimiter,
  isAuthenticated,
  courseController.launchCourse,
);

router.get("/:id/course-summary", courseController.getCourseSummary);

router
  .route("/:id/publish-course")
  .patch(
    apiLimiter,
    isLocalAuthenticated,
    checkUserRole(["admin", "superadmin"]),
    courseController.publishCourse,
  );

router.get(
  "/course-pricing/:id",
  apiLimiter,
  courseController.getCoursePricing,
);

router.get(
  "/course-benchmark/:id",
  apiLimiter,
  courseController.getCourseBenchmark,
);

router
  .route("/course-assessment/:id")
  .put(
    apiLimiter,
    isLocalAuthenticated,
    checkUserRole(["admin", "superadmin"]),
    courseController.updateCourseAssessment,
  );

router
  .route("/course-assessments/:id/submit")
  .post(apiLimiter, isAuthenticated, courseController.submitCourseAssessment);

router.delete(
  "/:id/hard-delete",
  apiLimiter,
  isLocalAuthenticated,
  checkUserRole(["admin", "superadmin"]),
  courseController.deleteCourse,
);

router
  .route("/:id")
  .put(
    apiLimiter,
    isLocalAuthenticated,
    checkUserRole(["admin", "superadmin"]),
    courseController.updateCourseController,
  )
  .get(apiLimiter, courseController.getCourseById)
  .delete(
    apiLimiter,
    isLocalAuthenticated,
    checkUserRole(["admin", "superadmin"]),
    courseController.softDeleteCourse,
  );

export default router;
