import express from "express";
import { analyticsController } from "../controllers/analytics.controller";
import { checkUserRole, isLocalAuthenticated } from "../Middlewares/Auth";

const analyticsRouter = express.Router();

analyticsRouter.get(
  "/courses/course-analytics",
  isLocalAuthenticated,
  checkUserRole(["admin", "superadmin"]),
  analyticsController.getCoursesCreatedOverTime,
);

analyticsRouter.get(
  "/courses/created-over-time",
  isLocalAuthenticated,
  checkUserRole(["admin", "superadmin"]),
  analyticsController.getCoursesCreatedOverTime,
);

analyticsRouter.get(
  "/courses/by-category",
  isLocalAuthenticated,
  checkUserRole(["admin", "superadmin"]),
  analyticsController.getCoursesByCategory,
);

analyticsRouter.get(
  "/courses/skill-distribution",
  isLocalAuthenticated,
  checkUserRole(["admin", "superadmin"]),
  analyticsController.getSkillLevelDistribution,
);

analyticsRouter.get(
  "/courses/enrollments",
  isLocalAuthenticated,
  checkUserRole(["admin", "superadmin"]),
  analyticsController.getEnrollmentCounts,
);

analyticsRouter.get(
  "/courses/top-enrolled",
  isLocalAuthenticated,
  checkUserRole(["admin", "superadmin"]),
  analyticsController.getTopEnrolledCourses,
);

analyticsRouter.get(
  "/users/growth-over-time",
  isLocalAuthenticated,
  checkUserRole(["admin", "superadmin"]),
  analyticsController.getUserGrowthOverTime,
);

analyticsRouter.get(
  "/users/engagement",
  isLocalAuthenticated,
  checkUserRole(["admin", "superadmin"]),
  analyticsController.getUserEngagementMetrics,
);

analyticsRouter.get(
  "/users/learning-stats",
  isLocalAuthenticated,
  checkUserRole(["admin", "superadmin"]),
  analyticsController.getUserEnrollmentStats,
);

export default analyticsRouter;
