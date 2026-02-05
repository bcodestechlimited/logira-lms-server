import axios from "axios";
import fs from "fs/promises";
import { StatusCodes } from "http-status-codes";
import path from "path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import CertificateTemplate from "../models/certificate-template.model";
import Certificate from "../models/certificate.model";
import Course from "../models/Course";
import CourseCompletion from "../models/course-completion.model";
import User, { IUserBase } from "../models/User";
import { IQueryParams, UserSortBy } from "../shared/query.interface";
import { coerceNumber } from "../utils/course-helpers";
import { paginate } from "../utils/paginate";
import { ApiSuccess } from "../utils/response-handler";
import { ServiceResponse } from "../utils/service-response";
import { emailService } from "./mail.service";

const UPLOAD_ROOT = path.join(process.cwd(), "uploads");
const CERT_FOLDER = "certificates";

class CertificateService {
  // TODO: CODE TO ISSUE CERTIFICATE
  public async issueCertificate(userId: string, courseId: string) {
    try {
      const [user, course] = await Promise.all([
        User.findById(userId),
        Course.findById(courseId),
      ]);
      if (!user || !course) {
        return ServiceResponse.failure(
          "User or course not found",
          null,
          StatusCodes.NOT_FOUND,
        );
      }

      if (!user || !course) {
        return ServiceResponse.failure(
          "User or course not found",
          null,
          StatusCodes.NOT_FOUND,
        );
      }

      const existingCompletion = await CourseCompletion.findOne({
        userId: userId,
        courseId: courseId,
      });

      if (!existingCompletion) {
        await CourseCompletion.create({
          userId: userId,
          courseId: courseId,
          completedAt: new Date(),
        });
      }

      const issueDate = new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date());
      const fullName = `${user.firstName}  ${user.lastName}`;

      //  Generate certificate
      const pdfBuffer: Buffer = await this.generatePDF(
        fullName,
        course.title,
        issueDate,
      );

      const certDir = path.join(UPLOAD_ROOT, CERT_FOLDER);
      await fs.mkdir(certDir, { recursive: true });

      const fileName = `cert-${userId}-${courseId}-${Date.now()}.pdf`;
      const savePath = path.join(certDir, fileName);

      const uint8 = new Uint8Array(
        pdfBuffer.buffer,
        pdfBuffer.byteOffset,
        pdfBuffer.byteLength,
      );
      await fs.writeFile(savePath, uint8);

      // Save certificate record to database
      const certificate = await Certificate.create({
        userId,
        courseId,
        fileName,
        path: path.join(CERT_FOLDER, fileName),
        issuedAt: new Date(),
      });
      // send email to the user
      const emailPayload = {
        subject: `Certificate of Completion - ${course.title}`,
        template: "certificate",
        to: user.email,
        variables: {
          userName: fullName,
          courseTitle: course.title,
          issueDate: issueDate,
          courseId: courseId,
          certificateId: certificate._id,
        },
        attachments: [
          {
            filename: `${course.title.replace(/\s+/g, "_")}_Certificate.pdf`,
            content: pdfBuffer.toString("base64"),
            encoding: "base64",
          },
        ],
      };
      const emailResponse = await emailService.sendEmailTemplate(emailPayload);

      return ServiceResponse.success(
        "Certificate issued successfully",
        { data: pdfBuffer },
        StatusCodes.OK,
      );
    } catch (error) {
      console.log("error", error);
      return ServiceResponse.failure(
        "Failed to issue certificate",
        null,
        StatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // todo: fix the error in this code
  public async generatePDF(
    studentName: string,
    courseTitle: string,
    issueDate: string,
  ): Promise<Buffer> {
    // 1) Load template
    const templateBuffer = await this.fetchTemplateBuffer();
    const pdfDoc = await PDFDocument.load(templateBuffer);

    // 2) Try AcroForm first
    try {
      const form = pdfDoc.getForm();
      const fieldNames = new Set(form.getFields().map((f) => f.getName()));
      const certificateNumber = await this.generateCertificateNumber();

      // Fill by available fields
      if (fieldNames.has("studentName")) {
        form.getTextField("studentName").setText(studentName);
      } else if (fieldNames.has("firstName") || fieldNames.has("lastName")) {
        const [firstName, ...rest] = studentName.trim().split(/\s+/);
        const lastName = rest.join(" ");
        if (fieldNames.has("firstName"))
          form.getTextField("firstName").setText(firstName || "");
        if (fieldNames.has("lastName"))
          form.getTextField("lastName").setText(lastName || "");
      }

      if (fieldNames.has("courseTitle")) {
        form.getTextField("courseTitle").setText(courseTitle);
      }
      if (fieldNames.has("issueDate")) {
        form.getTextField("issueDate").setText(issueDate);
      }
      if (fieldNames.has("certificateNumber")) {
        form.getTextField("certificateNumber").setText(certificateNumber);
      }

      form.flatten();
      const pdfBytes = await pdfDoc.save();
      return Buffer.from(pdfBytes);
    } catch {
      // No valid form fields → fall back to overlay rendering
    }

    // 3) Overlay fallback with neat typography
    const page = pdfDoc.getPages()[0];
    const { width, height } = page.getSize();

    // Fonts: try custom TTFs (assets/fonts), fall back to standard fonts
    const fontsDir = path.join(process.cwd(), "assets", "fonts");
    const tryReadFont = async (file: string) => {
      try {
        return await fs.readFile(path.join(fontsDir, file));
      } catch {
        return undefined;
      }
    };
    const playfairBold = await tryReadFont("PlayfairDisplay-Bold.ttf");
    const interRegular = await tryReadFont("Inter-Regular.ttf");

    const fontName = playfairBold
      ? await pdfDoc.embedFont(StandardFonts.Helvetica)
      : await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const fontBody = interRegular
      ? await pdfDoc.embedFont(StandardFonts.Helvetica)
      : await pdfDoc.embedFont(StandardFonts.Helvetica);

    const certificateNumber = await this.generateCertificateNumber();

    const POS = {
      studentName: {
        x: 0.5,
        y: 0.62,
        maxWidth: 0.78,
        size: 34,
        align: "center" as const,
      },
      courseTitle: {
        x: 0.5,
        y: 0.49,
        maxWidth: 0.8,
        size: 18,
        align: "center" as const,
      },
      issueDate: {
        x: 0.5,
        y: 0.43,
        maxWidth: 0.4,
        size: 14,
        align: "center" as const,
      },
      certNumber: {
        x: 0.2,
        y: 0.12,
        maxWidth: 0.4,
        size: 12,
        align: "left" as const,
      },
    };

    const drawText = (
      text: string,
      cfg: {
        x: number;
        y: number;
        maxWidth: number;
        size: number;
        align: "left" | "center" | "right";
        font: any;
        color?: any;
      },
    ) => {
      const px = width * cfg.x;
      const py = height * cfg.y;
      const maxW = width * cfg.maxWidth;
      const finalSize = this.fitTextToWidth(text, cfg.font, cfg.size, maxW);
      const textWidth = cfg.font.widthOfTextAtSize(text, finalSize);

      let x = px;
      if (cfg.align === "center") x = px - textWidth / 2;
      if (cfg.align === "right") x = px - textWidth;

      page.drawText(text, {
        x,
        y: py,
        size: finalSize,
        font: cfg.font,
        color: cfg.color ?? rgb(0, 0, 0),
      });
    };

    // Render text
    drawText(studentName, { ...POS.studentName, font: fontName });
    drawText(courseTitle, { ...POS.courseTitle, font: fontBody });
    drawText(issueDate, { ...POS.issueDate, font: fontBody });
    drawText(certificateNumber, { ...POS.certNumber, font: fontBody });

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  private async fetchTemplateBuffer(): Promise<Uint8Array> {
    const doc = await CertificateTemplate.findOne();
    if (!doc) {
      throw new Error("No certificate template configured in DB");
    }

    const response = await axios.get<ArrayBuffer>(doc.url, {
      responseType: "arraybuffer",
    });
    return new Uint8Array(response.data);
  }

  private fitTextToWidth(
    text: string,
    font: any,
    initialSize: number,
    maxWidth: number,
  ) {
    let size = initialSize;
    while (size > 8 && font.widthOfTextAtSize(text, size) > maxWidth) {
      size -= 0.5;
    }
    return size;
  }

  // note: special admin service to test the certificate
  public async testIssueCertificate() {
    try {
      const fullName = "David Bodunrin";
      const courseTitle = "Software Engineering Fundamentals";
      const issueDate = "2025-07-12";
      const userId = "67f521acda633b5ce433684e";
      const courseId = "67cee1842f8c56d684bc5469";
      const userEmail = "bodunrindavidbond@gmail.com";

      const pdfBuffer: Buffer = await this.generatePDF(
        fullName,
        courseTitle,
        issueDate,
      );

      const certDir = path.join(UPLOAD_ROOT, CERT_FOLDER);
      await fs.mkdir(certDir, { recursive: true });

      const fileName = `cert-${userId}-${courseId}-${Date.now()}.pdf`;
      const savePath = path.join(certDir, fileName);

      const uint8 = new Uint8Array(
        pdfBuffer.buffer,
        pdfBuffer.byteOffset,
        pdfBuffer.byteLength,
      );
      await fs.writeFile(savePath, uint8);

      // Save certificate record to database
      const certificate = await Certificate.create({
        userId,
        courseId,
        fileName,
        path: path.join(CERT_FOLDER, fileName),
        issuedAt: new Date(),
      });
      // send email to the user
      const emailPayload = {
        subject: `Certificate of Completion - ${courseTitle}`,
        template: "certificate",
        to: userEmail,
        variables: {
          userName: fullName,
          courseTitle: courseTitle,
          issueDate: issueDate,
          courseId: courseId,
          certificateId: certificate._id,
        },
        attachments: [
          {
            filename: `${courseTitle.replace(/\s+/g, "_")}_Certificate.pdf`,
            content: pdfBuffer.toString("base64"),
            encoding: "base64",
          },
        ],
      };
      const emailResponse = await emailService.sendEmailTemplate(emailPayload);

      return ServiceResponse.success(
        "Certificate issued successfully",
        null,
        StatusCodes.OK,
      );
    } catch (error) {
      return ServiceResponse.failure(
        "Failed to issue certificate",
        null,
        StatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  }

  public async fetchStudentsWithIssuedCertificate(query: IQueryParams) {
    const page = coerceNumber(query.page, 1);
    const limit = coerceNumber(query.limit, 20);
    const search = (query.search ?? "").trim();
    const sortBy = (query.sortBy ?? "createdAt") as UserSortBy;
    const sortOrder = query.sortOrder === "asc" ? 1 : -1;
    const sort: Record<string, 1 | -1> = {};

    const filterQuery: Record<string, any> = {};
    if (search) {
      filterQuery.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    switch (sortBy) {
      case "email":
        sort.email = sortOrder;
        break;
      case "createdAt":
        sort.createdAt = sortOrder;
        break;
      default:
        sort.createdAt = -1;
        break;
    }

    const { documents: users, pagination } = await paginate<IUserBase>({
      model: User,
      query: filterQuery,
      page,
      limit,
      sort,
    });

    return ApiSuccess.ok("Certificates retrieved successfully", {
      users,
      pagination,
    });
  }

  public async fetchCertificatesByUserId({
    userId,
    options,
  }: {
    userId: string;
    options: {
      page: number;
      limit: number;
      sort?: any;
    };
  }) {
    const query = { userId };
    const certificates = await Certificate.paginate(query, {
      page: options.page,
      limit: options.limit,
      sort: options.sort || { issuedAt: -1 },
      populate: {
        path: "courseId",
        select: "title image",
      },
      lean: true,
    });

    return {
      data: certificates.docs.map((certificate) => ({
        _id: certificate._id,
        course_title: certificate.courseId?.title as unknown as string,
        course_image: certificate.courseId?.image as unknown as string,
        issuedAt: certificate.issuedAt,
      })),
      meta: {
        total: certificates.totalDocs,
        limit: certificates.limit,
        page: certificates.page,
        pages: certificates.totalPages,
        hasNextPage: certificates.hasNextPage,
        hasPrevPage: certificates.hasPrevPage,
        nextPage: certificates.nextPage,
        prevPage: certificates.prevPage,
      },
    };
  }

  private async generateCertificateNumber() {
    return "015";
  }
}

export const certificateService = new CertificateService();
export default CertificateService;

/***
 *   public async generatePDF(
    studentName: string,
    courseTitle: string,
    issueDate: string
  ): Promise<Buffer> {
    // 1. Load the form-enabled template
    const templateBuffer = await this.fetchTemplateBuffer();

    // 2. Grab the AcroForm
    const pdfDoc = await PDFDocument.load(templateBuffer);
    const form = pdfDoc.getForm();

    // 3. Fill each field by name
    form.getTextField("studentName").setText(studentName);
    form.getTextField("courseTitle").setText(courseTitle);
    form.getTextField("issueDate").setText(issueDate);

    // 4. Flatten form so the fields become static text
    form.flatten();

    // 5. Save and return as a Buffer
    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }
 */
