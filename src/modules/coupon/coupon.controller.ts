import autoBind from "auto-bind";
import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { ExtendedRequest } from "../../interfaces/auth.interface";
import {
  CourseCheckoutDTO,
  CourseCheckoutPayload,
} from "../payment/payment-v2.interface";
import { VerifyCouponCodeDTO } from "./coupon.interface";
import { SendCouponToUsersDTO } from "./coupon.schema";
import { CouponService } from "./coupon.service";

export class CouponController {
  constructor(private couponService: CouponService) {
    autoBind(this);
  }

  public sendCouponToUsersForACourse = async (
    req: ExtendedRequest,
    res: Response,
  ) => {
    const user = req.user;
    const file = (req.files as any).file;
    const dto = req.body as SendCouponToUsersDTO;

    const result = await this.couponService.sendCouponToUsersForACourse({
      file,
      user,
      dto,
    });

    res.status(result.status_code).json(result);
  };

  public verifyCouponCode = async (req: ExtendedRequest, res: Response) => {
    const user = req.user!;
    const dto = req.body as VerifyCouponCodeDTO;

    const result = await this.couponService.verifyCouponCode({ dto, user });

    res.status(result.statusCode).json(result);
  };

  public courseCheckout = async (
    req: ExtendedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    const user = req.user;

    const dto = req.body as CourseCheckoutDTO;
    const courseId = String(dto.courseId ?? "").trim();
    const couponCode = dto.couponCode ? String(dto.couponCode) : undefined;

    if (!courseId) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "Course ID is required",
        success: false,
      });
    }

    const payload: CourseCheckoutPayload = {
      courseId,
      userId: String(user?._id ?? ""),
      couponCode,
      firstName: String(user?.firstName ?? ""),
      email: String(user?.email ?? ""),
    };

    const serviceResponse = await this.couponService.courseCheckout(payload);
    return res.status(serviceResponse.statusCode).json(serviceResponse);
  };

  public getCoupons = async (req: Request, res: Response) => {
    const result = await this.couponService.fetchCoupons(req.query);
    res.status(result.status_code).json(result);
  };

  public getCouponAnalytics = async (req: Request, res: Response) => {
    const result = await this.couponService.getCouponAnalytics();
    res.status(result.status_code).json(result);
  };
}

export const couponController = new CouponController(new CouponService());
