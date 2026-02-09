import mongoose, { InferSchemaType, Model, PaginateModel } from "mongoose";
import autopopulate from "mongoose-autopopulate";
import paginator from "mongoose-paginate-v2";
import { ICoursePricing } from "./course-pricing.model";
import { CourseInterface, SkillLevel } from "../interfaces/course.interface";

export const DEFAULT_ENROLLMENT_DURATION = 90;

export interface ICourseMethods {
  enrollUser(
    userId: mongoose.Types.ObjectId,
    durationDays?: number,
  ): Promise<Date>;
  unenrollUser(userId: mongoose.Types.ObjectId): Promise<boolean>;
}

export interface ICourseModel extends Model<CourseDocument & ICourseMethods> {
  findWithActiveEnrollment(
    courseId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId,
  ): Promise<CourseDocument | null>;
}

mongoose.plugin(paginator);
mongoose.plugin(autopopulate);
const { ObjectId } = mongoose.Schema;

const CourseSchema = new mongoose.Schema<CourseInterface>(
  {
    user: {
      type: ObjectId,
      ref: "User",
      autopopulate: {
        select:
          "firstName lastName email telephone avatar isAdmin privilege availability slug",
      },
      index: true,
    },
    participants: [
      {
        type: ObjectId,
        ref: "User",
        index: true,
      },
    ],
    pastParticipants: [
      {
        type: ObjectId,
        ref: "User",
        index: true,
      },
    ],
    defaultEnrollmentDuration: {
      type: Number,
      default: DEFAULT_ENROLLMENT_DURATION,
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    caption: { type: String },
    skillLevel: {
      type: String,
      default: SkillLevel.BEGINNER,
      enum: Object.values(SkillLevel),
    },
    duration: { type: String },
    category: {
      type: String,
      default: "Technology",
      lowercase: true,
      required: true,
    },
    courseDuration: { type: String },
    amount: { type: Number },
    image: { type: String, default: "https://placehold.co/600x400" },
    publicId: { type: String },
    certificate: {
      type: String,
    },
    // image: { type: ObjectId, ref: "Content", autopopulate: true },
    image2: { type: ObjectId, ref: "Content" },
    benefits: [String],
    language: { type: String, default: "english" },
    softwares: { type: [String] },
    progress: [
      {
        type: ObjectId,
        ref: "Progress",
        index: true,
      },
    ],
    summary: { type: String, required: true },
    // module: [{ type: ObjectId, ref: "Module", index: true }],
    course_modules: [{ type: ObjectId, ref: "CourseModule", index: true }],
    course_assessment: [
      {
        type: ObjectId,
        ref: "CourseAssessment",
        autopopulate: false,
        index: true,
      },
    ],
    course_benchmark: {
      type: ObjectId,
      ref: "CourseBenchmark",
      autopopulate: false,
      index: true,
    },
    course_price: {
      type: ObjectId,
      ref: "CoursePricing",
      autopopulate: false,
      index: true,
    },
    coupon_codes: [{ type: ObjectId, ref: "Coupon" }],
    resource: [{ type: ObjectId, ref: "Resource" }],
    rating: [{ type: ObjectId, ref: "Rating" }],
    status: { type: String, default: "active" },
    quiz: { type: ObjectId, ref: "Quiz" },
    isPublished: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    organisation: {
      type: ObjectId,
      ref: "User",
      index: true,
    },
  },
  { timestamps: true },
);

CourseSchema.methods.enrollUser = async function (
  userId: mongoose.Types.ObjectId,
  durationDays?: number,
) {
  const User = mongoose.model("User");
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  const duration = durationDays || this.defaultEnrollmentDuration;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + duration);

  const existingEnrollment = user.courseEnrollments?.find(
    (enrollment) => enrollment.course.toString() === this._id.toString(),
  );

  if (existingEnrollment) {
    // Update expiration date
    existingEnrollment.expiresAt = expiresAt;
  } else {
    // Add new enrollment
    if (!user.courseEnrollments) {
      user.courseEnrollments = [];
    }

    user.courseEnrollments.push({
      course: this._id,
      expiresAt: expiresAt,
      isAssigned: false,
    });

    // Add user to participants if not already there
    if (!this.participants.includes(userId)) {
      this.participants.push(userId);
      await this.save();
    }
  }

  if (user.expiredCourses?.some((id) => id.equals(this._id))) {
    user.expiredCourses = user.expiredCourses.filter(
      (id) => !id.equals(this._id),
    );
  }

  await user.save();

  return expiresAt;
};

// Method to manually unenroll a user
CourseSchema.methods.unenrollUser = async function (
  userId: mongoose.Types.ObjectId,
) {
  const User = mongoose.model("User");
  const user = await User.findById(userId);

  if (!user) {
    throw new Error("User not found");
  }

  // Check if user is enrolled
  if (
    !user.courseEnrollments?.some((enrollment) =>
      enrollment.course.equals(this._id),
    )
  ) {
    return false;
  }

  // Remove from enrollments
  user.courseEnrollments = user.courseEnrollments.filter(
    (enrollment) => !enrollment.course.equals(this._id),
  );

  // Add to expired courses if not already there
  if (!user.expiredCourses) {
    user.expiredCourses = [];
  }

  if (!user.expiredCourses.some((id) => id.equals(this._id))) {
    user.expiredCourses.push(this._id);
  }

  // Remove from participants
  this.participants = this.participants.filter((id) => !id.equals(userId));

  // Add to past participants if not already there
  if (!this.pastParticipants) {
    this.pastParticipants = [];
  }

  if (!this.pastParticipants.some((id) => id.equals(userId))) {
    this.pastParticipants.push(userId);
  }

  await Promise.all([user.save(), this.save()]);

  return true;
};

// Static method to find a course where a user has an active enrollment
CourseSchema.statics.findWithActiveEnrollment = async function (
  courseId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
) {
  const User = mongoose.model("User");
  const user = await User.findById(userId);

  if (!user || !user.courseEnrollments) {
    return null;
  }

  const now = new Date();
  const activeEnrollment = user.courseEnrollments.find(
    (enrollment) =>
      enrollment.course.equals(courseId) && enrollment.expiresAt > now,
  );

  if (!activeEnrollment) {
    return null;
  }

  return this.findById(courseId);
};

export type CourseDocument = InferSchemaType<typeof CourseSchema> & {
  course_price: mongoose.Types.ObjectId | ICoursePricing;
} & ICourseMethods;

export default mongoose.model<CourseInterface>("Course", CourseSchema);
