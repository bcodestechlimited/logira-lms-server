import "dotenv/config";
import mongoose from "mongoose";
import fs from "fs";
import BCTCourse from "../models/bct-course.model";

const fileData = fs.readFileSync("./courses.json", "utf-8").toString();
const courseObj = JSON.parse(fileData);

// TODO: change the mongodb uri here to bct's uri
async function connectToDB() {
  try {
    await mongoose.connect("");

    // ICS LMS DATABASE URI =>

    // BCT LMS DATABASE URI =>
    console.log(`Connected to MongoDB`);
  } catch (error) {
    console.log(error);
    console.error("Error connecting to MongoDB", error);
    process.exit(1);
  }
}

async function importData() {
  try {
    await connectToDB();
    const course = await BCTCourse.insertMany(courseObj);

    console.log("Course data imported successfully");
  } catch (error) {
    console.log(error);
  }
}

async function deleteData() {
  try {
    await connectToDB();
    const course = await BCTCourse.deleteMany();
    console.log(`Course data deleted successfully`);
  } catch (error) {
    console.log(error);
  }
}

async function data() {
  if (process.argv[2] === "--import") {
    await importData();
    process.exit();
  } else if (process.argv[2] === "--delete") {
    await deleteData();
    process.exit();
  } else {
    process.exit();
  }
}

data();

// node seed.ts --import
// node seed.ts --delete
