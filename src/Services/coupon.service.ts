import { StatusCodes } from "http-status-codes";
import mongoose, { FilterQuery } from "mongoose";
import { v4 as uuidv4 } from "uuid";
import { UserType } from "../interfaces/auth.interface";
import {
  CouponCheckoutInterface,
  CouponQueryParams,
  ProcessCouponInterface,
  SORTABLE,
} from "../interfaces/coupon.interface";
import { QueryOptions, QueryResponse } from "../interfaces/query";
import Coupon, {
  CouponStatusEnum,
  DiscountType,
  ICoupon,
} from "../models/coupon.model";
import Course from "../models/Course";
import { ICoursePricing } from "../models/course-pricing.model";
import {
  ApplyCouponInterface,
  CreateCouponInterface,
} from "../Schema/coupon.schema";
import { QueryBuilder } from "../utils/query-builder";
import { ServiceResponse } from "../utils/service-response";
import User from "../models/User";
import { CourseQueryParams, IQueryParams } from "../shared/query.interface";
import { ApiSuccess } from "../utils/response-handler";
import { coerceNumber } from "../utils/course-helpers";
import { toDate } from "../utils/parse.helpers";
import { paginate } from "../utils/paginate";

interface ExtendedCreateCouponInterface extends CreateCouponInterface {
  courseId: string;
}

class CouponService {
  private ALLOWED_COUPON_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  private COUPON_LENGTH = 12;

  async createCoupon(payload: ExtendedCreateCouponInterface) {
    const COUPON_PREFIX = payload.discountType.substring(0, 3).toUpperCase();

    const coupon = await Coupon.create({
      couponCode: await this.generateUniqueCouponCode(COUPON_PREFIX),
      discountType: payload.discountType || "DISCOUNT",
      percentage: payload.percentage,
      status: "ACTIVE",
      maximumUsage: payload.maximumUsage,
      expirationDate: payload.expirationDate,
      courseId: payload.courseId,
    });

    if (!coupon) {
      throw new Error("Error creating coupon");
    }

    return { data: coupon, message: "Coupon Created" };
  }

  private generateCouponCode(): string {
    const raw = uuidv4().replace(/-/g, "");

    return raw.slice(0, this.COUPON_LENGTH).toUpperCase();
  }

  private addChecksum(code: string): string {
    // Simple Luhn-like algorithm for checksum
    let sum = 0;
    for (let i = 0; i < code.length; i++) {
      const charValue = this.ALLOWED_COUPON_CHARS.indexOf(code[i]);
      sum += i % 2 === 0 ? charValue * 2 : charValue;
    }
    const checksumChar =
      this.ALLOWED_COUPON_CHARS[sum % this.ALLOWED_COUPON_CHARS.length];
    return `${code}${checksumChar}`;
  }

  /**
   * Generates a unique coupon code, optionally with a prefix, by
   * attempting to create a code up to `maxAttempts` times until a
   * unique code is found. If no unique code is found, returns null.
   * @param prefix Optional string to prepend to the generated code
   * @param maxAttempts Number of attempts to generate a unique code
   * @returns The unique coupon code, or null if no unique code was found
   */
  public async generateUniqueCouponCode(
    prefix: string = "",
    maxAttempts: number = 5,
  ): Promise<string | null> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const randomCode = this.generateCouponCode();
      const codeWithChecksum = this.addChecksum(randomCode);
      const finalCode = prefix
        ? `${prefix}-${codeWithChecksum}`
        : codeWithChecksum;

