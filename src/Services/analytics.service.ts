import mongoose from "mongoose";
import User from "../models/User";
import { ServiceResponse } from "../utils/service-response";
import { StatusCodes } from "http-status-codes";

class AnalyticsService {
  public async fetchCourseAnalytics(id: string) {
    const statsArr = await User.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(id) } },
      {
        $lookup: {
          from: "progresses",
          localField: "progress",
          foreignField: "_id",
          as: "progressData",
        },
      },
      {
        $project: {
          totalCourses: {
            $size: { $ifNull: ["$courseEnrollments", []] },
          },
          enrolledCourses: {
            $size: {
              $filter: {
                input: { $ifNull: ["$progressData", []] },
                as: "p",
                cond: { $eq: ["$$p.status", "in-progress"] },
              },
            },
          },
          completedCourses: {
            $size: {
              $filter: {
                input: { $ifNull: ["$progressData", []] },
                as: "p",
                cond: { $eq: ["$$p.status", "completed"] },
              },
            },
          },
          certifiedCourses: {
            $size: {
              $filter: {
                input: { $ifNull: ["$progressData", []] },
                as: "p",
                cond: { $eq: ["$$p.certificateIssued", true] },
              },
            },
          },
        },
      },
    ]);

    if (!statsArr.length) {
      return { success: false, message: "No user found" };
    }

    return { success: true, data: statsArr[0] };
  }

  public async fetchUserGrowthOverTime() {
    try {
      const data = await User.aggregate([
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
        {
          $project: {
            date: {
              $concat: [{ $toString: "$_id.year" }, "-", { $toString: "$_id.month" }],
            },
            count: 1,
            _id: 0,
          },
        },
      ]);

      return ServiceResponse.success(
        "Successfully fetched user growth over time",
        data,
        StatusCodes.OK,
      );
    } catch (error) {
      return ServiceResponse.failure(
        "Internal Server Error",
        null,
        StatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // 2. User Engagement (Daily and Monthly Active Users)
  public async fetchUserEngagementMetrics() {
    try {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const data = await User.aggregate([
        {
          $facet: {
            dailyActiveUsers: [
              { $match: { lastVisited: { $gte: oneDayAgo } } },
              { $count: "count" },
            ],
            monthlyActiveUsers: [
              { $match: { lastVisited: { $gte: thirtyDaysAgo } } },
              { $count: "count" },
            ],
            totalUsers: [{ $count: "count" }],
          },
        },
        {
          $project: {
            DAU: { $ifNull: [{ $arrayElemAt: ["$dailyActiveUsers.count", 0] }, 0] },
            MAU: { $ifNull: [{ $arrayElemAt: ["$monthlyActiveUsers.count", 0] }, 0] },
            total: { $ifNull: [{ $arrayElemAt: ["$totalUsers.count", 0] }, 0] },
          },
        },
      ]);

      return ServiceResponse.success(
        "Successfully fetched user engagement metrics",
        data[0],
        StatusCodes.OK,
      );
    } catch (error) {
      return ServiceResponse.failure(
        "Internal Server Error",
        null,
        StatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // 3. User Course/Learning Statistics
  public async fetchUserEnrollmentStats() {
    try {
      const data = await User.aggregate([
        {
          $project: {
            activeEnrollmentsCount: { $size: { $ifNull: ["$courseEnrollments", []] } },
            expiredCoursesCount: { $size: { $ifNull: ["$expiredCourses", []] } },
            assignedEnrollments: {
              $size: {
                $filter: {
                  input: { $ifNull: ["$courseEnrollments", []] },
                  as: "enrollment",
                  cond: { $eq: ["$$enrollment.isAssigned", true] },
                },
              },
            },
          },
        },
        {
          $group: {
            _id: null,
            totalActiveEnrollments: { $sum: "$activeEnrollmentsCount" },
            totalExpiredEnrollments: { $sum: "$expiredCoursesCount" },
            totalAssignedEnrollments: { $sum: "$assignedEnrollments" },
          },
        },
        {
          $project: {
            _id: 0,
            totalActiveEnrollments: 1,
            totalExpiredEnrollments: 1,
            totalAssignedEnrollments: 1,
            totalSelfEnrolled: {
              $subtract: ["$totalActiveEnrollments", "$totalAssignedEnrollments"],
            },
          },
        },
      ]);

      return ServiceResponse.success(
        "Successfully fetched user learning statistics",
        data[0] || {
          totalActiveEnrollments: 0,
          totalExpiredEnrollments: 0,
          totalAssignedEnrollments: 0,
          // totalSelfEnrolled: 0,
        },
        StatusCodes.OK,
      );
    } catch (error) {
      return ServiceResponse.failure(
        "Internal Server Error",
        null,
        StatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

export const analyticsService = new AnalyticsService();
export default AnalyticsService;
