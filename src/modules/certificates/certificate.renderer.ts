// modules/certificates/certificate.renderer.ts
import fs from "fs/promises";
import path from "path";
import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

import { CERTIFICATE_TEMPLATE } from "./certificate.config";

export type RenderCertificateInput = {
  studentName: string;
  courseTitle: string;
  issuedOn: Date; // you can format before passing if you prefer
  certificateNumber: string;
  // Optional: allow passing a signature image (PNG = Portable Network Graphics) path/buffer
  signaturePngBytes?: Uint8Array;
};

export type RenderCertificateOptions = {
  templatePdfBytes?: Uint8Array; // if you want to load from storage instead of disk
  fontBytes?: Uint8Array; // custom .ttf/.otf if institution provides it
};

type TextAlign = "left" | "center" | "right";

type TextBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  maxLines: number;
  fontSize: number;
  minFontSize: number;
  lineHeight: number;
  align: TextAlign;
};

type TextPoint = {
  x: number;
  y: number;
  fontSize: number;
  align: TextAlign;
};

const formatIssuedOn = (date: Date) => {
  // Example: "02 Feb, 2026"
  const d = new Date(date);
  const day = `${d.getDate()}`.padStart(2, "0");
  const month = d.toLocaleString("en-GB", { month: "short" });
  const year = d.getFullYear();
  return `${day} ${month}, ${year}`;
};

const measureTextWidth = (font: PDFFont, text: string, fontSize: number) => {
  return font.widthOfTextAtSize(text, fontSize);
};

const splitWords = (text: string) => {
  return text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
};

const wrapTextToWidth = (args: {
  font: PDFFont;
  text: string;
  fontSize: number;
  maxWidth: number;
}) => {
  const { font, text, fontSize, maxWidth } = args;

  const words = splitWords(text);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let current = words[0] ?? "";

  for (let i = 1; i < words.length; i++) {
    const nextWord = words[i] as string;
    const test = `${current} ${nextWord}`;
    const testWidth = measureTextWidth(font, test, fontSize);

    if (testWidth <= maxWidth) {
      current = test;
      continue;
    }

    // push current line and start new
    lines.push(current);
    current = nextWord;
  }

  lines.push(current);

  return lines;
};

const fitTextInBox = (args: { font: PDFFont; text: string; box: TextBox }) => {
  const { font, text, box } = args;

  // Strategy:
  // 1) Try single line with shrinking font until it fits maxWidth
  // 2) If still too wide at min font size, wrap into multiple lines (maxLines)
  // 3) If wrapped lines exceed maxLines, shrink font and wrap again
  // 4) If still too long, truncate last line with ellipsis

  const cleanText = text.replace(/\s+/g, " ").trim();
  if (!cleanText) {
    return { lines: [""], fontSize: box.fontSize };
  }

  // 1) Try fit as a single line by shrinking
  let fontSize = box.fontSize;
  const singleLineWidthAt = (size: number) =>
    measureTextWidth(font, cleanText, size);

  while (fontSize > box.minFontSize) {
    if (singleLineWidthAt(fontSize) <= box.width) {
      return { lines: [cleanText], fontSize };
    }
    fontSize -= 1;
  }

  // 2) Wrap at min (or current) fontSize
  fontSize = Math.max(fontSize, box.minFontSize);
  let lines = wrapTextToWidth({
    font,
    text: cleanText,
    fontSize,
    maxWidth: box.width,
  });

  // 3) If too many lines, reduce font size and retry wrapping
  while (lines.length > box.maxLines && fontSize > box.minFontSize) {
    fontSize -= 1;
    lines = wrapTextToWidth({
      font,
      text: cleanText,
      fontSize,
      maxWidth: box.width,
    });
  }

  // 4) If still too many lines at minFontSize, truncate
  if (lines.length > box.maxLines) {
    lines = lines.slice(0, box.maxLines);

    const lastIndex = box.maxLines - 1;
    let last = lines[lastIndex] ?? "";
    const ellipsis = "…";

    // Trim last line until it fits with ellipsis
    while (last.length > 0) {
      const test = `${last}${ellipsis}`;
      if (measureTextWidth(font, test, fontSize) <= box.width) {
        lines[lastIndex] = test;
        break;
      }
      last = last.slice(0, -1).trimEnd();
    }

    if (last.length === 0) {
      lines[lastIndex] = ellipsis;
    }
  }

  // Also ensure it fits vertically in the box
  const totalHeight = lines.length * box.lineHeight;
  if (totalHeight > box.height) {
    // If vertical overflow, shrink lineHeight a bit (safe fallback)
    // You can also reduce fontSize further if you prefer.
    // For now: we keep fontSize and accept minor overflow risk.
  }

  return { lines, fontSize };
};

