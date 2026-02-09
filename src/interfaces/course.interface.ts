import { UploadedFile } from "express-fileupload";
import { CourseDocument } from "../models/Course";
import { Document, Types } from "mongoose";

export interface BulkAssignCourseInterface {
  isIcsStaff: boolean;
  durationDays: number;
  file: UploadedFile;
  courseIds: string[];
}

export interface AssignCourseToUsersInterface {
  userId: string;
  courseIds: string[];
  durationDays?: number;
}

export interface CourseQueryOptions {
  options: {
    page: number;
    limit: number;
    sort: {
      [x: string]: number;
    };
    populate: string[] | { path: string; select?: string }[] | any;
  };
  query: Record<string, any>;
}

export enum SkillLevel {
  BEGINNER = "beginner",
  INTERMEDIATE = "intermediate",
  ADVANCED = "advanced",
  EXPERT = "expert",
}

export interface CourseInterface extends Document {
  user: Types.ObjectId;
  participants: Types.ObjectId[];
  pastParticipants: Types.ObjectId[];
  defaultEnrollmentDuration: number;
  title: string;
  description: string;
  caption?: string;
  skillLevel: SkillLevel;
  duration?: string;
  category: string;
  courseDuration?: string;
  amount?: number;
  image: string;
  publicId: string;
  certificate?: string;
  image2?: Types.ObjectId;
  benefits: string[];
  language: string;
  softwares: string[];
  progress: Types.ObjectId[];
  summary: string;
  course_modules: Types.ObjectId[];
  course_assessment: Types.ObjectId[];
  course_benchmark?: Types.ObjectId;
  course_price?: Types.ObjectId;
  coupon_codes: Types.ObjectId[];
  resource: Types.ObjectId[];
  rating: Types.ObjectId[];
  status: string;
  quiz?: Types.ObjectId;
  isPublished: boolean;
  isDeleted: boolean;
  organisation?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;

  enrollUser: any;
  unenrollUser: any;
}
