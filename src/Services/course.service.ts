import bcrypt from "bcryptjs";
import { StatusCodes } from "http-status-codes";
import mongoose, { Types } from "mongoose";
import { APP_CONFIG } from "../config/app.config";
import { CourseDTO } from "../dtos/course.dto";
import {
  CreateAssessmentInterface,
  CreateBenchmarkInterface,
  CreateCourseInterface,
} from "../interfaces";
import {
  AssignCourseToUsersInterface,
  BulkAssignCourseInterface,
  CourseInterface,
  CourseQueryOptions,
} from "../interfaces/course.interface";
import Course, { CourseDocument } from "../models/Course";
import CourseAssessment from "../models/course-assessment.model";
import CourseBenchmark from "../models/course-benchmark.model";
import CoursePricing from "../models/course-pricing.model";
import Progress, { CourseStatusEnum } from "../models/progress.model";
import User, { EmailInvitationEnum, UserRole } from "../models/User";
import {
  generateEmailInvitationToken,
  generateRandomPassword,
} from "../utils/lib";
import { ServiceResponse } from "../utils/service-response";
// import { certificateService } from "./certificate.service";
import { fileParserService } from "./file-parser.service";
import { emailService } from "./mail.service";
import Coupon from "../models/coupon.model";
import { CourseQueryParams, SortBy } from "../shared/query.interface";
import { coerceNumber, normalizeCategory } from "../utils/course-helpers";
import { paginate } from "../utils/paginate";
import { ApiSuccess } from "../utils/response-handler";
import { agenda } from "./scheduler.service";
import DailyUploadStats from "../modules/daily-stats/daily-stats.model";
import { certificateService } from "../modules/certificates/certificate.service";

class CourseService {
  public async getAllStudentCourses(query: CourseQueryParams) {
    const page = coerceNumber(query.page, 1);
    const limit = coerceNumber(query.limit, 20);
    const search = (query.search ?? "").trim();
    const category = normalizeCategory(query.category);
    const skillLevel =
      query.skillLevel && query.skillLevel !== "all"
        ? query.skillLevel
        : undefined;
    const isPublished =
      typeof query.isPublished === "boolean" ? query.isPublished : undefined;
    const organisation = query.organisation
      ? new mongoose.Types.ObjectId(query.organisation)
      : undefined;
    const priceMin = Number.isFinite(query.priceMin)
      ? Number(query.priceMin)
      : undefined;
    const priceMax = Number.isFinite(query.priceMax)
      ? Number(query.priceMax)
      : undefined;
    const sortBy = (query.sortBy ?? "createdAt") as SortBy;
    const sortOrder = query.sortOrder === "asc" ? 1 : -1;

    const filterQuery: Record<string, any> = {
      isDeleted: false,
      status: "active",
    };

    if (typeof isPublished === "boolean") {
      filterQuery.isPublished = isPublished;
    }

    if (organisation) {
      filterQuery.organisation = organisation;
    }

    if (category) {
      filterQuery.category = category;
    }

    if (skillLevel) {
      filterQuery.skillLevel = skillLevel;
    }

    if (search) {
      filterQuery.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { summary: { $regex: search, $options: "i" } },
      ];
    }

    const sort: Record<string, 1 | -1> = {};
    switch (sortBy) {
      case "title":
        sort.title = sortOrder;
        break;
      case "amount":
        sort.amount = sortOrder;
        break;
      case "topRated":
        // Sorting by avg rating without aggregation:
        // Fallback to number of ratings desc as proxy, then createdAt
        sort["rating"] = -1; // "rating" is an array; Mongoose sorts by array length when used directly
        sort.createdAt = -1;
        break;
      case "mostRated":
        sort["rating"] = -1; // array length desc
        sort.createdAt = -1;
        break;
      case "createdAt":
      default:
        sort.createdAt = sortOrder;
        break;
    }

    const { documents: courses, pagination } = await paginate<CourseInterface>({
      model: Course,
      query: filterQuery,
      page,
      limit,
      sort,
      select: [
        "-course_modules",
        "-course_price",
        "-course_benchmark",
        "-course_assessment",
        "-participants",
        "-progress",
        "-coupon_codes",
      ],
    });

