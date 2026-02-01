import xlsx from "xlsx";
import { isValidEmail } from "../../utils/custom-validation";
import { ParseRecipientsResult } from "./coupon.interface";
import { UploadedFile } from "express-fileupload";
import fs from "fs/promises";

export const parseCouponRecipientsFromExcel = async (
  file: UploadedFile,
): Promise<ParseRecipientsResult> => {
  let buffer: Buffer;

  if (file.data && file.data.length > 0) {
    buffer = file.data;
  } else if (file.tempFilePath) {
    buffer = await fs.readFile(file.tempFilePath);
  } else {
    return { emails: [], invalidEmails: [], duplicates: [], totalRows: 0 };
  }

  const workbook = xlsx.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    return { emails: [], invalidEmails: [], duplicates: [], totalRows: 0 };
  }

  const sheet = workbook.Sheets[firstSheetName];

  const rows = xlsx.utils.sheet_to_json<Record<string, any>>(sheet, {
    defval: "",
    raw: false,
  });

  const totalRows = rows.length;

  const rawEmails = rows
    .map((row) => {
      const email =
        row.email ??
        row.Email ??
        row.EMAIL ??
        row["email address"] ??
        row["Email Address"] ??
        row["EMAIL ADDRESS"] ??
        "";
      return String(email).trim().toLowerCase();
    })
    .filter((v) => v.length > 0);

  const seen = new Set();
  const emails: string[] = [];
  const duplicates: string[] = [];
  const invalidEmails: string[] = [];

  for (const email of rawEmails) {
    if (!isValidEmail(email)) {
      invalidEmails.push(email);
      continue;
    }

    if (seen.has(email)) {
      duplicates.push(email);
      continue;
    }

    seen.add(email);
    emails.push(email);
  }

  return { emails, invalidEmails, duplicates, totalRows };
};
