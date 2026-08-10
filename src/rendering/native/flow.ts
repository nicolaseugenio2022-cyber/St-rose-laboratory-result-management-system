import type { NativePagePrimitive } from "./types";
import { NativeCompositionOverflowError, STANDARD_PAGE, type NativeFlowSectionResult } from "./standard/types";

export function nativePrimitiveBottomMm(primitive: NativePagePrimitive): number {
  if (primitive.kind === "line") return Math.max(primitive.y1, primitive.y2);
  if (primitive.kind === "rich-text") {
    const lineHeight = primitive.lineHeightMm ?? (primitive.fontSizePt * 25.4 / 72) * 1.05;
    return primitive.y + Math.max(primitive.height ?? 0, primitive.lines.length * lineHeight);
  }
  return primitive.y + (primitive.height ?? (primitive.kind === "text" ? primitive.fontSizePt * 25.4 / 72 : 0));
}

export function assertNativeUpperHalfBounds(templateCode: string, primitives: NativePagePrimitive[]): number {
  let contentBottomMm = 0;
  for (const primitive of primitives) {
    const bottom = nativePrimitiveBottomMm(primitive);
    contentBottomMm = Math.max(contentBottomMm, bottom);
    if (bottom > STANDARD_PAGE.contentBottomLimitMm + 0.0001) {
      throw new NativeCompositionOverflowError({
        templateCode,
        primitiveId: primitive.id,
        calculatedBottomMm: bottom,
      });
    }
  }
  return contentBottomMm;
}

export function appendNativeFlowSection(
  target: NativePagePrimitive[],
  section: NativeFlowSectionResult
): number {
  target.push(...section.primitives);
  return section.bottomMm;
}
