import CertificateCounter from "./certificate-counter.model";

export const generateCertificateNumber = async (issuedAt: Date) => {
  const year = issuedAt.getFullYear();

  const counter = await CertificateCounter.findOneAndUpdate(
    { year },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );

  const seq = counter.seq;
  const padded = String(seq).padStart(6, "0");

  // Example: LMS-2026-000245
  return `ICS-L&D-LMS-${padded}`;
};
