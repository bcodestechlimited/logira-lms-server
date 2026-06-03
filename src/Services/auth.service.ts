import bcrypt from "bcryptjs";
import crypto from "crypto";
import { StatusCodes } from "http-status-codes";
import { APP_CONFIG } from "../config/app.config";
import { RegisterPayloadInterface } from "../interfaces/auth.interface";
import User, { EmailInvitationEnum, UserRole } from "../models/User";
import { ServiceResponse } from "../utils/service-response";
import {
  generateActivationToken,
  generateUserAccessToken,
  verifyActivationToken,
} from "../utils/utils-token";
import { emailService } from "./mail.service";

class AuthService {
  public async login(email: string, password: string) {
    try {
      const user = await User.findOne({ email })
        .populate("password")
        .select(
          "password firstName lastName email _id role privilege isEmailVerified isActive passwordVersion",
        )
        .lean();

      if (!user) {
        return ServiceResponse.failure("User not found", null, StatusCodes.NOT_FOUND);
      }
      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        return ServiceResponse.failure(
          "Password or email is not correct",
          null,
          StatusCodes.BAD_REQUEST,
        );
      }

      await User.findByIdAndUpdate(user._id, {
        $set: { lastVisited: new Date() },
      });

      const payload = {
        userId: user._id.toString(),
        passwordVersion: user.passwordVersion,
      };

      const accessToken = generateUserAccessToken(payload);
      if (!accessToken) {
        return ServiceResponse.failure("Error", null, StatusCodes.BAD_REQUEST);
      }

      const responseObject = {
        message: "Logged in successfully",
        token: accessToken,
        user: {
          _id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isActive: user.isActive,
          isEmailVerified: user.isEmailVerified,
        },
      };
      return ServiceResponse.success("Success", responseObject, StatusCodes.OK);
    } catch (error) {
      return ServiceResponse.failure("Error", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  public async register({
    email,
    firstName,
    lastName,
    password,
    telephone,
  }: RegisterPayloadInterface) {
    try {
      const checkIfUserExists = await User.findOne({ email });
      if (checkIfUserExists) {
        return ServiceResponse.failure(
          "User account exists, Login!",
          null,
          StatusCodes.BAD_REQUEST,
        );
      }
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await User.create({
        firstName: firstName,
        lastName: lastName,
        email: email,
        privilege: UserRole.USER,
        password: passwordHash,
        telephone: telephone,
      });

      if (!user) {
        return ServiceResponse.failure(
          "Error occurred while creating user account, Try again!",
          null,
          StatusCodes.BAD_REQUEST,
        );
      }

      // Email verification
      const activationToken = generateActivationToken(user.id.toString());
      const activationLink = `${APP_CONFIG.CLIENT_FRONTEND_BASE_URL}/auth/user/activate?token=${activationToken}`;

      const emailResponse = await emailService.sendEmailTemplate({
        subject: "Account Verification",
        template: "account-creation",
        to: user.email,
        variables: {
          name: user.firstName,
          activationLink: activationLink,
        },
      });
      if (emailResponse.status !== "ok") {
        return ServiceResponse.failure(
          "Error sending mail, Try again!",
          null,
          StatusCodes.BAD_REQUEST,
        );
      }

      return ServiceResponse.success(
        "Account Created!, check your email to verify account",
        user,
        StatusCodes.CREATED,
      );
    } catch (error) {
      return ServiceResponse.failure(
        "Internal Server Error",
        null,
        StatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  }

  public async activateAccount(token: string) {
    try {
      if (!token) {
        return ServiceResponse.failure(
          "Error verifying email link",
          null,
          StatusCodes.BAD_REQUEST,
        );
      }

      const decoded = verifyActivationToken(token);
      if (!decoded) {
        return ServiceResponse.failure(
          "Invalid or expired activation token",
          null,
          StatusCodes.BAD_REQUEST,
        );
      }
      const user = await User.findById({ _id: decoded.id });
      if (!user) {
        return ServiceResponse.failure("User not found", null, StatusCodes.NOT_FOUND);
      }
      user.isEmailVerified = true;
      await user.save();
      const payload = {
        success: true,
      };
      return ServiceResponse.success(
        "Account activated successfully",
        payload,
        StatusCodes.OK,
      );
    } catch (error) {
      return ServiceResponse.failure(
        "Internal Server Error",
        null,
        StatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  }

  public async forgotPassword(email: string, resetUrl: string) {
    try {
      const user = await User.findOne({ email }).populate("passwordVersion");
      if (!user) {
        return ServiceResponse.failure("User not found", null, StatusCodes.NOT_FOUND);
      }

      const resetToken = crypto.randomBytes(32).toString("hex");
      const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");
      user.passwordResetToken = hashedToken;
      user.passwordResetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);
      const token = resetToken;

      await user.save();
      const emailPayload = {
        subject: "Password Reset",
        template: "reset-password",
        to: user.email,
        variables: {
          resetPasswordUrl: `${resetUrl}?token=${token}`,
          userName: user.firstName,
          companyName: APP_CONFIG.COMPANY_NAME,
        },
      };

      const emailResponse = await emailService.sendEmailTemplate(emailPayload);

      if (emailResponse.status !== "ok") {
        return ServiceResponse.failure(
          "Error sending mail, Try again!",
          null,
          StatusCodes.BAD_REQUEST,
        );
      }

      return ServiceResponse.success(
        "Password reset link sent successfully",
        null,
        StatusCodes.OK,
      );
    } catch (error) {
      return ServiceResponse.failure(
        "Internal Server Error",
        null,
        StatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  }

  public async resetPassword(token: string, password: string) {
    try {
      const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

      const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetTokenExpires: { $gt: Date.now() },
      }).select("+passwordVersion");
      if (!user) {
        const expiredUser = await User.findOne({
          passwordResetToken: hashedToken,
        });

        if (expiredUser) {
          return ServiceResponse.failure(
            "Token has expired. Please request a new password reset link.",
            null,
            StatusCodes.BAD_REQUEST,
          );
        } else {
          return ServiceResponse.failure(
            "Invalid token. Please request a new password reset link.",
            null,
            StatusCodes.BAD_REQUEST,
          );
        }
      }

      const passwordHash = await bcrypt.hash(password, 10);
      user.password = passwordHash;
      user.passwordVersion += 1;
      user.passwordResetToken = null;
      user.passwordResetTokenExpires = null;

      await user.save();
      const responseObject = {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        email: user.email,
      };

      const emailPayload = {
        subject: "Your password has been changed",
        template: "password-changed",
        to: user.email,
        variables: {
          userName: user.firstName,
          companyName: APP_CONFIG.COMPANY_NAME,
          logoUrl: APP_CONFIG.LOGO_URL,
          supportUrl: APP_CONFIG.SUPPORT_EMAIL,
          loginUrl: `${APP_CONFIG.CLIENT_FRONTEND_BASE_URL}/auth/login`,
        },
      };

      await emailService.sendEmailTemplate(emailPayload);

      return ServiceResponse.success(
        "Password reset successfully",
        responseObject,
        StatusCodes.OK,
      );
    } catch (error) {
      return ServiceResponse.failure(
        "Internal server error",
        null,
        StatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // idea: future implementation
  public async inviteStaff(email: string) {
    try {
      const checkUser = await User.findOne({ email });
      if (checkUser) {
        return ServiceResponse.failure("User exists", null, StatusCodes.BAD_REQUEST);
      }
    } catch (error) {
      return ServiceResponse.failure(
        "Internal server error",
        null,
        StatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  }

  public async updatePassword(userId: string, password: string, newPassword: string) {
    try {
      const user = await User.findById(userId).select("+password +passwordVersion");
      if (!user) {
        return ServiceResponse.failure("User not found", null, StatusCodes.NOT_FOUND);
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return ServiceResponse.failure(
          "Password is incorrect",
          null,
          StatusCodes.UNAUTHORIZED,
        );
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);
      user.password = passwordHash;
      user.passwordVersion += 1;

      await user.save();
      const responseObject = {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        email: user.email,
      };

      return ServiceResponse.success(
        "Password updated successfully",
        responseObject,
        StatusCodes.OK,
      );
    } catch (error) {
      return ServiceResponse.failure(
        "Internal server error",
        null,
        StatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // test: test this service
  public async onboardStaff({
    email,
    token,
    password,
    newPassword,
  }: {
    email: string;
    token: string;
    password: string;
    newPassword: string;
  }) {
    try {
      const user = await User.findByEmailInvitationToken(email, token);
      if (!user) {
        return ServiceResponse.failure(
          "Invalid or expired invitation link",
          null,
          StatusCodes.BAD_REQUEST,
        );
      }
      user.isEmailVerified = true;
      user.emailInvitationStatus = EmailInvitationEnum.ACCEPTED;
      user.emailInvitationToken = null;

      const updatePasswordResponse = await this.updatePassword(
        user?.id,
        password,
        newPassword,
      );
      if (!updatePasswordResponse.success) {
        return updatePasswordResponse;
      }
      await user.save();

      return ServiceResponse.success(
        "Staff onboarded successfully",
        {
          user: {
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
          },
        },
        StatusCodes.OK,
      );
    } catch (error) {
      return ServiceResponse.failure(
        "Internal server error",
        null,
        StatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  }

  public async checkifUserExists(email: string) {
    const user = await User.findOne({ email });
    return user;
  }
}

export const authService = new AuthService();
export default AuthService;
