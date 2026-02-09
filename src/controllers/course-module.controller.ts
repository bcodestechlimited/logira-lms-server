import { Request, Response } from "express";
import { FileArray } from "express-fileupload";
import { StatusCodes } from "http-status-codes";
import { ExtendedRequest } from "../interfaces/auth.interface";
import { handleServiceResponse } from "../Middlewares/validation.middleware";
import Course from "../models/Course";
import { CourseModule } from "../models/course-module.model";
import CourseModuleService from "../Services/course-module.service";
import { ServiceResponse } from "../utils/service-response";

const courseModuleService = new CourseModuleService();
export class CourseModuleController {
  public async create(req: Request, res: Response) {
    try {
      const { courseId, title } = req.body;
      const contentSections = JSON.parse(req.body.contentSections);

      const course = await Course.findById(courseId);
      if (!course) {
        return res.status(404).json({
          message: "No course found",
          success: false,
        });
      }

      const filesMap = (req.files as unknown as FileArray) || {};
      const processedSections = await courseModuleService.processSection(
        contentSections,
        filesMap,
      );

      const lastModule = await CourseModule.findOne({ courseId })
        .sort({ order: -1 })
        .limit(1);
      const order = lastModule ? lastModule.order + 1 : 1;
      const payload = {
        courseId,
        title,
        order,
        contentSections: processedSections.content,
      };
      const response = await courseModuleService.createCourse(payload);

      // SAVE THE CREATED MODULE IN THE COURSE MODEL
      const updatedCourse = await Course.findByIdAndUpdate(
        courseId,
        {
          $push: { course_modules: response.data._id },
        },
        { new: true },
      );

      handleServiceResponse(
        ServiceResponse.success(
          `${title} module created`,
          { response, updatedCourse },
          StatusCodes.CREATED,
        ),
        res,
      );
    } catch (error) {
      handleServiceResponse(
        ServiceResponse.failure(
          error instanceof Error
            ? error.message
            : "Failed to create course module",
          null,
          StatusCodes.INTERNAL_SERVER_ERROR,
        ),
        res,
      );
    }
  }

  public async update(req: Request, res: Response) {
    try {
      const moduleId = req.params.id;
      const title = req.body.title as string | undefined;

      // parse the JSON array we stringified on the client
      const rawSections: any[] = req.body.contentSections
        ? JSON.parse(req.body.contentSections)
        : [];

      // build a map of uploads: fieldName → UploadedFile|UploadedFile[]
      const filesMap = (req.files as unknown as FileArray) || {};
      const updated = await courseModuleService.updateModule(
        moduleId,
        title,
        rawSections,
        filesMap,
      );

      if (!updated) {
        return handleServiceResponse(
          ServiceResponse.failure("Course module not found", null, 404),
          res,
        );
      }

      // **use the updated doc** when you respond
      return handleServiceResponse(
        ServiceResponse.success("Course module updated", updated, 200),
        res,
      );
    } catch (error) {
      return handleServiceResponse(
        ServiceResponse.failure("Failed to update course module", null, 500),
        res,
      );
    }
  }

  public async getCourseModuleById(req: Request, res: Response) {
    const { id } = req.params;
    const response = await courseModuleService.fetchModuleById(id);
    res.status(response.statusCode).json(response);
  }

  public async markModuleCompleted(req: ExtendedRequest, res: Response) {
    const moduleId = req.params.moduleId;
    const userId = req.user?._id;

    const response = await courseModuleService.markModuleAsCompleted(
      userId,
      moduleId,
    );

    res.status(response.statusCode).json(response);
  }

  public async deleteCourseModule(req: Request, res: Response) {
    const moduleId = req.params.id;
    const response = await courseModuleService.deleteModule(moduleId);
    res.status(response.statusCode).json(response);
  }
}

export const courseModuleController = new CourseModuleController();
export default CourseModuleController;