    return ApiSuccess.ok("Courses Retrieved", { courses, pagination });
  }

  // public async fetchAllPublishedCourse({options, query}: CourseQueryOptions) {
  //   const courses = await Course.paginate(query, options);
  //   return courses;
  // }
  /**
   * Creates a new course in the database.
   *
   * @param payload - An object conforming to the CreateCourseInterface containing:
   *   - courseTitle: The title of the course.
   *   - courseDescription: A description of the course.
   *   - courseImage: A URL or path to an image representing the course.
   * @returns A Promise that resolves to the created course object.
   * @throws Will throw an error if the course creation fails.
   */

  public async createNewCourse(payload: CreateCourseInterface) {
    try {
      const course = await Course.create({
        title: payload.courseTitle,
        description: payload.courseDescription,
        image: payload.courseImage,
        summary: payload.courseSummary,
        category: payload.courseCategory,
        skillLevel: payload.skillLevel,
      });

      return course;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Creates a course assessment by inserting multiple questions into the database.
   *
   * @param payload - An object conforming to the CreateAssessmentInterface containing:
   *   - courseId: The ID of the course for which the assessment is being created.
   *   - questions: An array of questions to be added to the assessment, each containing:
   *     - question: The text of the question.
   *     - type: The type of the question ("single" or "multiple").
   *     - options: An array of available options for the question, each containing:
   *       - id: A unique identifier for the option.
   *       - text: The text of the option.
   *       - isCorrect: A boolean indicating if the option is the correct answer.
   *
   * @returns A promise that resolves to an object containing a message and the inserted assessment data.
   *
   * @throws Will throw an error if the insertion fails.
   */

  public async createCourseAssessment(payload: CreateAssessmentInterface) {
    try {
      const response = await CourseAssessment.insertMany(
        payload.questions.map((q) => {
          return {
            ...q,
            courseId: payload.courseId,
          };
        }),
      );

      return {
        message: "Course Assessment created",
        data: response,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Creates a course benchmark by saving retakes and benchmark score to the database.
   *
   * @param payload - An object conforming to the CreateBenchmarkInterface containing:
   *   - courseId: The ID of the course the benchmark is associated with.
   *   - retakes: The number of retake attempts allowed.
   *   - benchmark: The benchmark score required.
   *
   * @returns A promise that resolves to an object containing the created benchmark data.
   *
   * @throws Will throw an error if the benchmark creation fails.
   */
  public async createCourseBenchmark(payload: CreateBenchmarkInterface) {
    try {
      const response = await CourseBenchmark.create({
        ...payload,
        course: payload.courseId,
      });
      return {
        data: response,
      };
    } catch (error) {
      throw error;
    }
  }

  public async getCourseModules(id: string) {
    const course = await Course.findById({ _id: id }).populate(
      "course_modules",
    );

    if (!course) {
      return {
        success: false,
        message: "No course found",
        data: null,
      };
    }

    return {
      data: course,
      message: "Success",
      success: true,
    };
  }

  async createCoursePricing(payload: {
    courseId: string;
    coursePricing: number;
  }) {
    try {
      const response = await CoursePricing.create(payload);
      return {
        data: response,
      };
    } catch (error) {
      throw error;
    }
  }

  public async publishCourse(courseId: string) {
    const course = await Course.findById({ _id: courseId });
    if (!course) {
      return {
        success: false,
        message: "No course found",
      };
    }
    course.isPublished = course.isPublished ? false : true;

    await course.save();

    return {
      success: true,
      message: "Course published successfully",
    };
  }

  public async fetchCourseById(
    courseId: string | mongoose.Types.ObjectId,
    userRole: string | undefined,
  ) {
    try {
      let course;

      if (["admin", "superadmin"].includes(userRole as string)) {
        course = await Course.findById(courseId)
          .populate({
            path: "course_assessment",
            select: "+options.isCorrect",
          })
          .populate("course_modules course_price course_benchmark");
      } else {
        course = await Course.findById(courseId).populate(
          "course_modules course_price course_benchmark",
        );
      }
      if (!course) {
        return ServiceResponse.failure(
          "No course found",
          null,
          StatusCodes.NOT_FOUND,
        );
      }

      const userCourseResponse = new CourseDTO(course);

      const response = userRole === "superadmin" ? course : userCourseResponse;

      return ServiceResponse.success(
        "Course found",
        { data: response },
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

  public async fetchCoursePriceByCourseId(courseId: string) {
    try {
      const coursePrice = await CoursePricing.findOne({ courseId });
      return ServiceResponse.success(
        "Course price found",
        { data: coursePrice },
        StatusCodes.OK,
      );
    } catch (error) {
      return ServiceResponse.failure(
        "Error fetching course price",
        null,
        StatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  }

  public async fetchCourseBenchmarkByCourseId(courseId: string) {
    try {
      const courseBenchmark = await CourseBenchmark.findOne({ courseId });
      return ServiceResponse.success(
        "Course benchmark found",
        { data: courseBenchmark },
        StatusCodes.OK,
      );
    } catch (error) {
      return ServiceResponse.failure(
        "Error fetching course benchmark",
        null,
        StatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  }

  public async fetchAllAdminCourses({ options, query }: CourseQueryOptions) {
    const course = await Course.find(query, options);

    return {
      success: true,
      message: "Success",
      data: course,
    };
  }

  public async fetchAllCoursesCreatedOverTime() {
    const data = await Course.aggregate([
      { $match: { isPublished: true } },
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
            $concat: [
              { $toString: "$_id.year" },
              "-",
              { $toString: "$_id.month" },
            ],
          },
          count: 1,
          _id: 0,
        },
      },
    ]);

    return ServiceResponse.success(
      "Successfully fetched courses created over time",
      data,
      StatusCodes.OK,
    );
  }

  public async fetchAllCoursesByCategory() {
    const data = await Course.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]);

    return ServiceResponse.success(
      "Successfully fetched courses by category",
      data,
      StatusCodes.OK,
    );
  }

  public async fetchSkillLevelDistribution() {
    const data = await Course.aggregate([
      { $group: { _id: "$skillLevel", count: { $sum: 1 } } },
    ]);

    return ServiceResponse.success(
      "Successfully fetched skill level distribution",
      data,
      StatusCodes.OK,
    );
  }

  public async fetchEnrollmentCounts() {
    const data = await Course.aggregate([
      {
        $project: {
          title: 1,
          enrollmentCount: {
            $size: { $ifNull: ["$participants", []] }, // ← default to empty array
          },
        },
      },
    ]);

    return ServiceResponse.success(
      "Successfully fetched all course enrollments",
      data,
      StatusCodes.OK,
    );
  }

  public async fetchTopEnrolledCourses() {
    const data = await Course.aggregate([
      {
        $project: {
          title: 1,
          enrollmentCount: {
            $size: { $ifNull: ["$participants", []] }, // ← default to empty array
          },
        },
      },
      { $sort: { enrollmentCount: -1 } },
      { $limit: 5 },
    ]);

    return ServiceResponse.success(
      "Successfully fetched top enrolled courses",
      data,
      StatusCodes.OK,
    );
  }

  public async updateCourse(courseId: string, payload: Record<string, any>) {
    const course = await Course.findByIdAndUpdate(courseId, payload, {
      new: true,
    });

    if (!course) {
      return {
        success: false,
        data: course,
      };
    }

    return {
      success: true,
      data: course,
    };
  }

  // note: this what I am working with to update the course benchmark, what I want to do now is that if the benchmark does not exist, I want a benchmark to be created for it, so "upsert"
  public async updateCourseBenchmark(
    payload: { retakes: number; benchmark: number },
    id: string,
  ) {
    const bookmark = await CourseBenchmark.findByIdAndUpdate(id, payload, {
      new: true,
    });

    return bookmark;
  }

  async fetchCourseAssesments(id: string, userRole: string) {
    const role = userRole.toLowerCase();

    let query = CourseAssessment.find({ courseId: id });
    if (role === "admin" || role === "superadmin") {
      query = query.select("+options.isCorrect");
    }

    const course_assessment = await query;
    if (!course_assessment) {
      return {
        success: false,
        message: "No course assessment found",
        data: null,
      };
    }

    return {
      success: true,
      message: "Success",
      data: course_assessment,
    };
  }

  // test this service

  /**
   *
   * @param userId
   * @param courseId
   * @param answers
   * @returns
   *
   * const questions = await CourseAssessment
  .find({ courseId })
  .select('+options.isCorrect');    // <— this pulls in isCorrect

   */
  public async submitCourseAssessment(
    userId: string,
    courseId: string,
    answers: { questionId: string; selectedOptionId: number }[],
  ) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const questions = await CourseAssessment.find({ courseId }).select(
        "+options.isCorrect",
      );

      if (!questions.length) {
        await session.abortTransaction();
        return ServiceResponse.failure(
          "No assessment questions found",
          null,
          StatusCodes.NOT_FOUND,
        );
      }

      const course = await Course.findById(courseId)
        .populate("course_benchmark")
        .session(session)
        .lean();

      const benchmarkDoc = (course as any).course_benchmark;
      const maxRetakes = benchmarkDoc?.retakes ?? 0;
      const passingScore = benchmarkDoc?.benchmark ?? 50;

      const allowedAttempts = maxRetakes;

      const progress = await Progress.findOne({
        user: userId,
        course: courseId,
      }).session(session);

      if (!progress) {
        await session.abortTransaction();
        return ServiceResponse.failure(
          "No progress found",
          null,
          StatusCodes.NOT_FOUND,
        );
      }

      if (progress.currentAttempt >= allowedAttempts) {
        await session.abortTransaction();
        return ServiceResponse.failure(
          "No more retakes allowed",
          null,
          StatusCodes.FORBIDDEN,
        );
      }

      // Convert answers to proper ObjectIds
      const validatedAnswers = questions.map((question) => {
        const userAnswer = answers.find(
          (a) => a.questionId === question._id.toString(),
        );
        const correctOption = question.options.find((o) => o.isCorrect);

        return {
          questionId: new mongoose.Types.ObjectId(question._id),
          selectedOptionId: userAnswer?.selectedOptionId ?? -1,
          isCorrect: userAnswer?.selectedOptionId === correctOption?.id,
          correctOptionId: correctOption,
        };
      });

      // Calculate score
      const correctCount = validatedAnswers.filter((a) => a.isCorrect).length;
      const scorePercent = Number(
        ((correctCount / questions.length) * 100).toFixed(2),
      );
      const passed = scorePercent >= passingScore;
      const nextAttempt = progress.currentAttempt + 1;
      const isFinalAttempt = nextAttempt === allowedAttempts;

      // Store attempt
      progress.assessmentHistory.push({
        attempt: nextAttempt,
        timestamp: new Date(),
        score: scorePercent,
        passed,
        isFinalAttempt,
        answers: validatedAnswers.map((a) => ({
          questionId: a.questionId,
          selectedOptionId: a.selectedOptionId,
          isCorrect: a.isCorrect,
          correctOptionId: a.correctOptionId,
        })),
      });

      progress.score = scorePercent;

      if (passed) {
        progress.status = CourseStatusEnum.COMPLETED;
        progress.completedAt = new Date();
        if (!progress.certificateIssued) {
          // const emailResponse = await certificateService.issueCertificate(
          //   userId,
          //   courseId,
          // );
          await certificateService.issueCertificate(userId, courseId);

          progress.certificateIssued = true;
        }
      } else if (isFinalAttempt) {
        progress.status = CourseStatusEnum.FAILED;
      }

      await progress.save({ session });
      await session.commitTransaction();

      // Prepare corrections
      const corrections = isFinalAttempt
        ? validatedAnswers.map((a) => ({
            questionId: a.questionId.toString(),
            correctOption: a.correctOptionId,
            userSelected: a.selectedOptionId,
            isCorrect: a.isCorrect,
          }))
        : undefined;

      return ServiceResponse.success(
        "Assessment graded",
        {
          data: {
            passed,
            scorePercent,
            currentAttempt: nextAttempt,
            remainingAttempts: allowedAttempts - nextAttempt,
            isFinalAttempt,
            corrections,
          },
        },
        StatusCodes.OK,
      );
    } catch (error) {
      console.log("error", error);
      await session.abortTransaction();
      return ServiceResponse.failure(
        "Internal Server Error",
        null,
        StatusCodes.INTERNAL_SERVER_ERROR,
      );
    } finally {
      session.endSession();
    }
  }

  async uploadCourseCertificate(cloudinary_image: string, courseId: string) {
    try {
      const course = await Course.findByIdAndUpdate(
        { _id: courseId },
        {
          $set: { certificate: cloudinary_image },
        },
        { new: true },
      );

      return course;
    } catch (error) {
      throw error;
    }
  }

  async launchCourse(courseId: string, userId: string) {
    try {
      const courseDoc = await Course.findById(courseId);
      if (!courseDoc) {
        return ServiceResponse.failure(
          "Course not found",
          null,
          StatusCodes.NOT_FOUND,
        );
      }

      const courseBenchmark = await CourseBenchmark.findOne({
        course: courseId,
      });
      if (!courseBenchmark) {
        return ServiceResponse.failure(
          "Course benchmark not set",
          null,
          StatusCodes.BAD_REQUEST,
        );
      }

      const modules = (courseDoc.course_modules || []).map((moduleId: any) => ({
        module: moduleId,
        completed: false,
        completedAt: null,
      }));

      const existingProgress = await Progress.findOne({
        user: userId,
        course: courseId,
      });

      if (existingProgress) {
        return ServiceResponse.success(
          "User has already started the course",
          {
            data: {
              courseId: courseDoc._id,
              moduleId: modules[0].module,
            },
          },
          StatusCodes.OK,
        );
      }

      const progress = await Progress.create({
        user: userId,
        course: courseId,
        progressPercentage: 0,
        modules,
        score: 0,
        certificateIssued: false,
        status: CourseStatusEnum.IN_PROGRESS,
        assessmentAttempts: courseBenchmark.retakes,
        currentAttempt: 0,
      });
      if (!progress) {
        return ServiceResponse.failure(
          "Failed to create progress document",
          null,
          StatusCodes.BAD_REQUEST,
        );
      }

      const updatedCourse = await Course.findByIdAndUpdate(
        courseId,
        { $push: { progress: progress._id } },
        { new: true },
      );
      if (!updatedCourse) {
        return ServiceResponse.failure(
          "Course not found",
          null,
          StatusCodes.NOT_FOUND,
        );
      }

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $push: { progress: progress._id, courses: courseDoc._id } },
        { new: true },
      );
      if (!updatedUser) {
        return ServiceResponse.failure(
          "User not found",
          null,
          StatusCodes.NOT_FOUND,
        );
      }

      return ServiceResponse.success(
        "Course launched successfully",
        {
          data: {
            user: updatedUser,
            progress,
            courseId: courseDoc._id,
            moduleId: modules[0].module,
          },
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

  async fetchCourseSummary(id: string) {
    const course = await Course.findById({ _id: id }).populate(
      "course_modules",
    );

    if (!course) {
      return {
        success: false,
        data: null,
        message: "No course found",
      };
    }

    return {
      success: true,
      data: course,
      message: "Success",
    };
  }

  public async assignCourseToUser({
    userId,
    courseIds,
    durationDays,
  }: AssignCourseToUsersInterface) {
    try {
      const user = await User.findById({ _id: userId });
      if (!user) {
        throw new Error("User not found");
      }
      const userEnrolledCourseIds = new Set(
        user.courseEnrollments?.map((enrollment) =>
          enrollment.course.toString(),
        ) || [],
      );

      const now = new Date();
      const defaultDuration = durationDays || 90;
      const expiresAt = new Date(
        now.getTime() + defaultDuration * 24 * 60 * 60 * 1000,
      );

      const newCourseObjectIds: Types.ObjectId[] = [];

      for (const courseId of courseIds) {
        const courseObjectId = new mongoose.Types.ObjectId(courseId);

        if (!userEnrolledCourseIds.has(courseId)) {
          if (!user.courseEnrollments) {
            user.courseEnrollments = [];
          }

          user.courseEnrollments.push({
            course: courseObjectId,
            expiresAt: expiresAt,
            isAssigned: true,
          });

          newCourseObjectIds.push(courseObjectId);
        }
      }

      await user.save();
      for (const courseObjectId of newCourseObjectIds) {
        const course = await Course.findById(courseObjectId);
        if (!course) continue;

        const participantIds = new Set(
          course.participants?.map((id) => id.toString()) || [],
        );

        if (!participantIds.has(userId)) {
          if (!course.participants) {
            course.participants = [];
          }
          course.participants.push(new mongoose.Types.ObjectId(userId));

          if (course.pastParticipants?.some((id) => id.toString() === userId)) {
            course.pastParticipants = course.pastParticipants.filter(
              (id) => id.toString() !== userId,
            );
          }
          await course.save();
        }
      }
    } catch (error) {
      throw error;
    }
  }

  public async triggerBulkAssignment(payload: BulkAssignCourseInterface) {
    try {
      const users = await fileParserService.parseCsv(payload.file);
      const uploadCount = users.length;
      const DAILY_LIMIT = 500;

      const today = new Date().toISOString().split("T")[0];
      const stats = await DailyUploadStats.findOne({ date: today });
      const currentCount = stats ? stats.count : 0;

      if (currentCount + uploadCount > DAILY_LIMIT) {
        return ServiceResponse.failure(
          `Daily limit exceeded. You have processed ${currentCount} users today. Uploading this file (${uploadCount} users) would exceed the limit of ${DAILY_LIMIT}.`,
          null,
          StatusCodes.TOO_MANY_REQUESTS,
        );
      }

      await DailyUploadStats.updateOne(
        { date: today },
        { $inc: { count: uploadCount } },
        { upsert: true },
      );

      await agenda.now("bulk assign courses", {
        usersRaw: users,
        courseIds: payload.courseIds,
        durationDays: payload.durationDays,
        isIcsStaff: payload.isIcsStaff,
      });

      return ServiceResponse.success(
        "Bulk assignment processing started in the background.",
        null,
        StatusCodes.OK,
      );
    } catch (error) {
      return ServiceResponse.failure(
        "Error starting bulk assignment",
        null,
        StatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  }

  public async executeBulkJob(data: any) {
    const { usersRaw, courseIds, durationDays, isIcsStaff } = data;

    const results = await Promise.all(
      usersRaw.map(async (user: any) => {
        const existingUser = await User.findOne({ email: user.email });

        let password;
        let token: { userToken: string; hashedToken: string };
        let createdUser;

        token = generateEmailInvitationToken();
        if (!existingUser) {
          password = generateRandomPassword();
          const passwordHash = await bcrypt.hash(password, 10);

          createdUser = await User.create({
            email: user.email,
            firstName: user.firstname,
            lastName: user.lastname,
            role: isIcsStaff ? UserRole.STAFF : UserRole.USER,
            emailInvitationToken: token.hashedToken,
            staffEmailInvitationSentAt: Date.now(),
            emailInvitationStatus: EmailInvitationEnum.PENDING,
            password: passwordHash,
          });
        }

        const userToUse = existingUser ?? createdUser;
        const currentCourses = new Set(
          userToUse.courses?.map((id: any) => id.toString()) || [],
        );
        const allCoursesAssigned = courseIds.every((id: string) =>
          currentCourses.has(id),
        );

        if (allCoursesAssigned) {
          return {
            email: user.email,
            success: true,
            message: "User already assigned to all selected courses",
          };
        }

        await this.assignCourseToUser({
          courseIds: courseIds,
          userId: userToUse._id,
          durationDays: durationDays,
        });

        const emailResponse = await emailService.sendEmailTemplate({
          subject: existingUser
            ? "You've been assigned a course"
            : "Invitation to join Logira LMS",
          template: existingUser ? "course-assignment" : "invite-staff",
          to: user.email,
          variables: {
            platformName: APP_CONFIG.COMPANY_NAME,
            firstName: user.firstname,
            durationDays: durationDays,
            companyName: APP_CONFIG.COMPANY_NAME,
            loginUrl: existingUser
              ? `${APP_CONFIG.CLIENT_FRONTEND_BASE_URL}/dashboard`
              : `${
                  APP_CONFIG.CLIENT_FRONTEND_BASE_URL
                }/auth/staff-onboarding?token=${
                  token.userToken
                }&email=${encodeURIComponent(user.email)}`,
            email: user.email,
            password: password,
            supportEmail: APP_CONFIG.SUPPORT_EMAIL,
          },
        });
        if (emailResponse.status !== "ok") {
          return { email: user.email, success: false };
        }

        return { email: user.email, success: true };
      }),
    );

    console.log("Bulk Job Completed:", results);
  }

  public async processCourseExpirations(): Promise<void> {
    await User.checkAllUsersForExpiredCourses();
  }

  //note: this are useful class methods that are needed for the class
  /**
   * Unenroll a user from a course
   * @param userId User ID
   * @param courseId Course ID
   * @returns Success status
   */
  static async unenrollUserFromCourse(
    userId: mongoose.Types.ObjectId | string,
    courseId: mongoose.Types.ObjectId | string,
  ): Promise<boolean> {
    const course = await Course.findById(courseId);

    if (!course) {
      throw new Error("Course not found");
    }

    const userObjectId =
      typeof userId === "string" ? new mongoose.Types.ObjectId(userId) : userId;
    return course.unenrollUser(userObjectId);
  }

  /**
   * Enroll a user in a course with expiration
   * @param userId User ID
   * @param courseId Course ID
   * @param durationDays Duration in days (optional, will use course default if not provided)
   * @returns Expiration date
   */
  static async enrollUserInCourse(
    userId: mongoose.Types.ObjectId | string,
    courseId: mongoose.Types.ObjectId | string,
    durationDays?: number,
  ): Promise<Date> {
    const course = await Course.findById(courseId);

    if (!course) {
      throw new Error("Course not found");
    }

    const userObjectId =
      typeof userId === "string" ? new mongoose.Types.ObjectId(userId) : userId;
    return course.enrollUser(userObjectId, durationDays);
  }

  /**
   * Check if a user has access to a course
   * @param userId User ID
   * @param courseId Course ID
   * @returns Boolean indicating if user has access
   */
  static async hasUserAccessToCourse(
    userId: mongoose.Types.ObjectId | string,
    courseId: mongoose.Types.ObjectId | string,
  ): Promise<boolean> {
    const user = await User.findById(userId);

    if (!user || !user.courseEnrollments) {
      return false;
    }

    const now = new Date();
    const courseObjectId =
      typeof courseId === "string"
        ? new mongoose.Types.ObjectId(courseId)
        : courseId;

    return user.courseEnrollments.some(
      (enrollment) =>
        enrollment.course.equals(courseObjectId) && enrollment.expiresAt > now,
    );
  }

  /**
   * Get all active courses for a user
   * @param userId User ID
   * @returns Array of course IDs
   */
  static async getUserActiveCourses(
    userId: mongoose.Types.ObjectId | string,
  ): Promise<mongoose.Types.ObjectId[]> {
    const user = await User.findById(userId);

    if (!user || !user.courseEnrollments) {
      return [];
    }

    const now = new Date();
    return user.courseEnrollments
      .filter((enrollment) => enrollment.expiresAt > now)
      .map((enrollment) => enrollment.course);
  }

  /**
   * Get all expired courses for a user
   * @param userId User ID
   * @returns Array of course IDs
   */
  public async getUserExpiredCourses(userId: mongoose.Types.ObjectId | string) {
    const user = await User.findById(userId).populate({
      path: "expiredCourses.course",
      model: "Course",
    });

    return user?.expiredCourses || [];
  }

  public async softDelete(courseId: string) {
    const course = await Course.findById(courseId);
    if (!course) {
      throw new Error("Course not found");
    }

    const coupons = await Coupon.find({ courseId });

    for (const coupon of coupons) {
      coupon.isDeleted = true;
      await coupon.save();
    }

    course.isDeleted = true;
    await course.save();

    return ServiceResponse.success(
      "Course deleted successfully",
      {},
      StatusCodes.OK,
    );
  }

  public async deleteCourseByCourseId(courseId: string) {
    const course = await Course.findByIdAndDelete(courseId);

    return ServiceResponse.success(
      "Course deleted successfully",
      course,
      StatusCodes.OK,
    );
  }
}

const courseService = new CourseService();
export { courseService, CourseService };
