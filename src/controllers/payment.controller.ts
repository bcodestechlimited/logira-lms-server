import { NextFunction, Response } from "express";
import { StatusCodes } from "http-status-codes";
import paymentService from "../Services/payment.service";
import { ExtendedRequest } from "../interfaces/auth.interface";
import { CourseCheckoutInterface } from "../interfaces/payment.interface";

class PaymentController {
  public async courseCheckout(
    req: ExtendedRequest,
    res: Response,
    next: NextFunction,
  ) {
    const user = req.user;
    const { courseId, couponCode } = req.body;

    if (!courseId) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "Course ID is required",
        success: false,
      });
    }
    const payload: CourseCheckoutInterface = {
      courseId,
      userId: user?._id,
      couponCode,
      firstName: user?.firstName as string,
      email: user?.email as string,
    };

    const serviceResponse = await paymentService.courseCheckout(payload);

    return res.status(serviceResponse.statusCode).json(serviceResponse);
  }
}

export default new PaymentController();
