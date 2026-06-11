import { Request, Response } from "express";
import { courseService } from "../Services/course.service";
import { analyticsService } from "../Services/analytics.service";

class AnalyticsController {
  constructor() {}

  public getCoursesCreatedOverTime = async (req: Request, res: Response) => {
    const serviceResponse = await courseService.fetchAllCoursesCreatedOverTime();
    res.status(serviceResponse.statusCode).json(serviceResponse);
  };

  public getCoursesByCategory = async (req: Request, res: Response) => {
    const serviceResponse = await courseService.fetchAllCoursesByCategory();
    res.status(serviceResponse.statusCode).json(serviceResponse);
  };

  public getSkillLevelDistribution = async (req: Request, res: Response) => {
    const serviceResponse = await courseService.fetchSkillLevelDistribution();
    res.status(serviceResponse.statusCode).json(serviceResponse);
  };

  public getEnrollmentCounts = async (req: Request, res: Response) => {
    const serviceResponse = await courseService.fetchEnrollmentCounts();
    res.status(serviceResponse.statusCode).json(serviceResponse);
  };

  public getTopEnrolledCourses = async (req: Request, res: Response) => {
    const serviceResponse = await courseService.fetchTopEnrolledCourses();
    res.status(serviceResponse.statusCode).json(serviceResponse);
  };

  public getUserGrowthOverTime = async (req: Request, res: Response) => {
    const serviceResponse = await analyticsService.fetchUserGrowthOverTime();
    res.status(serviceResponse.statusCode).json(serviceResponse);
  };

  public getUserEngagementMetrics = async (req: Request, res: Response) => {
    const serviceResponse = await analyticsService.fetchUserEngagementMetrics();
    res.status(serviceResponse.statusCode).json(serviceResponse);
  };

  public getUserEnrollmentStats = async (req: Request, res: Response) => {
    const serviceResponse = await analyticsService.fetchUserEnrollmentStats();
    res.status(serviceResponse.statusCode).json(serviceResponse);
  };

  public getGlobalLearningOutcomes = async (req: Request, res: Response) => {
    const serviceResponse = await analyticsService.fetchGlobalLearningOutcomes();
    res.status(serviceResponse.statusCode).json(serviceResponse);
  };
}

export const analyticsController = new AnalyticsController();
export default AnalyticsController;