const drawTextAligned = (args: {
  page: PDFPage;
  font: PDFFont;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  align: TextAlign;
  maxWidth?: number; // needed for center/right align
}) => {
  const { page, font, text, x, y, fontSize, align, maxWidth } = args;

  const textWidth = measureTextWidth(font, text, fontSize);

  let drawX = x;
  if (align === "center") {
    if (typeof maxWidth !== "number") {
      // If maxWidth not provided, treat x as center point
      drawX = x - textWidth / 2;
    } else {
      // x is left of box, center within box width
      drawX = x + (maxWidth - textWidth) / 2;
    }
  }

  if (align === "right") {
    if (typeof maxWidth !== "number") {
      // If maxWidth not provided, treat x as right anchor
      drawX = x - textWidth;
    } else {
      drawX = x + (maxWidth - textWidth);
    }
  }

  page.drawText(text, {
    x: drawX,
    y,
    size: fontSize,
    font,
    // Use black by default; change if template needs something else.
    color: rgb(0, 0, 0),
  });
};

const drawTextInBox = (args: {
  page: PDFPage;
  font: PDFFont;
  text: string;
  box: TextBox;
}) => {
  const { page, font, text, box } = args;

  const { lines, fontSize } = fitTextInBox({ font, text, box });

  // Vertical centering: place block of lines centered within box height
  const blockHeight = lines.length * box.lineHeight;
  const startY =
    box.y + (box.height - blockHeight) / 2 + (box.lineHeight - fontSize) / 2;

  lines.forEach((line, idx) => {
    const y = startY + (lines.length - 1 - idx) * box.lineHeight;
    drawTextAligned({
      page,
      font,
      text: line,
      x: box.x,
      y,
      fontSize,
      align: box.align,
      maxWidth: box.width,
    });
  });
};

const drawSignature = async (args: {
  pdfDoc: PDFDocument;
  page: PDFPage;
  signaturePngBytes: Uint8Array;
  box: { x: number; y: number; width: number; height: number };
}) => {
  const { pdfDoc, page, signaturePngBytes, box } = args;

  const image = await pdfDoc.embedPng(signaturePngBytes);

  const imgW = image.width;
  const imgH = image.height;

  // Fit "contain": preserve aspect ratio, center within box
  const scale = Math.min(box.width / imgW, box.height / imgH);
  const drawW = imgW * scale;
  const drawH = imgH * scale;

  const drawX = box.x + (box.width - drawW) / 2;
  const drawY = box.y + (box.height - drawH) / 2;

  page.drawImage(image, {
    x: drawX,
    y: drawY,
    width: drawW,
    height: drawH,
  });
};

const loadDefaultTemplateBytes = async () => {
  // Adjust this path to wherever you store the PDF template in your project.
  const templatePath = path.resolve(
    process.cwd(),
    "assets/certificates/template.pdf",
  );
  const buf = await fs.readFile(templatePath);
  return new Uint8Array(buf);
};

const loadDefaultSignatureBytes = async () => {
  // Optional: if you want a default signature stored in repo.
  // If you don’t want a default, remove this and always pass signaturePngBytes in input.
  const signaturePath = path.resolve(
    process.cwd(),
    "assets/certificates/signature.png",
  );
  const buf = await fs.readFile(signaturePath);
  return new Uint8Array(buf);
};

export const renderCertificatePdf = async (
  input: RenderCertificateInput,
  options: RenderCertificateOptions = {},
) => {
  const templatePdfBytes =
    options.templatePdfBytes ?? (await loadDefaultTemplateBytes());

  const pdfDoc = await PDFDocument.load(templatePdfBytes);
  pdfDoc.registerFontkit(fontkit);

  // Single page assumption
  const page = pdfDoc.getPage(0);

  // Font
  // If institution provides a font file (.ttf/.otf), pass it via options.fontBytes.
  // Otherwise fall back to a standard embedded font.
  const font = options.fontBytes
    ? await pdfDoc.embedFont(options.fontBytes, { subset: true })
    : await pdfDoc.embedFont(StandardFonts.Helvetica);

  const fields = CERTIFICATE_TEMPLATE.fields;

  // 1) Student name
  drawTextInBox({
    page,
    font,
    text: input.studentName,
    box: fields.studentNameBox,
  });

  // 2) Course title
  drawTextInBox({
    page,
    font,
    text: input.courseTitle,
    box: fields.courseTitleBox,
  });

  // 3) Issued on
  const issuedOnText = formatIssuedOn(input.issuedOn);
  drawTextAligned({
    page,
    font,
    text: issuedOnText,
    x: fields.issuedOnValue.x,
    y: fields.issuedOnValue.y,
    fontSize: fields.issuedOnValue.fontSize,
    align: fields.issuedOnValue.align,
  });

  // 4) Certificate number
  drawTextAligned({
    page,
    font,
    text: input.certificateNumber,
    x: fields.certificateNumberValue.x,
    y: fields.certificateNumberValue.y,
    fontSize: fields.certificateNumberValue.fontSize,
    align: fields.certificateNumberValue.align,
  });

  // 5) Signature
  const signatureBytes =
    input.signaturePngBytes ??
    (await loadDefaultSignatureBytes().catch(() => undefined));

  if (signatureBytes) {
    await drawSignature({
      pdfDoc,
      page,
      signaturePngBytes: signatureBytes,
      box: fields.signatureBox,
    });
  }

  const outBytes = await pdfDoc.save();
  return Buffer.from(outBytes);
};
