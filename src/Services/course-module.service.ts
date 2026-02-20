import createDOMPurify from "dompurify";
import { UploadedFile } from "express-fileupload";
import { StatusCodes } from "http-status-codes";
import { JSDOM } from "jsdom";
import { APP_CONFIG } from "../config/app.config";
import { ProcessedSection } from "../interfaces/course-module.interface";
import Course from "../models/Course";
import { CourseModule } from "../models/course-module.model";
import Progress, { CourseStatusEnum } from "../models/progress.model";
import { moveToSafeTemp, uploadToCloudinary } from "../utils/cloudinary.utils";
import { ServiceResponse } from "../utils/service-response";

class CourseModuleService {
  /**
   * Creates a new course module with the provided details and saves it to the database.
   *
   * @param {Object} payload - The details of the course module to be created.
   * @param {string} payload.courseId - The ID of the associated course.
   * @param {string} payload.title - The title of the course module.
   * @param {number} payload.order - The order of the module within the course.
   * @param {Array} payload.contentSections - The content sections included in the module.
   * @returns {Promise<Object>} - A promise that resolves to an object containing a success message and the created course module data.
   */

  public async createCourse(payload: any) {
    const courseModule = new CourseModule({
      courseId: payload.courseId,
      title: payload.title,
      order: payload.order,
      contentSections: payload.contentSections,
    });
    const data = await courseModule.save();

    return {
      message: "Course Module Created successfully",
      success: true,
      data,
    };
  }

  /**
   * Sanitizes the given HTML content using the dompurify library and
   * configuration defined in the APP_CONFIG.PURIFY_CONFIG constant.
   *
   * @param {string} content - The HTML content to be sanitized.
   * @returns {Promise<string>} - A promise that resolves with the sanitized
   * content.
   */
  public async processHtmlContent(content: string): Promise<string> {
    try {
      const window = new JSDOM("").window;
      const domPurify = createDOMPurify(window);
      const sanitizedContent = domPurify.sanitize(
        content,
        APP_CONFIG.PURIFY_CONFIG,
      );
      return sanitizedContent;
    } catch (error) {
      throw new Error("Failed to process HTML content, processHtmlContent");
    }
  }

  /**
   * Handles file upload to Cloudinary
   *
   * @param {string} folderName - The folder name where the file will be uploaded.
   * @param {string} contentType - The type of the content, either 'video' or
   * 'image'.
   * @param {any} matchingFile - The file to be uploaded.
   * @returns {Promise<string>} - A promise that resolves with the URL of the
   * uploaded file.
   */
  public async handleFileUpload(
    folderName: string,
    contentType: string,
    matchingFile: any,
  ) {
    try {
      const safePath = await moveToSafeTemp(matchingFile);
      const cloudinary_content = await uploadToCloudinary(safePath, {
        folderName: folderName,
        resourceType: contentType === "video" ? "video" : "image",
      });

      return cloudinary_content;
    } catch (error) {
      console.log("error", error);
      throw new Error("Failed to upload file to cloudinary, handleFileUpload");
    }
  }

  public async processSection(
    contentSections: any,
    filesMap: { [field: string]: UploadedFile | UploadedFile[] },
  ): Promise<ProcessedSection> {
    const processed = await Promise.all(
      contentSections.map(async (section) => {
        // pull the file (if any) out of the map by section.id
        const maybe = filesMap[section.id];
        const matchingFile = Array.isArray(maybe) ? maybe[0] : maybe;

        // default to whatever the client sent
        let finalContent = section.content;

        switch (section.type) {
          case "image":
          case "video":
            if (matchingFile) {
              finalContent = await this.handleFileUpload(
                "COURSE_MODULE",
                section.type,
                matchingFile,
              );
            }
            break;

          case "quote":
            if (matchingFile) {
              finalContent = await this.handleFileUpload(
                "COURSE_MODULE",
                "image",
                matchingFile,
              );
            }
            break;

          case "knowledge-check":
            // send only the first item
            finalContent = Array.isArray(section.content)
              ? section.content[0]
              : section.content;
            break;

          case "list":
            finalContent = await this.processHtmlContent(section.content);
            break;

          // text and any other types just fall through
        }

        return {
          sectionId: section.id, // **always** set this
          type: section.type,
          content: finalContent,
        };
      }),
    );

    return { content: processed };
  }

