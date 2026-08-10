/**
 * Shared physical presentation tokens for the native St. Rose report system.
 *
 * These values describe presentation only. Clinical content and report-specific
 * ownership remain in the resolved render model and declarative definitions.
 */
export const NATIVE_REPORT_THEME = {
  page: {
    widthMm: 210,
    heightMm: 297,
    marginMm: 15,
    contentWidthMm: 180,
    contentBottomLimitMm: 148.5,
  },
  colors: {
    primary: "#0B6384",
    primaryDark: "#084D68",
    tealTint: "#EAF5F7",
    sectionAccent: "#78AFC0",
    text: "#0F172A",
    mutedText: "#475569",
    separator: "#D6E4E9",
    background: "#FFFFFF",
  },
  header: {
    topMm: 4,
    logoXmm: 16,
    logoWidthMm: 21,
    logoHeightMm: 15,
    identityXmm: 41,
    identityWidthMm: 153,
    dividerYmm: 23.5,
    contentStartYmm: 26.5,
  },
  sectionInsets: {
    demographicsTopMm: 1,
    resultBodyTopMm: 1,
  },
  typography: {
    laboratoryNamePt: 15,
    laboratoryDetailPt: 8,
    titlePt: 11.5,
    sectionLabelPt: 7.8,
    demographicLabelPt: 6.8,
    demographicValuePt: 9.2,
    resultHeaderPt: 8.2,
    resultLabelPt: 8.7,
    resultValuePt: 10,
    referencePt: 7.9,
    signatoryNamePt: 8.8,
    signatoryDetailPt: 7.2,
  },
} as const;
