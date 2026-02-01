import { NextFunction, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { ExtendedRequest } from "../../interfaces/auth.interface";
import {
  CourseCheckoutDTO,
  CourseCheckoutPayload,
} from "./payment-v2.interface";
import { paymentv2Service, PaymentV2Service } from "./payment-v2.service";

class PaymentNewController {
  constructor(private paymentService: PaymentV2Service) {}

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
  };
}

export default new PaymentNewController(paymentv2Service);
