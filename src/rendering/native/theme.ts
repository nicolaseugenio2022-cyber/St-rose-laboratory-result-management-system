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
    // The official mark is 1:1 and the frame is square, so the contained bitmap fills the frame
    // exactly and its left edge sits at 15 mm — flush with the page content margin, like every
    // other element. Making the frame square keeps that alignment by construction rather than by
    // the compensating offset the 21 x 15 box needed. The frame ends at y = 22 mm, 1.5 mm clear of
    // the divider at 23.5, so the enlarged mark stays entirely inside the header band and no report
    // body coordinate moves. The asset carries intrinsic white margins, so its coloured artwork is
    // smaller than the 18 mm frame.
    logoXmm: 15,
    logoWidthMm: 18,
    logoHeightMm: 18,
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
