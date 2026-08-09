import { ReportLayout } from "../types/layout.types";

/**
 * CBC Report Layout Configuration (canonical millimeter coordinates).
 *
 * CBC.png is a full A4 image whose approved form occupies only the upper
 * portion of the page. It remains the sole source for static labels, rules,
 * fills, branding, reference values, and role captions. Source-only sample
 * values are masked before current report data is rendered.
 */
export const cbcLayout: ReportLayout = {
  templateCode: "CBC",
  backgroundAssetPath: "/templates/render/CBC.png",
  artworkMasks: [
    // Source sample date and default address.
    { x: 151.0, y: 36.8, width: 47.5, height: 5.2, color: "#ffffff" },
    { x: 41.2, y: 42.6, width: 96.5, height: 5.4, color: "#e5dfec" },

    // Source default remarks text (the static REMARKS: label remains visible).
    { x: 40.2, y: 128.0, width: 111.0, height: 4.9, color: "#dfd8e8" },

    // Source sample signatory names, license numbers, and pathologist signature.
    { x: 37.0, y: 132.2, width: 39.0, height: 10.5, color: "#ffffff" },
    { x: 24.4, y: 140.8, width: 95.0, height: 5.8, color: "#ffffff" },
    { x: 35.0, y: 146.0, width: 58.0, height: 4.9, color: "#ffffff" },
    { x: 121.0, y: 140.8, width: 79.0, height: 5.8, color: "#ffffff" },
    { x: 140.0, y: 146.0, width: 48.0, height: 4.9, color: "#ffffff" },
  ],
  fields: {
    patientName: {
      x: 38.8,
      y: 37.6,
      width: 69.0,
      fontSize: 2.9,
      fontWeight: "bold",
      textTransform: "uppercase",
    },
    age: {
      x: 119.8,
      y: 37.6,
      width: 19.0,
      fontSize: 2.9,
      fontWeight: "bold",
    },
    dateOfExam: {
      x: 151.7,
      y: 37.6,
      width: 47.0,
      fontSize: 2.9,
      fontWeight: "bold",
    },
    address: {
      x: 42.7,
      y: 43.4,
      width: 94.0,
      fontSize: 2.9,
      fontWeight: "bold",
      textTransform: "uppercase",
    },
    sex: {
      x: 147.5,
      y: 43.4,
      width: 51.0,
      fontSize: 2.9,
      fontWeight: "bold",
      textTransform: "uppercase",
    },
    requestingPhysician: {
      x: 53.5,
      y: 49.5,
      width: 84.0,
      fontSize: 2.9,
      fontWeight: "bold",
    },
  },
  results: {
    defaultFontSize: 3.0,
    rowHeight: 4.2,
    columns: {
      result: {
        key: "result",
        x: 79.2,
        width: 52.7,
        align: "center",
      },
    },
    rows: [
      { testKey: "hemoglobin", y: 66.4, displayPrecision: 0 },
      { testKey: "hematocrit", y: 74.0, displayPrecision: 2 },
      { testKey: "rbc", y: 82.1, displayPrecision: 1 },
      { testKey: "wbc", y: 89.3, displayPrecision: 1 },
      { testKey: "platelet", y: 93.5, displayPrecision: 0 },
      { testKey: "neutrophil", y: 106.9, displayPrecision: 2 },
      { testKey: "lymphocyte", y: 111.5, displayPrecision: 2 },
      { testKey: "eosinophil", y: 115.7, displayPrecision: 2 },
      { testKey: "monocyte", y: 120.3, displayPrecision: 2 },
      { testKey: "basophil", y: 124.5, displayPrecision: 2 },
    ],
  },
  remarks: {
    x: 40.3,
    y: 129.1,
    width: 111.0,
    fontSize: 2.25,
    fontWeight: "bold",
    textTransform: "uppercase",
    maxChars: 62,
  },
  signatories: {
    pathologist: {
      name: {
        x: 24.8,
        y: 141.0,
        width: 91.0,
        align: "center",
        fontSize: 2.65,
        fontWeight: "normal",
        underline: true,
        maxChars: 49,
      },
      licenseNo: {
        x: 24.8,
        y: 146.6,
        width: 91.0,
        align: "center",
        fontSize: 2.55,
      },
      signatureImage: {
        x: 39.0,
        y: 132.3,
        width: 32.0,
        height: 12.0,
      },
    },
    medicalTechnologist: {
      name: {
        x: 120.0,
        y: 141.0,
        width: 80.5,
        align: "center",
        fontSize: 2.65,
        fontWeight: "normal",
        underline: true,
        maxChars: 47,
      },
      licenseNo: {
        x: 120.0,
        y: 146.6,
        width: 80.5,
        align: "center",
        fontSize: 2.55,
      },
    },
  },
};
