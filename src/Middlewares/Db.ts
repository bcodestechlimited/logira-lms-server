import bcrypt from "bcryptjs";
import "dotenv/config";
import mongoose from "mongoose";
import User, { UserRole } from "../models/User.ts";
// mongoose.set("strictQuery", true);

const connectDB = async () => {
  try {
    let uri: string = process.env.MONGO_URI || "";
    // let uri: string = process.env.LOCAL_MONGO_URI || "";
    await mongoose.connect(uri, {
      dbName:
        process.env.NODE_ENV === "development"
          ? "ics-lms-live-staging"
          : "ics-lms",
    });
    console.log("[DATABASE 📢]: DB connected to MONGODB 🚀🚀".bgBlack.blue);
  } catch (err) {
    console.log(err);
    if (err) throw err;
  }
};

export default connectDB;

export const seedAdmin = async () => {
  try {
    const adminEmail = String(process.env.ADMIN_EMAIL) || "admin@bct.com";
    let findAdmin = await User.findOne({
      email: adminEmail,
    });
    let salt = await bcrypt.genSalt(12);
    // Save password
    let savePassword = await bcrypt.hash(`pass123`, salt);

    if (findAdmin) {
      console.log("Admin account exists: ", { findAdmin });
      return;
    }

    const admin = await User.create({
      firstName: "BCT",
      lastName: "Admin",
      email: adminEmail,
      isAdmin: true,
      isEmailVerified: true,
      privilege: UserRole.SUPERADMIN,
      role: UserRole.SUPERADMIN,
      status: true,
      statusText: "activated",
      extrasPath: null,
      password: savePassword,
    });

    console.log({ admin }, "Admin seeded successfully");
  } catch (error) {
    console.log({ error }, "seeding");
  }
};
