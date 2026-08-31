import type { Metadata } from "next";
import { Source_Sans_3 } from "next/font/google";
import "./globals.css";

/**
 * Source Sans 3 is the single interface typeface.
 *
 * Self-hosted by next/font at build time - no @import, no external <link>, no font
 * package - so there is no render-blocking request to fonts.googleapis.com and no
 * third-party origin in the request path of a clinical application.
 *
 * Four weights, because hierarchy here is built from weight rather than from a
 * second typeface: 400 body, 500 de-emphasised labels, 600 headings and controls,
 * 700 the few places that outrank a heading. Nothing in the interface asks for a
 * display face, and adding one would be a second voice with nothing to say.
 *
 * display: "swap" keeps text readable through the font load. next/font generates a
 * metric-adjusted local fallback (adjustFontFallback, on by default), so the swap
 * changes letterforms without reflowing the page - which is why this needs no
 * transition to cover it. A fade would only draw the eye to a shift that is not
 * happening.
 */
const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-source-sans",
});

export const metadata: Metadata = {
  title: "St. Rose Laboratory Result Management System",
  description: "Production-grade laboratory result management system for St. Rose Diagnostic Laboratory",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The variable is declared on <html> so every descendant resolves it, including
    // anything a future portal mounts outside the React tree under <body>.
    <html lang="en" className={sourceSans.variable}>
      {/* The application ground, from the token rather than a slate literal: this is surface 1
          of the three-surface system and every page inherits it. */}
      <body className="bg-brand-canvas font-sans text-brand-text antialiased">
        {children}
      </body>
    </html>
  );
}
