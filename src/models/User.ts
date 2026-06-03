import crypto from "crypto";
import mongoose, { Document, InferSchemaType, Model, Types } from "mongoose";
import autopopulate from "mongoose-autopopulate";
import paginator from "mongoose-paginate-v2";
import slug from "mongoose-slug-updater";

mongoose.plugin(paginator);
mongoose.plugin(autopopulate);
mongoose.plugin(slug);
const { ObjectId } = mongoose.Schema;

export const userStatus = ["pending", "activated", "suspended"] as const;

export type USERSTATUS = (typeof userStatus)[number];

export enum UserRole {
  USER = "USER",
  STAFF = "STAFF",
  INSTRUCTOR = "INSTRUCTOR",
  COMPANY = "COMPANY",
  INSTITUTION_ADMIN = "INSTITUTION_ADMIN",
  INSTITUTION = "INSTITUTION",
  INSTITUTION_STAFF = "INSTITUTION_STAFF",
  ADMIN = "ADMIN",
  SUPERADMIN = "SUPERADMIN",
}

export enum EmailInvitationEnum {
  PENDING = "PENDING",
  ACCEPTED = "ACCEPTED",
  REJECTED = "REJECTED",
}

export const enableDisable = ["enable", "disable"] as const;

export type ENABLEDISABLE = (typeof enableDisable)[number];

// idea: add assigned course flag here to indicate if the user was assigned the course or not
export interface ICourseEnrollment {
  course: Types.ObjectId;
  expiresAt: Date;
  isAssigned: boolean;
}

export interface IUserBase extends Document {
  slug: string;
  firstName: string;
  lastName: string;
  email: string;
  lastVisited?: Date;
  telephone?: string;
  password: string;
  isEmailVerified?: boolean;
  isThirdParty?: boolean;
  isToReset?: boolean;
  token?: string;
  companyName?: string;
  titleInitials?: string;
  image?: Types.ObjectId;
  avatar?: string;
  extra?: Types.ObjectId;
  extraPath?: string;
  userType?: Types.ObjectId;
  role?: string;
  privilege?: string;
  progress?: Types.ObjectId[];
  isAdmin?: boolean;
  gender?: string;
  statusText?: string;
  adminStatusText?: string;
  status?: boolean;
  is2FAEnabled?: string;
  is2FASecret?: string;
  is2FAType?: string;
  bio?: string;
  case?: string;
  regMode?: string;
  department?: string;
  courseEnrollments: ICourseEnrollment[];
  expiredCourses: {
    course: Types.ObjectId;
    expiresAt: Date;
  }[];
  organisation?: Types.ObjectId;
  addedBy?: Types.ObjectId;
  passwordVersion: number;
  passwordResetToken?: string | null;
  passwordResetTokenExpires?: Date | null;
  emailInvitationToken: string | null;
  emailInvitationStatus: EmailInvitationEnum;
  staffEmailInvitationSentAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
  isActive: Boolean;
}

export interface IUserMethods {
  generatePasswordResetToken(): string;
  generateEmailInvitationToken(): string;
  checkAndExpireCourses(): Promise<Types.ObjectId[]>;
}

// export interface IUser extends IUserBase, IUserMethods, Document {}

export interface IUserModel extends Model<IUserBase> {
  findByEmailInvitationToken(email: string, token: string): Promise<IUserBase | null>;
  verifyToken(plainToken: string, hashedToken: string): boolean;
  checkAllUsersForExpiredCourses(): Promise<void>;
}

