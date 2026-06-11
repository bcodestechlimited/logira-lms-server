import mongoose from "mongoose";
import User from "../models/User";
import { ServiceResponse } from "../utils/service-response";
import { StatusCodes } from "http-status-codes";

class AnalyticsService {
  public fetchCourseAnalytics = async (id: string) => {
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
  };

  public fetchUserGrowthOverTime = async () => {
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
  };

  // 2. User Engagement (Daily and Monthly Active Users)
  public fetchUserEngagementMetrics = async () => {
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
  };

  // 3. User Course/Learning Statistics
  public fetchUserEnrollmentStats = async () => {
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
  };

  public fetchGlobalLearningOutcomes = async () => {
    try {
      const data = await User.aggregate([
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
            completedCount: {
              $size: {
                $filter: {
                  input: { $ifNull: ["$progressData", []] },
                  as: "p",
                  cond: { $eq: ["$$p.status", "completed"] },
                },
              },
            },
            inProgressCount: {
              $size: {
                $filter: {
                  input: { $ifNull: ["$progressData", []] },
                  as: "p",
                  cond: { $eq: ["$$p.status", "in-progress"] },
                },
              },
            },
            certCount: {
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
        {
          $group: {
            _id: null,
            totalCompleted: { $sum: "$completedCount" },
            totalInProgress: { $sum: "$inProgressCount" },
            totalCertificates: { $sum: "$certCount" },
          },
        },
        {
          $project: {
            _id: 0,
            totalCompleted: 1,
            totalInProgress: 1,
            totalCertificates: 1,
            totalTrackedEnrollments: { $add: ["$totalCompleted", "$totalInProgress"] },
            completionRate: {
              $cond: [
                { $gt: [{ $add: ["$totalCompleted", "$totalInProgress"] }, 0] },
                {
                  $round: [
                    {
                      $multiply: [
                        {
                          $divide: [
                            "$totalCompleted",
                            { $add: ["$totalCompleted", "$totalInProgress"] },
                          ],
                        },
                        100,
                      ],
                    },
                    1, // Rounds to 1 decimal place (e.g., 45.2)
                  ],
                },
                0,
              ],
            },
          },
        },
      ]);

      return ServiceResponse.success(
        "Successfully fetched global learning outcomes",
        data[0] || {
          totalCompleted: 0,
          totalInProgress: 0,
          totalCertificates: 0,
          totalTrackedEnrollments: 0,
          completionRate: 0,
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
  };
}

export const analyticsService = new AnalyticsService();
export default AnalyticsService;
