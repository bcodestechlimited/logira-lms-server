import "colors";
import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express, { Application, Request, Response } from "express";
import fileUpload from "express-fileupload";
import { create } from "express-handlebars";
import helmet from "helmet";
import { createServer } from "http";
import morgan from "morgan";
import morganBody from "morgan-body";
import NodeCache from "node-cache";
import path from "path";
import pino from "pino";
import pinoHttp from "pino-http";
import { handleAllowedOrigins } from "./Middlewares/allowed-origins.ts";
import connectDB from "./Middlewares/Db.ts";
import errorHandler from "./Middlewares/error-handler.ts";
import couponRouter from "./modules/coupon/coupon.routes.ts";
import uploadRouter from "./modules/upload/upload.routes.ts";
import AdminRouter from "./routes/admin.routes.ts";
import analyticsRouter from "./routes/analytics.routes.ts";
import UserRoute from "./routes/auth.routes.ts";
import BCTCourseRoute from "./routes/bct-course.routes.ts";
import CouponRoute from "./routes/coupon.routes.ts";
import CourseModuleRouter from "./routes/course-module.routes.ts";
import CourseRoute from "./routes/course.routes.ts";
import PaymentRoute from "./routes/payment.routes.ts";
import Planroute from "./routes/plan.routes.ts";
import progressRouter from "./routes/progress.routes.ts";
import templateRouter from "./routes/template.routes.ts";
import { startAgenda } from "./Services/scheduler.service.ts";
import "./utils/tracing.ts";
import certificateRouter from "./modules/certificates/certificate.routes.ts";

export const nodeClient = new NodeCache({ stdTTL: 100, checkperiod: 120 });

dotenv.config();

const app: Application = express();
app.use(express.json({ limit: "200mb" }));
const logger = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "info",
});
app.use(pinoHttp({ logger }));

app.set("trust proxy", 1);
app.use(compression());
app.use(
  cors({
    origin: handleAllowedOrigins,
    credentials: true,
  }),
);
app.use(express.urlencoded({ extended: true, limit: "200mb" }));
app.use(cookieParser());
app.use(
  fileUpload({
    createParentPath: true,
    limits: { fileSize: 200 * 1024 * 1024 },
    useTempFiles: true,
    abortOnLimit: true,
    tempFileDir: "/tmp/",
  }),
);

morganBody(app, {
  logResponseBody: false,
  immediateReqLog: true,
  logAllReqHeader: false,
  timezone: "Africa/Lagos",
  prettify: true,
  logRequestBody: true,
  logReqUserAgent: false,
});
app.use(morgan("dev"));
app.use(helmet());

app.use(express.static(path.join(__dirname, "Public")));

export const hbs2 = create({
  extname: "hbs",
  partialsDir: [path.join(__dirname, "views/partials")],
});

// set the view engine to ejs
app.engine("hbs", hbs2.engine);
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));

const server = createServer(app);

app.get("/", (req: Request, res: Response) => {
  res?.render("layouts/main", {
    year: new Date().getFullYear(),
    account: process?.env.ACCOUNT_NAME,
    image: `http${req?.headers?.host?.includes("localhost") ? "" : "s"}://${
      req?.headers?.host
    }/Logo.svg`,
  });
});

const BASE_URL = "/api/v1";
const BCT_BASE_URL = "/api/v1/bct";
app.use("/api/v1/health-check", (req: Request, res: Response) => {
  res.status(200).send("Server is healthy");
});

app.use(BASE_URL + "/course", CourseRoute);
app.use(BASE_URL + "/plans", Planroute);
app.use(BASE_URL + "/user", UserRoute);
app.use(BASE_URL + "/course-modules", CourseModuleRouter);
app.use(BASE_URL + "/coupons", CouponRoute);
// app.use(BASE_URL + "/coupons", couponRouter);
app.use(BASE_URL + "/templates", templateRouter);
app.use(BASE_URL + "/certificates", certificateRouter);
app.use(BASE_URL + "/payments", PaymentRoute);
app.use(BASE_URL + "/admins", AdminRouter);
app.use(BASE_URL + "/analytics", analyticsRouter);
app.use(BASE_URL + "/progress", progressRouter);
app.use(BASE_URL + "/uploads", uploadRouter);
app.use(BASE_URL + "/course-coupons", couponRouter);
app.use(BCT_BASE_URL + "/bct-course", BCTCourseRoute);

// Page not found
app.use((req: Request, res: Response) => {
  res.status(400).json({
    error: [{ message: `Route not found`, path: "server" }],
  });
});

// error handler
app.use(errorHandler);

const port = process.env.PORT || 8080;

connectDB().then(() => {
  server.listen(port, async () => {
    console.log(`[SERVER 📢]: Server running on port:${port}`);

    await startAgenda();
    // seedAdmin().then(() => {
    //   console.log("Admin created");
    // });
  });
});