const UserSchema = new mongoose.Schema<IUserBase>(
  {
    slug: {
      type: String,
      unique: true,
      slugPaddingSize: 7,
      slug: ["lastName", "firstName"],
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    email: {
      unique: true,
      type: String,
      required: true,
      trim: true,
    },
    lastVisited: {
      type: Date,
    },
    telephone: {
      type: String,
      index: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isThirdParty: {
      type: Boolean,
    },
    isToReset: {
      type: Boolean,
    },
    token: {
      type: String,
    },
    companyName: {
      type: String,
    },
    titleInitials: {
      type: String,
    },
    image: {
      type: ObjectId,
      ref: "Content",
      autopopulate: true,
    },
    avatar: {
      type: String,
      default: "https://github.com/shadcn.png",
    },
    extra: {
      type: ObjectId,
      refPath: "extraPath",
      autopopulate: true,
    },
    extraPath: {
      type: String,
      default: "Extra",
    },
    userType: { type: ObjectId, ref: "UserType", autopopulate: true },
    role: {
      type: String,
      enum: UserRole,
      default: UserRole.USER,
      index: true,
    },
    privilege: {
      type: String,
      default: UserRole.USER,
      enum: UserRole,
      index: true,
    },
    progress: [
      {
        type: ObjectId,
        ref: "Progress",
        autopopulate: false,
        index: true,
      },
    ],
    isAdmin: { type: Boolean, default: false, index: true },
    gender: {
      type: String,
    },
    statusText: {
      type: String,
      default: userStatus?.[0],
      trim: true,
      index: true,
      enum: userStatus,
    },
    adminStatusText: {
      type: String,
      default: enableDisable?.[0],
      trim: true,
      index: true,
      enum: enableDisable,
    },
    status: {
      type: Boolean,
      index: true,
      default: true,
    },
    is2FAEnabled: {
      type: String,
      default: enableDisable?.[1],
      index: true,
      enum: enableDisable,
    },
    is2FASecret: {
      type: String,
    },
    is2FAType: {
      type: String,
    },
    bio: { type: String, trim: true },
    case: { type: String, trim: true },
    regMode: { type: String, trim: true },
    department: { type: String },
    courseEnrollments: [
      {
        course: {
          type: ObjectId,
          ref: "Course",
          autopopulate: false,
        },
        expiresAt: {
          type: Date,
          required: true,
        },
        isAssigned: {
          type: Boolean,
          default: false,
        },
      },
    ],
    expiredCourses: [
      {
        course: {
          type: ObjectId,
          ref: "Course",
          autopopulate: false,
        },
        expiresAt: {
          type: Date,
          required: true,
        },
      },
    ],
    organisation: {
      type: ObjectId,
      ref: "User",
      index: true,
    },
    addedBy: {
      type: ObjectId,
      ref: "User",
      autopopulate: {
        select:
          "firstName lastName email telephone avatar isAdmin privilege slug companyName",
      },
      index: true,
    },
    passwordVersion: { type: Number, default: 1, select: false },
    passwordResetToken: { type: String, select: false },
    passwordResetTokenExpires: { type: Date, select: false },
    emailInvitationToken: { type: String, select: false },
    emailInvitationStatus: {
      type: String,
      select: false,
      enum: Object.values(EmailInvitationEnum),
    },
    staffEmailInvitationSentAt: { type: Date, select: false },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

UserSchema.methods.generatePasswordResetToken = function () {
  const token = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  this.passwordResetToken = hashedToken;
  this.passwordResetTokenExpires = Date.now() + 20 * 60 * 1000;

  return token;
};

UserSchema.methods.generateEmailInvitationToken = function () {
  const token = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  this.emailInvitationToken = hashedToken;
  this.emailInvitationStatus = EmailInvitationEnum.PENDING;
  this.staffEmailInvitationSentAt = new Date();

  return token;
};

UserSchema.methods.checkAndExpireCourses = async function () {
  const now = new Date();
  const expiredCourseIds: Types.ObjectId[] = [];

  const activeEnrollments = this.courseEnrollments.filter(
    (enrollment: ICourseEnrollment) => {
      if (enrollment.expiresAt <= now) {
        const isAlreadyExpired = this.expiredCourses.some(
          (expiredItem) => expiredItem.course.toString() === enrollment.course.toString(),
        );

        if (!isAlreadyExpired) {
          this.expiredCourses.push({
            course: enrollment.course,
            expiresAt: enrollment.expiresAt,
          });
        }

        expiredCourseIds.push(enrollment.course);
        return false;
      }
      return true;
    },
  );

  this.courseEnrollments = activeEnrollments;
  if (expiredCourseIds.length > 0) {
    await this.save();

    const Course = mongoose.model("Course");
    await Course.updateMany(
      { _id: { $in: expiredCourseIds } },
      { $pull: { participants: this._id } },
    );
  }

  return expiredCourseIds;
};

UserSchema.statics.checkAllUsersForExpiredCourses = async function () {
  // const users = await this.find({"courseEnrollments.0": {$exists: true}});
  const users = await this.find({});
  for (const user of users) {
    await user.checkAndExpireCourses();
  }
};

UserSchema.statics.findByEmailInvitationToken = async function (
  email: string,
  token: string,
) {
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const user = await this.findOne({
    email,
    emailInvitationToken: hashedToken,
    emailInvitationStatus: EmailInvitationEnum.PENDING,
    staffEmailInvitationSentAt: { $gt: sevenDaysAgo },
  });

  return user;
};

UserSchema.statics.verifyToken = function (plainToken: string, hashedToken: string) {
  const rehashed = crypto.createHash("sha256").update(plainToken).digest("hex");
  return rehashed === hashedToken;
};

UserSchema.virtual("courses").get(function () {
  return this.courseEnrollments?.map((enrollment) => enrollment.course) || [];
});

export type UserDocument = InferSchemaType<typeof UserSchema>;

export default mongoose.model<IUserBase, IUserModel>("User", UserSchema);
