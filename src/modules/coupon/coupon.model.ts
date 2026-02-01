import mongoose, { Schema } from "mongoose";
import { CouponStatusEnum, DiscountType } from "../../models/coupon.model";
import { CouponInterface } from "./coupon.interface";

const CourseCouponSchema = new mongoose.Schema<CouponInterface>({
  couponCode: { type: String, required: true, unique: true },
  discountType: {
    type: String,
    enum: Object.values(DiscountType),
    required: true,
  },
  percentage: { type: Number, required: true, min: 0, max: 100 },
  expirationDate: { type: Date, required: true },
  maximumUsage: { type: Number, required: true, min: 1 },
  currentUses: { type: Number, default: 0 },
  users: [{ type: mongoose.Types.ObjectId, ref: "User", index: true }],
  status: {
    type: String,
    enum: Object.values(CouponStatusEnum),
    default: CouponStatusEnum.ACTIVE,
  },
  courseId: {
    type: Schema.Types.ObjectId,
    ref: "Course",
    index: true,
    autopopulate: false,
  },
  isDeleted: { type: Boolean, default: false },

  recipientEmail: { type: String, lowercase: true, trim: true, index: true },
  issuedToUserId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    index: true,
    default: null,
  },
  usedAt: { type: Date, default: null },
  usedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
});

const CourseCoupon = mongoose.model<CouponInterface>(
  "CourseCoupon",
  CourseCouponSchema,
);
export default CourseCoupon;