      const existingCoupon = await Coupon.findOne({ couponCode: finalCode });
      if (!existingCoupon) {
        return finalCode;
      }
    }

    return null;
  }

  public validateCouponFormat(code: string): boolean {
    if (!code) return false;

    const parts = code.split("-");
    const codeToValidate = parts.length > 1 ? parts[1] : code;

    if (codeToValidate.length !== this.COUPON_LENGTH + 1) return false;

    if (
      !codeToValidate
        .split("")
        .every((char) => this.ALLOWED_COUPON_CHARS.includes(char))
    ) {
      return false;
    }

    const codeWithoutChecksum = codeToValidate.slice(0, -1);
    const expectedCode = this.addChecksum(codeWithoutChecksum);
    return expectedCode === codeToValidate;
  }

  async fetchCoupons(query: CouponQueryParams) {
    const page = coerceNumber(query.page, 1);
    const limit = coerceNumber(query.limit, 20);
    const search = (query.search ?? "").trim();

    const sortBy = (
      query.sortBy && SORTABLE.has(query.sortBy) ? query.sortBy : "createdAt"
    ) as
      | "createdAt"
      | "updatedAt"
      | "couponCode"
      | "percentage"
      | "expirationDate";

    const sortOrder = query.sortOrder === "asc" ? 1 : -1;
    const sort = { [sortBy]: sortOrder };

    const filterQuery: Record<string, any> = {};
    if (
      query.discountType &&
      Object.values(DiscountType).includes(query.discountType)
    ) {
      filterQuery.discountType = query.discountType;
    }
    if (
      query.status &&
      Object.values(CouponStatusEnum).includes(query.status)
    ) {
      filterQuery.status = query.status;
    }
    if (query.courseId) {
      filterQuery.courseId = query.courseId;
    }
    const start = toDate(query.startDate);
    const end = toDate(query.endDate);
    if (start || end) {
      filterQuery.expirationDate = {};
      if (start) filterQuery.expirationDate.$gte = start;
      if (end) filterQuery.expirationDate.$lte = end;
    }

    const min = coerceNumber(query.minPercentage, 1);
    const max = coerceNumber(query.maxPercentage, 100);
    if (min != null || max != null) {
      filterQuery.percentage = {};
      if (min != null) filterQuery.percentage.$gte = min;
      if (max != null) filterQuery.percentage.$lte = max;
    }

    if (search) {
      filterQuery.$or = [
        { couponCode: { $regex: String(search), $options: "i" } },
      ];
    }

    const { documents: coupons, pagination } = await paginate<ICoupon>({
      model: Coupon,
      query: filterQuery,
      page,
      limit,
      sort,
      populateOptions: [{ path: "courseId", select: "title image" }],
      select: ["-users"],
    });
    return ApiSuccess.ok("Coupons fetched successfully ", {
      coupons,
      pagination,
    });
  }

  async fetchActiveCoupons(
    queryOptions: QueryOptions,
  ): Promise<QueryResponse<ICoupon>> {
    const baseQuery = {
      status: "ACTIVE",
      expirationDate: { $gt: new Date() },
    } as FilterQuery<ICoupon>;

    const queryBuilder = new QueryBuilder<ICoupon>(
      Coupon,
      queryOptions,
      baseQuery,
    );
    return await queryBuilder.execute();
  }

  async updateCoupon({
    id,
    updates,
  }: {
    id: string;
    updates: Partial<ICoupon>;
  }) {
    const coupon = await Coupon.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!coupon) {
      return { message: "Coupon not found", success: false, data: null };
    }
    return {
      message: "Success",
      data: coupon,
      success: true,
    };
  }

  async updateCouponStatus(id: string) {
    const coupon = await Coupon.findById(id).select("-courseId");
    if (!coupon) {
      return { message: "Coupon not found", success: false, data: null };
    }

    coupon.status =
      coupon.status === "ACTIVE"
        ? CouponStatusEnum.INACTIVE
        : CouponStatusEnum.ACTIVE;
    await coupon.save();

    return {
      message: "Success",
      data: coupon,
      success: true,
    };
  }

  async getCouponUsers(couponId: string) {
    const coupon = await Coupon.findById({ _id: couponId }).populate("users");

    return {
      message: "Success",
      data: coupon,
      success: true,
    };
  }

  async fetchCoupon(
    id: string,
    type: "mongoose" | "unique",
  ): Promise<ICoupon | null> {
    let coupon;
    switch (type) {
      case "mongoose":
        coupon = await Coupon.findById(id);
        break;
      case "unique":
        coupon = await Coupon.findOne({ couponCode: id });
        break;
      default:
        throw new Error(
          "Invalid coupon type provided. Must be 'mongoose' or 'unique'",
        );
    }

    if (!coupon) return null;

    return coupon;
  }

  isCouponValid(coupon: QueryResponse<ICoupon>["data"][0]): {
    success: boolean;
    message: string;
  } {
    if (coupon.status !== "ACTIVE") {
      return {
        success: false,
        message: "This coupon is no longer valid",
      };
    }

    if (coupon.expirationDate < new Date()) {
      return {
        success: false,
        message: "This coupon has expired",
      };
    }

    if (coupon.currentUses >= coupon.maximumUsage) {
      return {
        success: false,
        message: "This coupon is no longer valid",
      };
    }

    return {
      success: true,
      message: "Coupon is valid",
    };
  }

  calculateDiscountPrice(coursePrice: number, couponPercentage: number) {
    let discountAmount = 0;
    discountAmount = (coursePrice * couponPercentage) / 100;
    const finalPrice = coursePrice - discountAmount;

    return {
      price: finalPrice,
      discountAmount,
    };
  }

  // TODO:
  public async processCoupon(payload: ProcessCouponInterface) {
    const coupon = await this.fetchCoupon(payload.couponCode, "unique");
    if (!coupon) {
      return ServiceResponse.failure(
        "No coupon found",
        null,
        StatusCodes.NOT_FOUND,
      );
    }
    const checkCouponValidity = this.isCouponValid(coupon);

    if (!checkCouponValidity.success) {
      return ServiceResponse.failure(
        checkCouponValidity.message,
        null,
        StatusCodes.BAD_REQUEST,
      );
    }

    const course = await Course.findById({ _id: payload.courseId }).populate({
      path: "course_price",
    });

    const isCouponApplicable = course?.coupon_codes.some(
      (coupon) => coupon._id === coupon._id,
    );
    if (!isCouponApplicable) {
      return ServiceResponse.failure(
        "Coupon is not applicable to this course",
        null,
        StatusCodes.BAD_REQUEST,
      );
    }

    if (
      course &&
      course.course_price &&
      typeof course.course_price === "object"
    ) {
      const coursePricing = (course.course_price as unknown as ICoursePricing)
        .coursePricing;

      const discountedPrice = this.calculateDiscountPrice(
        coursePricing as number,
        coupon.percentage,
      );
      return ServiceResponse.success(
        "Coupon is valid",
        {
          data: {
            discountedPrice: discountedPrice.price,
            coursePrice: coursePricing,
            couponDiscount: discountedPrice.discountAmount,
          },
        },
        StatusCodes.OK,
      );
    } else {
      return ServiceResponse.failure(
        "Error processing coupon",
        null,
        StatusCodes.BAD_REQUEST,
      );
    }
  }

  public async applyCoupon(payload: ApplyCouponInterface & { user: UserType }) {
    try {
      const coupon = await this.fetchCoupon(payload.couponCode, "unique");
      if (!coupon) {
        return ServiceResponse.failure(
          "No coupon found",
          null,
          StatusCodes.NOT_FOUND,
        );
      }
      const checkCouponValidity = this.isCouponValid(coupon);

      if (!checkCouponValidity.success) {
        return ServiceResponse.failure(
          checkCouponValidity.message,
          null,
          StatusCodes.BAD_REQUEST,
        );
      }

      const course = await Course.findById({ _id: payload.courseId }).populate({
        path: "course_price",
      });

      const isCouponApplicable = course?.coupon_codes.some(
        (coupon) => coupon._id === coupon._id,
      );
      if (!isCouponApplicable) {
        return ServiceResponse.failure(
          "Coupon is not applicable to this course",
          null,
          StatusCodes.BAD_REQUEST,
        );
      }

      if (
        course &&
        course.course_price &&
        typeof course.course_price === "object"
      ) {
        const coursePricing = (course.course_price as unknown as ICoursePricing)
          .coursePricing;

        const discountedPrice = this.calculateDiscountPrice(
          coursePricing as number,
          coupon.percentage,
        );

        // stop here

        if (!discountedPrice) {
          return ServiceResponse.failure(
            "An error occured while applying coupon",
            null,
            StatusCodes.BAD_REQUEST,
          );
        }

        coupon.currentUses = coupon.currentUses + 1;
        if (coupon.currentUses >= coupon.maximumUsage) {
          coupon.status = CouponStatusEnum.INACTIVE;
          await coupon.save();
        }

        const user = payload.user;
        coupon.users.push(user?._id);
        await coupon.save();

        return ServiceResponse.success(
          "Coupon applied successfully",
          {
            data: {
              discountedPrice,
              success: true,
            },
          },
          StatusCodes.OK,
        );
      } else {
        return ServiceResponse.failure(
          "An error occured while applying coupon",
          null,
          StatusCodes.BAD_REQUEST,
        );
      }
    } catch (error) {
      return ServiceResponse.failure(
        "Internal Server Error",
        null,
        StatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // done
  public async couponCheckout(payload: CouponCheckoutInterface) {
    try {
      const response = await this.processCoupon(payload);
      if (!response.success) {
        return response;
      }

      return response;
    } catch (error) {
      return ServiceResponse.failure(
        "Internal Server Error",
        null,
        StatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getCouponAnalytics(): Promise<{ success: boolean; data: {} } | null> {
    const response = await Coupon.aggregate([
      {
        $facet: {
          allCoupons: [{ $count: "count" }],
          activeCoupons: [
            { $match: { status: "ACTIVE" } },
            { $count: "count" },
          ],
        },
      },
      {
        $project: {
          allCoupons: { $arrayElemAt: ["$allCoupons.count", 0] },
          activeCoupons: { $arrayElemAt: ["$activeCoupons.count", 0] },
        },
      },
    ]);

    return {
      success: true,
      data: response,
    };
  }

  async enrollUserWithPerpetualAccess(userId: string, courseId: string) {
    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Find the course
    const course = await Course.findById(courseId);
    if (!course) {
      throw new Error("Course not found");
    }

    // Check if user is already enrolled
    const existingEnrollment = user.courseEnrollments?.find(
      (enrollment) => enrollment.course.toString() === courseId,
    );

    if (existingEnrollment) {
      // User is already enrolled - set expiration date to a far future date
      existingEnrollment.expiresAt = new Date("2999-12-31");
    } else {
      // Add new perpetual enrollment
      if (!user.courseEnrollments) {
        user.courseEnrollments = [];
      }

      user.courseEnrollments.push({
        course: new mongoose.Types.ObjectId(courseId),
        expiresAt: new Date("2999-12-31"),
        isAssigned: false,
      });

      // Add user to course participants if not already there
      if (
        !course.participants.includes(
          userId as unknown as mongoose.Types.ObjectId,
        )
      ) {
        course.participants.push(new mongoose.Types.ObjectId(userId));
      }
    }

    // Remove from expired courses if it was there
    if (user.expiredCourses?.some((id) => id.toString() === courseId)) {
      user.expiredCourses = user.expiredCourses.filter(
        (id) => id.toString() !== courseId,
      );
    }

    // Save changes
    await Promise.all([user.save(), course.save()]);

    return {
      success: true,
      message: "User enrolled with perpetual access",
    };
  }

  public async deleteCoupon(id: string) {
    try {
      const response = await Coupon.findByIdAndDelete(id);
      if (!response) {
        return ServiceResponse.failure(
          "Coupon not found",
          null,
          StatusCodes.NOT_FOUND,
        );
      }
      return ServiceResponse.success(
        "Coupon deleted successfully",
        null,
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

  public async softDeleteCoupon(id: string) {
    try {
      const response = await Coupon.findByIdAndUpdate(
        id,
        { isDeleted: true },
        { new: true },
      );
      if (!response) {
        return ServiceResponse.failure(
          "Coupon not found",
          null,
          StatusCodes.NOT_FOUND,
        );
      }
      return ServiceResponse.success(
        "Coupon soft deleted successfully",
        null,
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

export const couponService = new CouponService();
export default CouponService;
