import autoBind from "auto-bind";
import { UploadedFile } from "express-fileupload";
import { v4 as uuidv4 } from "uuid";
import { APP_CONFIG } from "../../config/app.config";
import { CouponStatusEnum, DiscountType } from "../../models/coupon.model";
import Course from "../../models/Course";
import User from "../../models/User";
import { emailService } from "../../Services/mail.service";
import { ApiError, ApiSuccess } from "../../utils/response-handler";
import { parseCouponRecipientsFromExcel } from "./coupon.helper";
import {
  CouponInterface,
  CourseCouponAdminQuery,
  CoursePricingDoc,
  VerifyCouponCodeDTO,
} from "./coupon.interface";
import CourseCoupon from "./coupon.model";
import { SendCouponToUsersDTO } from "./coupon.schema";
import { CourseCheckoutPayload } from "../payment/payment-v2.interface";
import { ServiceResponse } from "../../utils/service-response";
import { StatusCodes } from "http-status-codes";
import mongoose from "mongoose";
import { coerceNumber } from "../../utils/course-helpers";
import { toDate } from "../../utils/parse.helpers";
import { paginate } from "../../utils/paginate";

export class CouponService {
  private ALLOWED_COUPON_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  private COUPON_LENGTH = 12;

  constructor() {
    autoBind(this);
  }

  public async sendCouponToUsersForACourse({
    file,
    user,
    dto,
  }: {
    file: UploadedFile;
    user: any;
    dto: SendCouponToUsersDTO;
  }) {
    if (!file) {
      throw ApiError.badRequest("No file uploaded");
    }

    const { emails, duplicates, invalidEmails, totalRows } =
      await parseCouponRecipientsFromExcel(file);

    const course = await Course.findById(dto.courseId).select("title").lean();
    if (!course) {
      throw ApiError.notFound("Course not found");
    }
    const normalizedEmails = emails.map((e) => e.trim().toLowerCase());

    const users = await User.find({ email: { $in: normalizedEmails } }).select(
      "_id firstName lastName email",
    );

    const userByEmail = new Map<string, any>();
    for (const u of users) userByEmail.set(String(u.email).toLowerCase(), u);

    const notFoundEmails: string[] = [];
    const alreadyIssued: string[] = [];
    const issued: Array<{ email: string; couponCode: string }> = [];
    const failed: Array<{ email: string; reason: string }> = [];

    const COUPON_PREFIX = String(dto.discountType)
      .substring(0, 3)
      .toUpperCase();

    for (const email of normalizedEmails) {
      const foundUser = userByEmail.get(email);
      if (!foundUser) {
        notFoundEmails.push(email);
        continue;
      }

      const existing = await CourseCoupon.findOne({
        courseId: dto.courseId,
        recipientEmail: email,
        isDeleted: false,
      })
        .select("_id couponCode")
        .lean();

      if (existing) {
        alreadyIssued.push(email);
        continue;
      }

      const couponCode = await this.generateUniqueCouponCode(COUPON_PREFIX);
      if (!couponCode) {
        failed.push({ email, reason: "Failed to generate unique coupon code" });
        continue;
      }

      try {
        const coupon = await CourseCoupon.create({
          couponCode,
          discountType: dto.discountType,
          percentage: dto.percentage,
          status: CouponStatusEnum.ACTIVE,
          maximumUsage: 1,
          currentUses: 0,
          expirationDate: dto.expirationDate,
          courseId: dto.courseId,
          users: [foundUser._id],
          recipientEmail: email,
          issuedToUserId: foundUser._id,
        });

        const emailPayload = {
          subject: `Your coupon for ${course.title}`,
          template: "course-coupon",
          to: email,
          variables: {
            userName: foundUser.firstName || "there",
            companyName: APP_CONFIG.COMPANY_NAME,
            logoUrl: APP_CONFIG.LOGO_URL,
            supportEmail: APP_CONFIG.SUPPORT_EMAIL,
            couponCode: coupon.couponCode,
            courseTitle: course.title,
            expiryDate: new Date(dto.expirationDate).toDateString(),
            courseUrl: `${APP_CONFIG.CLIENT_FRONTEND_BASE_URL}/courses/${dto.courseId}`,
          },
        };

        await emailService.sendEmailTemplate(emailPayload);
        issued.push({ email, couponCode: coupon.couponCode });
      } catch (err: any) {
        const message = err?.message ? String(err.message) : "Unknown error";
        failed.push({ email, reason: message });
      }
    }

    return ApiSuccess.ok("Coupons processed successfully", {
      totalRows,
      validEmails: emails.length,
      invalidEmails,
      duplicates,
      notFoundEmails,
      alreadyIssued,
      issuedCount: issued.length,
      failed,
    });
  }

