import type { DeclarativeRenderContractSpec } from "@/domain/types/report-definition";

/**
 * The render contract for a qualitative report that carries no reference track.
 *
 * Five reports state a finding and nothing else - Blood Typing, Hepatitis B screening, Syphilis /
 * RPR screening, the urine Pregnancy test and the Dengue Duo test. Every one of their parameters
 * is a closed qualitative selection with no unit and no reference range, so the compact grid's
 * default third column, REFERENCE VALUES, was a permanently empty track occupying 30% of the page,
 * and its TEST header labelled a column whose contents already read as test names.
 *
 * Declaring two columns removes the reference track outright rather than emptying it: the header
 * is not composed, no `result-*-reference` primitive is created, and the two remaining tracks
 * absorb the full page width. The first header is deliberately an empty string - the column keeps
 * its data and loses its label.
 *
 * ## Why the version numbers are load-bearing
 *
 * These five definitions previously declared no render contract at all, so every report already
 * completed under them froze `renderContractVersion: 1` and resolves its layout from the layout
 * family's defaults. Three things keep that history intact, and all three are required:
 *
 *   - `renderContractVersion: 2` - without the bump the effective version stays 1 and
 *     `sinceRenderContractVersion` below can never be satisfied, so the new composition would be
 *     silently inert while appearing to be declared;
 *   - `sinceRenderContractVersion: 2` - a snapshot frozen at version 1 does not meet it, falls back
 *     to the family defaults, and re-renders byte-identically to the day it was issued;
 *   - `supersededRenderContractVersions: [1]` - without it, `validatedSnapshotMetadata` rejects
 *     every existing completion outright rather than rendering it, because a frozen version that is
 *     neither current nor declared superseded is a hard error.
 *
 * `staticContentVersion` must stay exactly `"standard-report-v1"`: the snapshot validator compares
 * it for equality against the value frozen into each completed report.
 *
 * Shared rather than retyped five times so the five cannot drift apart, and so the reasoning above
 * lives in one place instead of in five copies of a comment.
 */
export const RESULT_ONLY_STANDARD_RENDER_CONTRACT: DeclarativeRenderContractSpec = {
  renderContractVersion: 2,
  supersededRenderContractVersions: [1],
  staticContentVersion: "standard-report-v1",
  standardComposition: {
    // Two entries, so the reference column is not composed at all. The first header is blank on
    // purpose; the test names below it are self-evident and the label added nothing.
    resultHeaders: ["", "RESULT"],
    // The 40/30 split of the old test and result columns, renormalized over the width the retired
    // reference track leaves behind, so the result stays a comfortably wide centred column while
    // the name column gains the room a long parameter name needs.
    columnRatios: [57, 43],
    sinceRenderContractVersion: 2,
  },
};
