import { Request, Response } from "express";
import { courseService } from "../Services/course.service";
import { analyticsService } from "../Services/analytics.service";

class AnalyticsController {
  constructor() {}

  public async getCoursesCreatedOverTime(req: Request, res: Response) {
    const serviceResponse = await courseService.fetchAllCoursesCreatedOverTime();
    res.status(serviceResponse.statusCode).json(serviceResponse);
  }

  public async getCoursesByCategory(req: Request, res: Response) {
    const serviceResponse = await courseService.fetchAllCoursesByCategory();
    res.status(serviceResponse.statusCode).json(serviceResponse);
  }

  public async getSkillLevelDistribution(req: Request, res: Response) {
    const serviceResponse = await courseService.fetchSkillLevelDistribution();
    res.status(serviceResponse.statusCode).json(serviceResponse);
  }

  public async getEnrollmentCounts(req: Request, res: Response) {
    const serviceResponse = await courseService.fetchEnrollmentCounts();
    res.status(serviceResponse.statusCode).json(serviceResponse);
  }

  public async getTopEnrolledCourses(req: Request, res: Response) {
    const serviceResponse = await courseService.fetchTopEnrolledCourses();
    res.status(serviceResponse.statusCode).json(serviceResponse);
  }

  public async getUserGrowthOverTime(req: Request, res: Response) {
    const serviceResponse = await analyticsService.fetchUserGrowthOverTime();
    res.status(serviceResponse.statusCode).json(serviceResponse);
  }

  public async getUserEngagementMetrics(req: Request, res: Response) {
    const serviceResponse = await analyticsService.fetchUserEngagementMetrics();
    res.status(serviceResponse.statusCode).json(serviceResponse);
  }

  public async getUserEnrollmentStats(req: Request, res: Response) {
    const serviceResponse = await analyticsService.fetchUserEnrollmentStats();
    res.status(serviceResponse.statusCode).json(serviceResponse);
  }
}

export const analyticsController = new AnalyticsController();
export default AnalyticsController;
