import bcrypt from "bcryptjs";
import "dotenv/config";
import mongoose from "mongoose";
import User, { UserRole } from "../models/User.ts";
// mongoose.set("strictQuery", true);

const connectDB = async () => {
  try {
    let uri: string = process.env.MONGO_URI || "";
    await mongoose.connect(uri, {
      dbName: process.env.DB_NAME,
    });
    console.log("[DATABASE 📢]: DB connected to MONGODB 🚀🚀".bgBlack.blue);
  } catch (err) {
    console.log(err);
    if (err) throw err;
  }
};

export default connectDB;
