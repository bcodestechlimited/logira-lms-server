import { z } from "zod";
import { DiscountType } from "../../models/coupon.model";

export class CouponSchema {
  static sendCouponToUsers = z.object({
    courseId: z.string(),
    expirationDate: z.string().datetime(),
    percentage: z.number().min(1).max(100),
    discountType: z.nativeEnum(DiscountType),
  });
}

export type SendCouponToUsersDTO = z.infer<
  typeof CouponSchema.sendCouponToUsers
>;