  private generateCouponCode = () => {
    const raw = uuidv4().replace(/-/g, "");
    return raw.slice(0, this.COUPON_LENGTH).toUpperCase();
  };

  private addChecksum = (code: string) => {
    let sum = 0;
    for (let i = 0; i < code.length; i++) {
      const charValue = this.ALLOWED_COUPON_CHARS.indexOf(code[i]);
      sum += i % 2 === 0 ? charValue * 2 : charValue;
    }
    const checksumChar =
      this.ALLOWED_COUPON_CHARS[sum % this.ALLOWED_COUPON_CHARS.length];
    return `${code}${checksumChar}`;
  };

  public generateUniqueCouponCode = async (
    prefix: string = "",
    maxAttempts: number = 5,
  ) => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const randomCode = this.generateCouponCode();
      const codeWithChecksum = this.addChecksum(randomCode);
      const finalCode = prefix
        ? `${prefix}-${codeWithChecksum}`
        : codeWithChecksum;

      const existingCoupon = await CourseCoupon.findOne({
        couponCode: finalCode,
      })
        .select("_id")
        .lean();
      if (!existingCoupon) return finalCode;
    }

    return null;
  };

  private validateCouponFormat = (code: string) => {
    if (!code) return false;

    const parts = code.split("-");
    const codeToValidate = parts.length > 1 ? parts[1] : code;

    if (codeToValidate.length !== this.COUPON_LENGTH + 1) return false;

    const validChars = codeToValidate
      .split("")
      .every((char) => this.ALLOWED_COUPON_CHARS.includes(char));

    if (!validChars) return false;

    const codeWithoutChecksum = codeToValidate.slice(0, -1);
    const expected = this.addChecksum(codeWithoutChecksum);

    return expected === codeToValidate;
  };

  private isCouponValid = (coupon: {
    status: CouponStatusEnum;
    expirationDate: Date;
    currentUses: number;
    maximumUsage: number;
    usedAt?: Date | null;
  }) => {
    if (coupon.status !== CouponStatusEnum.ACTIVE) {
      return { success: false, message: "This coupon is no longer valid" };
    }

    if (coupon.expirationDate.getTime() < Date.now()) {
      return { success: false, message: "This coupon has expired" };
    }

    if (coupon.usedAt) {
      return { success: false, message: "This coupon has already been used" };
    }

    if (coupon.currentUses >= coupon.maximumUsage) {
      return { success: false, message: "This coupon is no longer valid" };
    }

    return { success: true, message: "Coupon is valid" };
  };

  private calculateDiscountPrice = (
    coursePrice: number,
    couponPercentage: number,
  ) => {
    const discountAmount = (coursePrice * couponPercentage) / 100;
    const finalPrice = coursePrice - discountAmount;

    return { price: finalPrice, discountAmount };
  };

  private couponBelongsToUser = (
    coupon: {
      issuedToUserId?: unknown | null;
      recipientEmail?: string;
      users?: unknown[];
    },
    user: { _id: unknown; email?: string },
  ) => {
    const couponUserId = coupon.issuedToUserId
      ? String(coupon.issuedToUserId)
      : "";
    const userId = user?._id ? String(user._id) : "";

    if (couponUserId && userId && couponUserId === userId) return true;

    const couponEmail = (coupon.recipientEmail ?? "").trim().toLowerCase();
    const userEmail = (user.email ?? "").trim().toLowerCase();

    if (couponEmail && userEmail && couponEmail === userEmail) return true;

    const users = Array.isArray(coupon.users) ? coupon.users : [];
    return users.some((id) => String(id) === userId);
  };

  public verifyCouponCode = async ({
    dto,
    user,
  }: {
    dto: VerifyCouponCodeDTO;
    user: { _id: unknown; email?: string };
  }) => {
    const couponCode = dto.couponCode.trim().toUpperCase();

    if (!this.validateCouponFormat(couponCode)) {
      return ServiceResponse.failure(
        "Invalid coupon code format",
        null,
        StatusCodes.BAD_REQUEST,
      );
    }

    const coupon = await CourseCoupon.findOne({
      couponCode,
      isDeleted: false,
    }).select(
      "couponCode percentage status expirationDate maximumUsage currentUses courseId recipientEmail issuedToUserId usedAt usedBy users",
    );

    if (!coupon) {
      return ServiceResponse.failure(
        "No coupon found",
        null,
        StatusCodes.BAD_REQUEST,
      );
    }

    const validity = this.isCouponValid({
      status: coupon.status,
      expirationDate: coupon.expirationDate,
      currentUses: coupon.currentUses,
      maximumUsage: coupon.maximumUsage,
      usedAt: coupon.usedAt,
    });

    if (!validity.success) {
      return ServiceResponse.failure(
        validity.message,
        null,
        StatusCodes.BAD_REQUEST,
      );
    }

    if (String(coupon.courseId) !== String(dto.courseId)) {
      return ServiceResponse.failure(
        "Coupon is not applicable to this course",
        null,
        StatusCodes.BAD_REQUEST,
      );
    }

    if (!this.couponBelongsToUser(coupon, user)) {
      return ServiceResponse.failure(
        "Coupon is not assigned to this user",
        null,
        StatusCodes.BAD_REQUEST,
      );
    }

    const course = await Course.findById(dto.courseId).populate({
      path: "course_price",
    });

    if (!course) {
      return ServiceResponse.failure(
        "Course not found",
        null,
        StatusCodes.BAD_REQUEST,
      );
    }

    const coursePriceRaw = course.course_price as unknown;

    const coursePrice =
      coursePriceRaw &&
      typeof coursePriceRaw === "object" &&
      "coursePricing" in (coursePriceRaw as Record<string, unknown>)
        ? Number((coursePriceRaw as CoursePricingDoc).coursePricing)
        : null;

    if (coursePrice == null || Number.isNaN(coursePrice)) {
      return ServiceResponse.failure(
        "Course pricing not found",
        null,
        StatusCodes.BAD_REQUEST,
      );
    }

    const discounted = this.calculateDiscountPrice(
      coursePrice,
      coupon.percentage,
    );

    return ServiceResponse.success(
      "Coupon is valid",
      {
        couponCode: coupon.couponCode,
        courseId: String(coupon.courseId),
        coursePrice,
        discountedPrice: discounted.price,
        couponDiscount: discounted.discountAmount,
        percentage: coupon.percentage,
        expirationDate: coupon.expirationDate,
      },
      StatusCodes.OK,
    );
  };

  private getCoursePrice = async (courseId: string) => {
    const course = await Course.findById(courseId).populate({
      path: "course_price",
    });

    if (!course) {
      return { course: null, coursePrice: null };
    }

    const coursePriceRaw = course.course_price as unknown;

    const coursePrice =
      coursePriceRaw &&
      typeof coursePriceRaw === "object" &&
      "coursePricing" in (coursePriceRaw as Record<string, unknown>)
        ? Number((coursePriceRaw as CoursePricingDoc).coursePricing)
        : null;

    if (coursePrice == null || Number.isNaN(coursePrice)) {
      return { course, coursePrice: null };
    }

    return { course, coursePrice };
  };

  public enrollUserWithPerpetualAccess = async (
    userId: string,
    courseId: string,
  ) => {
    const user = await User.findById(userId);
    if (!user) {
      return ServiceResponse.failure(
        "User not found",
        null,
        StatusCodes.NOT_FOUND,
      );
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return ServiceResponse.failure(
        "Course not found",
        null,
        StatusCodes.NOT_FOUND,
      );
    }

    const existingEnrollment = user.courseEnrollments?.find(
      (enrollment) => String(enrollment.course) === String(courseId),
    );

    if (existingEnrollment) {
      existingEnrollment.expiresAt = new Date("2999-12-31");
    } else {
      if (!user.courseEnrollments) user.courseEnrollments = [];

      user.courseEnrollments.push({
        course: new mongoose.Types.ObjectId(courseId),
        expiresAt: new Date("2999-12-31"),
        isAssigned: false,
      });

      const alreadyParticipant = course.participants.some(
        (id) => String(id) === String(userId),
      );

      if (!alreadyParticipant) {
        course.participants.push(new mongoose.Types.ObjectId(userId));
      }
    }

    if (user.expiredCourses?.some((id) => String(id) === String(courseId))) {
      user.expiredCourses = user.expiredCourses.filter(
        (id) => String(id) !== String(courseId),
      );
    }

    await Promise.all([user.save(), course.save()]);

    return {
      success: true,
      message: "User enrolled with perpetual access",
    };
  };

  public courseCheckout = async (payload: CourseCheckoutPayload) => {
    try {
      const { courseId, couponCode } = payload;

      const { course, coursePrice } = await this.getCoursePrice(courseId);

      if (!course) {
        return ServiceResponse.failure(
          "No course found",
          null,
          StatusCodes.NOT_FOUND,
        );
      }

      if (coursePrice == null) {
        return ServiceResponse.failure(
          "Course pricing information not available",
          null,
          StatusCodes.BAD_REQUEST,
        );
      }

      let finalPrice = coursePrice;
      let discount = 0;
      let isFreeEnrollment = false;

      if (couponCode) {
        const normalizedCode = couponCode.trim().toUpperCase();

        if (!this.validateCouponFormat(normalizedCode)) {
          return ServiceResponse.failure(
            "Invalid coupon code format",
            null,
            StatusCodes.BAD_REQUEST,
          );
        }

        const coupon = await CourseCoupon.findOne({
          couponCode: normalizedCode,
          courseId,
          isDeleted: false,
        }).select(
          "couponCode percentage status expirationDate maximumUsage currentUses courseId recipientEmail issuedToUserId usedAt usedBy users",
        );

        if (!coupon) {
          return ServiceResponse.failure(
            "Invalid coupon code",
            null,
            StatusCodes.BAD_REQUEST,
          );
        }

        const validity = this.isCouponValid({
          status: coupon.status,
          expirationDate: coupon.expirationDate,
          currentUses: coupon.currentUses,
          maximumUsage: coupon.maximumUsage,
          usedAt: coupon.usedAt,
        });

        if (!validity.success) {
          return ServiceResponse.failure(
            validity.message,
            null,
            StatusCodes.BAD_REQUEST,
          );
        }

        const belongsToUser = this.couponBelongsToUser(coupon, {
          _id: payload.userId,
          email: payload.email,
        });

        if (!belongsToUser) {
          return ServiceResponse.failure(
            "Coupon is not assigned to this user",
            null,
            StatusCodes.BAD_REQUEST,
          );
        }

        const priceDetails = this.calculateDiscountPrice(
          coursePrice,
          coupon.percentage,
        );

        finalPrice = priceDetails.price;
        discount = priceDetails.discountAmount;

        if (coupon.percentage === 100 || finalPrice <= 0) {
          isFreeEnrollment = true;

          const now = new Date();

          const consumed = await CourseCoupon.findOneAndUpdate(
            {
              _id: coupon._id,
              status: CouponStatusEnum.ACTIVE,
              isDeleted: false,
              usedAt: null,
              currentUses: { $lt: coupon.maximumUsage },
            },
            {
              $set: {
                currentUses: 1,
                usedAt: now,
                usedBy: new mongoose.Types.ObjectId(payload.userId),
                status: CouponStatusEnum.INACTIVE,
              },
            },
            { new: true },
          );

          if (!consumed) {
            return ServiceResponse.failure(
              "This coupon is no longer valid",
              null,
              StatusCodes.BAD_REQUEST,
            );
          }

          await this.enrollUserWithPerpetualAccess(payload.userId, courseId);

          await emailService.sendEmailTemplate({
            subject: `Welcome Aboard! Your ${course.title} Journey Begins Now`,
            template: "user-enrolled",
            to: payload.email,
            variables: {
              userName: payload.firstName,
              courseName: course.title,
              instructorName: APP_CONFIG.COMPANY_NAME,
              dashboardUrl: `${APP_CONFIG.CLIENT_FRONTEND_BASE_URL}/dashboard`,
              helpCenterEmail: APP_CONFIG.SUPPORT_EMAIL,
            },
          });

          return ServiceResponse.success(
            "You have been successfully enrolled in this course",
            {
              data: {
                enrolled: true,
                originalPrice: coursePrice,
                finalPrice: 0,
                discount: coursePrice,
              },
            },
            StatusCodes.OK,
          );
        }
      }

      return ServiceResponse.success(
        "Pricing information retrieved successfully",
        {
          data: {
            enrolled: false,
            originalPrice: coursePrice,
            finalPrice: finalPrice > 0 ? finalPrice : coursePrice,
            discount: discount > 0 ? discount : coursePrice - finalPrice,
            requiresPayment: true,
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
  };

  public fetchCoupons = async (query: CourseCouponAdminQuery) => {
    const page = coerceNumber(query.page, 1);
    const limit = coerceNumber(query.limit, 20);
    const search = (query.search ?? "").trim();

    const filterQuery: Record<string, unknown> = { isDeleted: false };

    if (
      query.status &&
      Object.values(CouponStatusEnum).includes(query.status)
    ) {
      filterQuery.status = query.status;
    }

    if (
      query.discountType &&
      Object.values(DiscountType).includes(query.discountType)
    ) {
      filterQuery.discountType = query.discountType;
    }

    if (query.courseId) {
      filterQuery.courseId = query.courseId;
    }

    if (query.used === "true") {
      filterQuery.usedAt = { $ne: null };
    }

    if (query.used === "false") {
      filterQuery.usedAt = null;
    }

    const start = toDate(query.startDate);
    const end = toDate(query.endDate);

    if (start || end) {
      filterQuery.expirationDate = {};
      if (start)
        (filterQuery.expirationDate as Record<string, unknown>).$gte = start;
      if (end)
        (filterQuery.expirationDate as Record<string, unknown>).$lte = end;
    }

    if (search) {
      filterQuery.$or = [
        { couponCode: { $regex: String(search), $options: "i" } },
        { recipientEmail: { $regex: String(search), $options: "i" } },
      ];
    }

    const { documents, pagination } = await paginate<CouponInterface>({
      model: CourseCoupon,
      query: filterQuery,
      page,
      limit,
      sort: { createdAt: -1 },
      populateOptions: [
        { path: "courseId", select: "title image" },
        { path: "issuedToUserId", select: "firstName lastName email" },
      ],
      select: ["-users"],
    });

    return ApiSuccess.ok("Coupons fetched successfully", {
      coupons: documents,
      pagination,
    });
  };

  public getCouponAnalytics = async () => {
    const data = await CourseCoupon.aggregate([
      { $match: { isDeleted: false } },
      {
        $facet: {
          allCoupons: [{ $count: "count" }],
          usedCoupons: [
            { $match: { usedAt: { $ne: null } } },
            { $count: "count" },
          ],
          activeCoupons: [
            { $match: { status: CouponStatusEnum.ACTIVE, usedAt: null } },
            { $count: "count" },
          ],
        },
      },
      {
        $project: {
          allCoupons: {
            $ifNull: [{ $arrayElemAt: ["$allCoupons.count", 0] }, 0],
          },
          usedCoupons: {
            $ifNull: [{ $arrayElemAt: ["$usedCoupons.count", 0] }, 0],
          },
          activeCoupons: {
            $ifNull: [{ $arrayElemAt: ["$activeCoupons.count", 0] }, 0],
          },
        },
      },
    ]);

    console.log("coupon analyticsdata", data);

    return ApiSuccess.ok("Coupon analytics fetched successfully", { data });
  };
}
