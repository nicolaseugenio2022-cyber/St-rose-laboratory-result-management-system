import React from "react";
import Image from "next/image";

/**
 * The official mark shown on every authentication and recovery card.
 *
 * It lives in one component so login, first-login and all three forgot-password stages cannot
 * drift apart: the size is defined here and nowhere else. The asset is the official file, never
 * cropped, recoloured or substituted, and it is square (1254x1254), so a fixed square box
 * preserves its aspect ratio exactly.
 */
export function AuthBrandMark() {
  return (
    <div className="mx-auto flex items-center justify-center">
      <Image
        src="/st-rose-logo-official.png"
        alt="St. Rose Diagnostic Laboratory"
        width={96}
        height={96}
        className="h-16 w-16 object-contain sm:h-24 sm:w-24"
        priority
      />
    </div>
  );
}