  public async updateModule(
    moduleId: string,
    title: string | undefined,
    rawSections: any[],
    filesMap: { [key: string]: UploadedFile | UploadedFile[] },
  ): Promise<typeof CourseModule.prototype | null> {
    // 1) process sections
    const { content } = await this.processSection(rawSections, filesMap);

    // 2) replace and return updated doc
    const updated = await CourseModule.findByIdAndUpdate(
      moduleId,
      {
        ...(title !== undefined && { title }),
        contentSections: content,
      },
      { new: true, runValidators: true },
    ).exec();

    return updated;
  }

  public async fetchModuleById(id: string) {
    try {
      const module = await CourseModule.findById({ _id: id });
      if (!module) {
        return ServiceResponse.failure(
          "Module not found",
          null,
          StatusCodes.NOT_FOUND,
        );
      }

      // get the course that this module belongs to
      const course = await Course.findById(
        { _id: module.courseId },
        { course_modules: 1 },
      ).populate("course_modules");

      let nextModuleId: string | null = null;
      let prevModuleId: string | null = null;
      let hasNextModule = false;

      if (course && course.course_modules && course.course_modules.length > 0) {
        // Find the index of the current module in the course modules array
        const moduleIndex = course.course_modules.findIndex(
          (m) => m._id.toString() === id,
        );

        if (moduleIndex > 0) {
          prevModuleId = course.course_modules[moduleIndex - 1]._id.toString();
        }

        // If the current module is found and it's not the last one
        if (
          moduleIndex !== -1 &&
          moduleIndex < course.course_modules.length - 1
        ) {
          nextModuleId = course.course_modules[moduleIndex + 1]._id.toString();
          hasNextModule = true;
        }
      }

      // attach the next module to this response
      return ServiceResponse.success(
        "Success fetching module",
        {
          data: {
            module,
            nextModule: hasNextModule ? nextModuleId : null,
            prevModule: prevModuleId,
            hasNextModule,
            assessment: course?.course_assessment,
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

  public async markModuleAsCompleted(userId: string, moduleId: string) {
    const module = await CourseModule.findById(moduleId);
    if (!module) {
      return ServiceResponse.failure(
        "Module not found",
        null,
        StatusCodes.NOT_FOUND,
      );
    }

    const progressDoc = await Progress.findOne({
      user: userId,
      course: module.courseId,
    });
    if (!progressDoc) {
      return ServiceResponse.failure(
        "No progress found",
        null,
        StatusCodes.NOT_FOUND,
      );
    }

    const moduleItem = progressDoc.modules.find(
      (m) => m.module.toString() === moduleId,
    );
    if (!moduleItem) {
      return ServiceResponse.failure(
        "Module not found in the progress document.",
        null,
        StatusCodes.NOT_FOUND,
      );
    }

    if (moduleItem.completed) {
      return ServiceResponse.success(
        "Module already marked as completed.",
        { data: progressDoc },
        StatusCodes.OK,
      );
    }

    moduleItem.completed = true;
    moduleItem.completedAt = new Date();

    const totalModules = progressDoc.modules.length;
    const completedModules = progressDoc.modules.filter(
      (m) => m.completed,
    ).length;
    const progressPercentage = (completedModules / totalModules) * 100;
    progressDoc.progressPercentage = progressPercentage;

    if (progressPercentage === 100) {
      progressDoc.status = CourseStatusEnum.COMPLETED;
      progressDoc.completedAt = new Date();
    } else if (completedModules > 0) {
      progressDoc.status = CourseStatusEnum.IN_PROGRESS;
      progressDoc.completedAt = undefined;
    } else {
      progressDoc.status = CourseStatusEnum.NOT_STARTED;
      progressDoc.completedAt = undefined;
    }

    await progressDoc.save();

    return ServiceResponse.success(
      "Progress updated successfully.",
      { data: progressDoc },
      StatusCodes.OK,
    );
  }

  public async deleteModule(moduleId: string) {
    const response = await CourseModule.findByIdAndDelete({
      _id: moduleId,
    });

    if (!response) {
      return ServiceResponse.failure(
        "Course module not found",
        null,
        StatusCodes.BAD_REQUEST,
      );
    }
    return ServiceResponse.success(
      "Module deleted successfully.",
      response,
      StatusCodes.ACCEPTED,
    );
  }
}

export const courseModuleService = new CourseModuleService();
export default CourseModuleService;
