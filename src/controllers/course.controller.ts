import createDOMPurify from "dompurify";
import { NextFunction, Request, Response } from "express";
import { UploadedFile } from "express-fileupload";
import { StatusCodes } from "http-status-codes";
import { JSDOM } from "jsdom";
import { Types } from "mongoose";
import { ZodError } from "zod";
import { APP_CONFIG } from "../config/app.config";
import { ExtendedRequest } from "../interfaces/auth.interface";
import { RequestWithCourseImage } from "../interfaces/query";
import { handleServiceResponse } from "../Middlewares/validation.middleware";
import Course from "../models/Course";
import CourseAssessment, {
  AssessmentDocument,
} from "../models/course-assessment.model";
import CoursePricing from "../models/course-pricing.model";
import { bulkAssignCourseSchema } from "../Schema/course.schema";
import { CourseService } from "../Services/course.service";
import { uploadToCloudinary } from "../utils/cloudinary.utils";
import { ServiceResponse } from "../utils/service-response";
import { CourseQueryParams } from "../shared/query.interface";

const courseService = new CourseService();
const window = new JSDOM("").window;
const domPurify = createDOMPurify(window);

class CourseController {
  async getStudentCourses(req: Request, res: Response) {
    const query = req.query as CourseQueryParams;
    query.isPublished = true;
    const result = await courseService.getAllStudentCourses(query);

    res.status(result.status_code).json(result);
  }

  async getAllAdminCourses(req: Request, res: Response) {
    const query = req.query as CourseQueryParams;
    const result = await courseService.getAllStudentCourses(query);

    res.status(result.status_code).json(result);
  }

  async uploadCourseController(r, res: Response) {
    try {
      const req = r as RequestWithCourseImage;

      const {
        courseTitle,
        courseDescription,
        courseSummary,
        courseCategory,
        skillLevel,
      } = req.body;

      if (!req.files || !req.files?.courseImage) {
        return res
          .status(400)
          .json({ message: "No file uploaded", success: false });
      }

      const rawImage = req.files.courseImage;

      const courseImage: UploadedFile = Array.isArray(rawImage)
        ? rawImage[0]
        : rawImage;

      const fileTypes = /jpeg|jpg|png|gif|webp/;
      const mimeType = fileTypes.test(courseImage.mimetype);

      if (!mimeType) {
        return res.status(400).json({
          success: false,
          message: "Invalid file type. Please upload an image file",
        });
      }

      const sanitizedCourseDescription = domPurify.sanitize(
        courseDescription,
        APP_CONFIG.PURIFY_CONFIG,
      );

      const tempFilePath = courseImage.tempFilePath;

      const cloudinary_image = await uploadToCloudinary(tempFilePath, {
        folderName: "LMS",
        resourceType: "image",
      });

      if (!cloudinary_image) {
        return handleServiceResponse(
          ServiceResponse.failure(
            "Failed to upload course image",
            null,
            StatusCodes.BAD_REQUEST,
          ),
          res,
        );
      }

      const course = {
        courseTitle,
        courseDescription: sanitizedCourseDescription,
        courseImage: cloudinary_image,
        courseSummary,
        courseCategory: courseCategory,
        skillLevel: skillLevel,
      };
      const course_response = await courseService.createNewCourse(course);
      if (!course_response) {
        return handleServiceResponse(
          ServiceResponse.failure(
            "Failed to create course",
            null,
            StatusCodes.BAD_REQUEST,
          ),
          res,
        );
      }

      handleServiceResponse(
        ServiceResponse.success(
          "Course Created",
          course_response,
          StatusCodes.CREATED,
        ),
        res,
      );
    } catch (error) {
      handleServiceResponse(
        ServiceResponse.failure(
          "Internal Server Error",
          null,
          StatusCodes.INTERNAL_SERVER_ERROR,
        ),
        res,
      );
    }
  }

