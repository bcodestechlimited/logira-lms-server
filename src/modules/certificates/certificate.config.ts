// Coordinate system: pdf-lib uses bottom-left origin (0,0)
// Page size of template: A4 ~ 595.276 x 841.89 (points)

export const CERTIFICATE_TEMPLATE = {
  page: {
    width: 595.276,
    height: 841.89,
  },

  fields: {
    // Student full name (where "Ishola Damilola" is)
    // Intended behavior: center align, shrink-to-fit then wrap up to 2 lines
    studentNameBox: {
      x: 185,
      y: 366.89,
      width: 270,
      height: 70,
      maxLines: 2,
      fontSize: 24, // start here (template name text ~24)
      minFontSize: 16, // shrink down to this before wrapping/truncation
      lineHeight: 26, // spacing between lines when wrapped
      align: "center" as const,
    },

    // Course title (where "LEARNING & DEVELOPMENT." is)
    // Intended behavior: wrap up to 3 lines, and optionally shrink if too many lines
    courseTitleBox: {
      x: 185,
      y: 286.89,
      width: 270,
      height: 80,
      maxLines: 3,
      fontSize: 15, // template title text ~14–15
      minFontSize: 11,
      lineHeight: 18,
      align: "center" as const,
    },

    // Issued date (value goes on the line ABOVE the "Issued on" label)
    issuedOnValue: {
      x: 130, // centered above the left line
      y: 171.89,
      fontSize: 12,
      align: "center" as const,
    },

    // Certificate number (value goes on the line ABOVE the "Certificate Number" label)
    certificateNumberValue: {
      x: 420, // centered above the right line
      y: 171.89,
      fontSize: 12,
      align: "center" as const,
    },

    // Signature image for Head, Learning & Development
    // This box sits above the "Head, Learning & Development, ..." text
    signatureBox: {
      x: 210,
      y: 141.89,
      width: 170,
      height: 60,
      fit: "contain" as const, // preserve aspect ratio
    },
  },
} as const;
