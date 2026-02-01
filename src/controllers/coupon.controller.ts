import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import CouponDTO from "../dtos/coupon.dto";
import { ExtendedRequest } from "../interfaces/auth.interface";
import { CouponQueryParams } from "../interfaces/coupon.interface";
import { handleServiceResponse } from "../Middlewares/validation.middleware";
import { ICoupon } from "../models/coupon.model";
import Course from "../models/Course";
import CouponService from "../Services/coupon.service";
import { ServiceResponse } from "../utils/service-response";

const couponService = new CouponService();
class CouponController {
  async createCoupon(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        discountType,
        percentage,
        expirationDate,
        maximumUsage,
        courseId,
      } = req.body;

      const response = await couponService.createCoupon({
        discountType,
        percentage,
        expirationDate,
        maximumUsage,
        courseId,
      });

      // ADD COUPON TO THE COURSE MODEL
      const course = await Course.findByIdAndUpdate(
        courseId,
        {
          $push: { coupon_codes: response.data._id },
        },
        { new: true },
      );
      const data = {
        message: "Coupon Created",
        success: true,
        data: { coupon: response, course },
      };
      handleServiceResponse(
        ServiceResponse.success("Coupon created", data, StatusCodes.CREATED),
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

  async getCoupons(req: Request, res: Response, next: NextFunction) {
    const query = req.query as CouponQueryParams;
    const result = await couponService.fetchCoupons(query);

    res.status(result.status_code).json(result);
  }

  async updateCouponStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { couponId } = req.body;

      if (!couponId) {
        return handleServiceResponse(
          ServiceResponse.failure(
            "Invalid request",
            null,
            StatusCodes.BAD_REQUEST,
          ),
          res,
        );
      }

      const id = couponId;
      const response = await couponService.updateCouponStatus(id);
      if (!response.success) {
        return handleServiceResponse(
          ServiceResponse.failure(
            "Request Failed",
            null,
            StatusCodes.BAD_REQUEST,
          ),
          res,
        );
      }
      const data = new CouponDTO(response.data);
      handleServiceResponse(
        ServiceResponse.success("Success", data, StatusCodes.OK),
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

  async editCoupon(req: Request, res: Response, next: NextFunction) {
    try {
      const { expirationDate, maximumUsage, couponId } = req.body;

      if (!expirationDate && !maximumUsage) {
        return handleServiceResponse(
          ServiceResponse.failure(
            "Invalid request",
            null,
            StatusCodes.BAD_REQUEST,
          ),
          res,
        );
      }

      const updates: Partial<ICoupon> = {};
      if (expirationDate) updates.expirationDate = expirationDate;
      if (maximumUsage) updates.maximumUsage = maximumUsage;

      const response = await couponService.updateCoupon({
        id: couponId,
        updates,
      });
      if (!response.success) {
        return handleServiceResponse(
          ServiceResponse.failure(response.message, null, StatusCodes.OK),
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

  async getCouponUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const couponId = req.params.id;

      const response = await couponService.getCouponUsers(couponId);

      if (!response.success && response.data === null) {
        return handleServiceResponse(
          ServiceResponse.failure(
            "Request Failed",
            null,
            StatusCodes.BAD_REQUEST,
          ),
          res,
        );
      }

      const users = response.data ? response?.data.users : [];

      handleServiceResponse(
        ServiceResponse.success(
          "Success",
          { users, length: users.length },
          StatusCodes.OK,
        ),
        res,
      );
    } catch (error) {
      handleServiceResponse(
        ServiceResponse.failure(
          "Interal Server Error",
          null,
          StatusCodes.INTERNAL_SERVER_ERROR,
        ),
        res,
      );
    }
  }

  async applyCoupon(req: ExtendedRequest, res: Response, next: NextFunction) {
    const { couponCode, courseId, coursePrice } = req.body;
    const payload = {
      couponCode,
      courseId,
      coursePrice,
      user: req.user,
    };

    const response = await couponService.applyCoupon(payload);

    res.status(response.statusCode).json(response);
  }

  // test: this functionality
  public async couponCheckout(req: Request, res: Response, next: NextFunction) {
    const { couponCode, courseId } = req.body;
    const payload = {
      couponCode,
      courseId,
    };
    const response = await couponService.couponCheckout(payload);

    res.status(response.statusCode).json(response);
  }

  async getCouponAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const response = await couponService.getCouponAnalytics();

      if (!response?.success) {
        return handleServiceResponse(
          ServiceResponse.failure(
            "Request Failed",
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

  async getACouponById(req: Request, res: Response, next: NextFunction) {
    try {
      const couponId = req.params.id as string;
      if (!couponId) {
        return res.status(400).json({ message: "Coupon id is required" });
      }
      const response = await couponService.fetchCoupon(couponId, "mongoose");

      if (!response) {
        return handleServiceResponse(
          ServiceResponse.success(
            "Coupon not found",
            {},
            StatusCodes.NOT_FOUND,
          ),
          res,
        );
      }

      // transform the coupon data sent
      const couponDTO = new CouponDTO(response);

      handleServiceResponse(
        ServiceResponse.success("Success", couponDTO, StatusCodes.OK),
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

  async deleteCoupon(req: Request, res: Response, next: NextFunction) {
    try {
      const couponId = req.params.id;

      const response = await couponService.deleteCoupon(couponId);

      if (!response.success) {
        return handleServiceResponse(
          ServiceResponse.failure(
            "Request Failed",
            null,
            StatusCodes.BAD_REQUEST,
          ),
          res,
        );
      }

      handleServiceResponse(
        ServiceResponse.success("Success", null, StatusCodes.OK),
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

  async softDeleteCoupon(req: Request, res: Response) {
    try {
      const couponId = req.params.id;
      const response = await couponService.softDeleteCoupon(couponId);

      if (!response.success) {
        return handleServiceResponse(
          ServiceResponse.failure(
            "Request Failed",
            null,
            StatusCodes.BAD_REQUEST,
          ),
          res,
        );
      }

      handleServiceResponse(
        ServiceResponse.success("Success", null, StatusCodes.OK),
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
}

export const couponController = new CouponController();
export default CouponController;