  // CREATE COURSE ASSESSMENT, DIFFERENT FROM CREATE MODULE ASSESSMENT
  async createCourseAssessment(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const courseId = req.body.courseId;
      const isCourseExists = await Course.findById(courseId);
      if (!isCourseExists) {
        return handleServiceResponse(
          ServiceResponse.failure(
            "Course is not found",
            null,
            StatusCodes.NOT_FOUND,
          ),
          res,
        );
      }
      const payload = {
        courseId: req.body.courseId,
        questions: req.body.questions,
      };

      const response = await courseService.createCourseAssessment(payload);

      // ADD ASSESSMENT ID TO THE COURSE MODULE
      await Course.findByIdAndUpdate(
        courseId,
        {
          $push: { course_assessment: response.data[0]._id },
        },
        { new: true },
      );

      handleServiceResponse(
        ServiceResponse.success(
          "Course Assessment Created",
          { data: response, success: true },
          StatusCodes.CREATED,
        ),
        res,
      );
    } catch (error) {
      handleServiceResponse(
        ServiceResponse.failure(
          "Failed to create course assessment",
          null,
          500,
        ),
        res,
      );
    }
  }

  async updateCourseAssessment(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { id } = req.params;
      const { questions } = req.body;

      const course = await Course.findById(id);
      if (!course) {
        return handleServiceResponse(
          ServiceResponse.failure(
            "Course not found",
            { data: null, success: false },
            StatusCodes.NOT_FOUND,
          ),
          res,
        );
      }

      // Update each question: if _id exists, update the question; otherwise, create a new one.
      const updatedQuestions: AssessmentDocument[] = [];
      for (const q of questions) {
        if (q._id) {
          const updated = await CourseAssessment.findByIdAndUpdate(q._id, q, {
            new: true,
          });
          if (updated) {
            updatedQuestions.push(updated as unknown as AssessmentDocument);
          }
        } else {
          const created = await CourseAssessment.create({ ...q, courseId: id });
          updatedQuestions.push(created as unknown as AssessmentDocument);

          course.course_assessment.push(
            created._id as unknown as Types.ObjectId,
          );
          await course.save();
        }
      }

      handleServiceResponse(
        ServiceResponse.success(
          "Course Assessment updated",
          { data: updatedQuestions, success: true },
          StatusCodes.OK,
        ),
        res,
      );
    } catch (error) {
      handleServiceResponse(
        ServiceResponse.failure(
          "Failed to update course assessment",
          null,
          500,
        ),
        res,
      );
    }
  }

  async createCourseBenchmark(req: Request, res: Response, next: NextFunction) {
    try {
      const courseId = req.body.courseId;
      const isCourseExists = await Course.findById(courseId);
      if (!isCourseExists) {
        return res.status(404).json({
          message: "Course is not found",
          success: false,
        });
      }
      const payload = {
        courseId: req.body.courseId,
        retakes: req.body.retakes,
        benchmark: req.body.benchmark,
      };

      const response = await courseService.createCourseBenchmark(payload);

      // SAVE THE CREATED BENCHMARK ON THE COURSE MODEL
      await Course.findByIdAndUpdate(
        courseId,
        {
          $set: { course_benchmark: response.data._id },
        },
        { new: true },
      );

      res.status(201).json({
        message: "Course Benchmark Created",
        success: true,
        data: response,
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create course benchmark",
      });
    }
  }

  async createCoursePricing(req: Request, res: Response, next: NextFunction) {
    try {
      const courseId = req.body.courseId;
      const course = await Course.findById(courseId);
      if (!course) {
        return res.status(404).json({ message: "No course found" });
      }
      const payload = {
        courseId: req.body.courseId,
        coursePricing: req.body.coursePrice,
        courseCoupon: req.body.courseCoupon,
      };

      const response = await courseService.createCoursePricing(payload);

      // SAVE THE CREATED COURSE PRICING ON THE COURSE MODEL
      await Course.findByIdAndUpdate(
        courseId,
        {
          $set: { course_price: response.data._id },
        },
        { new: true },
      );

      res.status(201).json({
        message: "Course Pricing Created",
        success: true,
        data: response,
      });
    } catch (error) {
      handleServiceResponse(
        ServiceResponse.failure(
          "An error occurred while creating course pricing",
          null,
          StatusCodes.INTERNAL_SERVER_ERROR,
        ),
        res,
      );
    }
  }

  async updateCoursePricing(req: Request, res: Response) {
    try {
      const id = req.body.course_price_id;
      const coursePrice = req.body.coursePrice;
      const courseId = req.body.courseId as string | undefined;

      let pricing;

      if (id) {
        pricing = await CoursePricing.findByIdAndUpdate(
          id,
          {
            coursePricing: coursePrice,
          },
          { new: true },
        );
      }

      if (!pricing) {
        if (!courseId) {
          return res
            .status(StatusCodes.BAD_REQUEST)
            .json({ message: "courseId is required when creating pricing" });
        }

        const course = await Course.findById(courseId);
        if (!course) {
          return res
            .status(StatusCodes.NOT_FOUND)
            .json({ message: "No course found" });
        }

        pricing = await CoursePricing.create({
          courseId,
          coursePricing: coursePrice,
          ...(req.body.courseCoupon
            ? { courseCoupon: req.body.courseCoupon }
            : {}),
        });
      }

      const pricingCourseId = pricing.courseId;
      await Course.findByIdAndUpdate(
        pricingCourseId,
        { $set: { course_price: pricing._id } },
        { new: true },
      );

      handleServiceResponse(
        ServiceResponse.success("Success", pricing, 200),
        res,
      );
    } catch (error) {
      handleServiceResponse(
        ServiceResponse.failure(
          "Internal Server Error",
          null,
          StatusCodes.INTERNAL_SERVER_ERROR,
        ),
        res,
      );
    }
  }

  async getCourseById(req: ExtendedRequest, res: Response, next: NextFunction) {
    const courseId = req.params.id;
    const userRole = req.query?.role as string;

    const serviceResponse = await courseService.fetchCourseById(
      courseId,
      userRole,
    );

    if (!serviceResponse.success) {
      return res.status(serviceResponse.statusCode).json(serviceResponse);
    }

    res.status(serviceResponse.statusCode).json(serviceResponse);
  }

  public async getCoursePricing(req: Request, res: Response) {
    const courseId = req.params.id;
    const serviceResponse =
      await courseService.fetchCoursePriceByCourseId(courseId);

    res.status(serviceResponse.statusCode).json(serviceResponse);
  }

  public async getCourseBenchmark(req: Request, res: Response) {
    const courseId = req.params.id;
    const serviceResponse =
      await courseService.fetchCourseBenchmarkByCourseId(courseId);

    res.status(serviceResponse.statusCode).json(serviceResponse);
  }

  async getCourseModules(req: Request, res: Response) {
    try {
      const courseId = req.params.id;

      const response = await courseService.getCourseModules(courseId);
      if (!response.success) {
        return handleServiceResponse(
          ServiceResponse.failure(
            response.message,
            null,
            StatusCodes.BAD_REQUEST,
          ),
          res,
        );
      }

      //idea: CREATE DTO
      handleServiceResponse(
        ServiceResponse.success("Success", { data: response }, StatusCodes.OK),
        res,
      );
    } catch (error) {
      handleServiceResponse(
        ServiceResponse.failure(
          "Internal Server Error",
          null,
          StatusCodes.INTERNAL_SERVER_ERROR,
        ),
        res,
      );
    }
  }

  async updateCourseController(req: Request, res: Response) {
    try {
      const id = req.params.id;
      const { courseTitle, courseDescription } = req.body;
      const payload = {};
      if (courseTitle) payload["title"] = courseTitle;
      if (courseDescription) payload["description"] = courseDescription;

      const course = await courseService.updateCourse(id, payload);
      if (!course.success) {
        return handleServiceResponse(
          ServiceResponse.failure(
            "Failed to update course",
            null,
            StatusCodes.BAD_REQUEST,
          ),
          res,
        );
      }

      handleServiceResponse(
        ServiceResponse.success("Success", course, StatusCodes.OK),
        res,
      );
    } catch (error) {
      handleServiceResponse(
        ServiceResponse.failure(
          "Internal Server Error",
          null,
          StatusCodes.INTERNAL_SERVER_ERROR,
        ),
        res,
      );
    }
  }

  // note: edit course benchmark
  async editCourseBenchmark(req: Request, res: Response) {
    try {
      const benchmark_id = req.body.benchmark_id;
      const payload = {
        retakes: req.body.retakes,
        benchmark: req.body.benchmark,
      };

      const response = await courseService.updateCourseBenchmark(
        payload,
        benchmark_id,
      );

      if (!response) {
        return handleServiceResponse(
          ServiceResponse.failure(
            "Failed to update course benchmark",
            null,
            StatusCodes.BAD_REQUEST,
          ),
          res,
        );
      }

      handleServiceResponse(
        ServiceResponse.success("Success", response, StatusCodes.OK),
        res,
      );
    } catch (error) {
      handleServiceResponse(
        ServiceResponse.failure(
          "Internal Server Error",
          null,
          StatusCodes.INTERNAL_SERVER_ERROR,
        ),
        res,
      );
    }
  }

  async publishCourse(req: Request, res: Response) {
    try {
      const courseId = req.params.id;
      const course = await courseService.publishCourse(courseId);
      if (!course.success) {
        return handleServiceResponse(
          ServiceResponse.failure(
            "Failed to publish course",
            null,
            StatusCodes.BAD_REQUEST,
          ),
          res,
        );
      }
      handleServiceResponse(
        ServiceResponse.success("Success", course, StatusCodes.OK),
        res,
      );
    } catch (error) {
      handleServiceResponse(
        ServiceResponse.failure(
          "Internal Server Error",
          null,
          StatusCodes.INTERNAL_SERVER_ERROR,
        ),
        res,
      );
    }
  }

  // refactor: remove this code, I don't think I am using it
  async uploadCourseCertificate(req: Request, res: Response) {
    try {
      if (!req.file) {
        return handleServiceResponse(
          ServiceResponse.failure(
            "No file uploaded",
            null,
            StatusCodes.BAD_REQUEST,
          ),
          res,
        );
      }

      const cloudinary_image = await uploadToCloudinary(req.file.path, {
        folderName: "certificates",
        resourceType: "image",
      });

      if (!cloudinary_image) {
        return handleServiceResponse(
          ServiceResponse.failure(
            "Failed to upload course image",
            null,
            StatusCodes.BAD_REQUEST,
          ),
          res,
        );
      }

      // const course = await Course.findByIdAndUpdate(
      //   req.params.id,
      //   {
      //     $set: { certificate: cloudinary_image },
      //   },
      //   { new: true }
      // );

      const course = await courseService.uploadCourseCertificate(
        cloudinary_image,
        req.params.id,
      );

      if (!course) {
        return handleServiceResponse(
          ServiceResponse.failure("Failed", null, StatusCodes.NOT_FOUND),
          res,
        );
      }

      handleServiceResponse(
        ServiceResponse.success(
          "Certificate Uploaded successfully",
          course,
          StatusCodes.OK,
        ),
        res,
      );
    } catch (error) {
      handleServiceResponse(
        ServiceResponse.failure(
          "Internal Server Error",
          null,
          StatusCodes.INTERNAL_SERVER_ERROR,
        ),
        res,
      );
    }
  }

  async getCourseAssesments(req: ExtendedRequest, res: Response) {
    try {
      const courseId = req.params.id;
      const userRole = req.user?.role as string;
      const response = await courseService.fetchCourseAssesments(
        courseId,
        userRole,
      );
      if (!response.success) {
        return handleServiceResponse(
          ServiceResponse.failure(
            response.message,
            null,
            StatusCodes.BAD_REQUEST,
          ),
          res,
        );
      }

      handleServiceResponse(
        ServiceResponse.success(
          "Success",
          { data: response.data },
          StatusCodes.OK,
        ),
        res,
      );
    } catch (error) {
      handleServiceResponse(
        ServiceResponse.failure(
          "Internal Server Error",
          null,
          StatusCodes.INTERNAL_SERVER_ERROR,
        ),
        res,
      );
    }
  }

  public async submitCourseAssessment(req: ExtendedRequest, res: Response) {
    const userId = req.user?._id;
    const courseId = req.params.id;
    const { answers } = req.body;

    const response = await courseService.submitCourseAssessment(
      userId,
      courseId,
      answers,
    );

    res.status(response.statusCode).json(response);
  }

  async launchCourse(req: ExtendedRequest, res: Response) {
    const { courseId } = req.params;
    const userId = req.user?._id;
    const response = await courseService.launchCourse(courseId, userId);

    res.status(response.statusCode).json(response);
  }

  async getCourseSummary(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const response = await courseService.fetchCourseSummary(id);
      if (!response.success) {
        handleServiceResponse(
          ServiceResponse.failure(
            response.message,
            null,
            StatusCodes.BAD_REQUEST,
          ),
          res,
        );
      }

      handleServiceResponse(
        ServiceResponse.success(
          "Success",
          { data: response.data },
          StatusCodes.OK,
        ),
        res,
      );
    } catch (error) {
      handleServiceResponse(
        ServiceResponse.failure(
          "Internal Server Error",
          null,
          StatusCodes.INTERNAL_SERVER_ERROR,
        ),
        res,
      );
    }
  }

  public async bulkAssigningOfCourses(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    if (!req.files?.file) {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ message: "No file uploaded" });
    }
    const raw = req.files.file as UploadedFile | UploadedFile[];
    const uploadFile = Array.isArray(raw) ? raw[0] : raw;

    const allowed = [
      "text/csv",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];
    if (!allowed.includes(uploadFile.mimetype)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message:
          "Invalid file type. Please upload a CSV or Excel (.xlsx/.xls) file.",
      });
    }

    const rawCourses = req.body["courseIds[]"] ?? req.body.courseIds;
    const durationDays = req.body.durationDays;
    const isIcsStaff = req.body.isIcsStaff;

    const normalizedBody = {
      ...req.body,
      durationDays: parseInt(req.body.durationDays),
      isIcsStaff: req.body.isIcsStaff === "true" ? true : false,
      courseIds: Array.isArray(rawCourses)
        ? rawCourses
        : rawCourses
          ? [rawCourses]
          : [],
    };

    try {
      const validated = bulkAssignCourseSchema.parse(normalizedBody);

      const serviceResponse = await courseService.triggerBulkAssignment({
        file: uploadFile,
        courseIds: validated.courseIds,
        durationDays: durationDays,
        isIcsStaff: isIcsStaff,
      });

      res.status(serviceResponse.statusCode).json(serviceResponse);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors.map((err) => ({
            field: err.path.join("."),
            message: err.message,
          })),
        });
      }

      const statusCode = error.statusCode || 400;
      return res.status(statusCode).json({
        message:
          error.message || "An error occurred while processing the request.",
      });
    }
  }

  public async deleteCourse(req: Request, res: Response) {
    const courseId = req.params.id;

    const serviceResponse =
      await courseService.deleteCourseByCourseId(courseId);

    res.status(serviceResponse.statusCode).json(serviceResponse);
  }

  public async softDeleteCourse(req: Request, res: Response) {
    const courseId = req.params.id;

    const serviceResponse = await courseService.softDelete(courseId);
    res.status(serviceResponse.statusCode).json(serviceResponse);
  }

  public updateCourseImage = async (req: Request, res: Response) => {
    const courseId = req.params.courseId;
    const { image, publicId } = req.body;
    const result = await courseService.updateCourseImage(
      courseId,
      image as string,
      publicId,
    );
    res.status(200).json(result);
  };
}

const courseController = new CourseController();
export { courseController };
export default CourseController;
