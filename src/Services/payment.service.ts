import { StatusCodes } from "http-status-codes";
import mongoose from "mongoose";
import { APP_CONFIG } from "../config/app.config";
import { CourseCheckoutInterface } from "../interfaces/payment.interface";
import { CouponStatusEnum } from "../models/coupon.model";
import Course from "../models/Course";
import { ICoursePricing } from "../models/course-pricing.model";
import User from "../models/User";
import { ServiceResponse } from "../utils/service-response";
import { couponService } from "./coupon.service";
import { emailService } from "./mail.service";

class PaymentService {
  public async courseCheckout(payload: CourseCheckoutInterface) {
    try {
      let discountedPrice = 0;
      let isFreeEnrollment = false;

      const course = await Course.findById(payload.courseId).populate({
        path: "course_price",
      });

      if (!course) {
        return ServiceResponse.failure(
          "No course found",
          null,
          StatusCodes.NOT_FOUND,
        );
      }

      let originalPrice = 0;
      if (
        course &&
        course.course_price &&
        typeof course.course_price === "object"
      ) {
        originalPrice = (course.course_price as unknown as ICoursePricing)
          .coursePricing as number;
      } else {
        return ServiceResponse.failure(
          "Course pricing information not available",
          null,
          StatusCodes.BAD_REQUEST,
        );
      }

      if (payload.couponCode) {
        const coupon = await couponService.fetchCoupon(
          payload.couponCode,
          "unique",
        );

        if (!coupon) {
          return ServiceResponse.failure(
            "Invalid coupon code",
            null,
            StatusCodes.BAD_REQUEST,
          );
        }

        const couponValidity = couponService.isCouponValid(coupon);

        if (!couponValidity.success) {
          return ServiceResponse.failure(
            couponValidity.message,
            null,
            StatusCodes.BAD_REQUEST,
          );
        }

        const isCouponApplicable = course?.coupon_codes.some(
          (code) => code._id.toString() === coupon.id.toString(),
        );

        if (!isCouponApplicable) {
          return ServiceResponse.failure(
            "Coupon is not applicable to this course",
            null,
            StatusCodes.BAD_REQUEST,
          );
        }

        const priceDetails = couponService.calculateDiscountPrice(
          originalPrice,
          coupon.percentage,
        );
        discountedPrice = priceDetails.price;

        if (coupon.percentage === 100 || discountedPrice <= 0) {
          isFreeEnrollment = true;
        }

        coupon.currentUses += 1;
        if (coupon.currentUses >= coupon.maximumUsage) {
          coupon.status = CouponStatusEnum.INACTIVE;
        }

        const user = await User.findById(payload.userId);
        if (user) {
          coupon.users.push(user._id as mongoose.Types.ObjectId);
        }
        await coupon.save();
      }

      if (isFreeEnrollment) {
        await couponService.enrollUserWithPerpetualAccess(
          payload.userId,
          payload.courseId,
        );

        await emailService.sendEmailTemplate({
          subject: `Welcome Aboard! Your ${course.title} Journey Begins Now`,
          template: "user-enrolled",
          to: payload.email,
          variables: {
            userName: payload.firstName,
            courseName: course.title,
            instructorName: APP_CONFIG.COMPANY_NAME,
            dashboardUrl: APP_CONFIG.CLIENT_FRONTEND_BASE_URL + "/dashboard",
            helpCenterEmail: APP_CONFIG.SUPPORT_EMAIL,
          },
        });

        return ServiceResponse.success(
          "You have been successfully enrolled in this course",
          {
            data: {
              enrolled: true,
              originalPrice,
              finalPrice: 0,
              discount: originalPrice,
            },
          },
          StatusCodes.OK,
        );
      } else {
        /**
         * note: in this place process the payment because 100% discount is not applied, also redirect the user to an order summary page from here
         *
         */
        return ServiceResponse.success(
          "Pricing information retrieved successfully",
          {
            data: {
              enrolled: false,
              originalPrice,
              finalPrice: discountedPrice > 0 ? discountedPrice : originalPrice,
              discount: originalPrice - discountedPrice,
              requiresPayment: true,
            },
          },
          StatusCodes.OK,
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
}

export default new PaymentService();
