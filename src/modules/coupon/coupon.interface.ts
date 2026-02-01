import { Document } from "mongoose";
import { CourseInterface } from "../../interfaces/course.interface";
import { CouponStatusEnum, DiscountType } from "../../models/coupon.model";
import { IUserModel } from "../../models/User";

export type ParseRecipientsResult = {
  emails: string[];
  invalidEmails: string[];
  duplicates: string[];
  totalRows: number;
};

export interface CouponInterface extends Document {
  couponCode: string;
  discountType: DiscountType;
  percentage: number;
  expirationDate: Date;
  maximumUsage: number;
  status: CouponStatusEnum;
  courseId: CourseInterface;
  currentUses: number;
  users: IUserModel[];
  isDeleted: boolean;

  recipientEmail?: string;
  issuedToUserId?: IUserModel | null;
  usedAt?: Date | null;
  usedBy?: IUserModel | null;
}

export type VerifyCouponCodeDTO = {
  couponCode: string;
  courseId: string;
};

export type CoursePricingDoc = {
  coursePricing: number;
};

export type CourseCouponAdminQuery = {
  page?: string | number;
  limit?: string | number;
  search?: string;
  status?: CouponStatusEnum;
  courseId?: string;
  discountType?: DiscountType;
  used?: "true" | "false";
  startDate?: string;
  endDate?: string;
};

export type PaginatedResult<T> = {
  documents: T[];
  pagination: {
    totalCount: number;
    filteredCount: number;
    totalPages: number;
    page: number;
    limit: number;
  };
};
