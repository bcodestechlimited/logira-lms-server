import mongoose from "mongoose";
import User, { UserRole } from "../models/User";
import bcrypt from "bcryptjs";

export const seedAdmin = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error("MONGO_URI is not defined");
    }
    await mongoose.connect(mongoUri, {
      dbName: process.env.DB_NAME,
    });
    console.log("MongoDB Connected successfully");

    const adminEmail = String(process.env.ADMIN_EMAIL) || "admin@bct.com";
    let findAdmin = await User.findOne({
      email: adminEmail,
    });
    let salt = await bcrypt.genSalt(12);
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
    process.exitCode = 1;
  } finally {
    console.log('Script completed')
    await mongoose.disconnect();
    process.exit(0);
  }
};

seedAdmin()
