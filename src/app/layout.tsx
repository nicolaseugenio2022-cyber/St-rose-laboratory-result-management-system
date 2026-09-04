import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

/**
 * Inter is the single interface typeface, adopted with the shadcn Rhea foundation.
 *
 * Self-hosted by next/font at build time - no @import, no external <link>, no font
 * package - so there is no render-blocking request to fonts.googleapis.com and no
 * third-party origin in the request path of a clinical application.
 *
 * Inter ships as a variable font, so every weight the interface uses - 400 body, 500
 * controls and de-emphasised labels, 600 headings, 700 the few places that outrank a
 * heading - comes from one file. Hierarchy is still built from weight rather than from
 * a second typeface.
 *
 * next/font publishes the family as `--font-inter`; globals.css maps Tailwind's
 * `--font-sans` theme token onto it, so `font-sans` and the shadcn base layer resolve
 * to Inter from <html> down. Laboratory report rendering - preview, print, PDF and
 * completed snapshots - sets its own explicit fonts and never reads either variable.
 *
 * display: "swap" keeps text readable through the font load. next/font generates a
 * metric-adjusted local fallback (adjustFontFallback, on by default), so the swap
 * changes letterforms without reflowing the page - which is why this needs no
 * transition to cover it.
 */
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
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
    <html lang="en" className={inter.variable}>
      {/* The application ground, from the token rather than a slate literal: this is surface 1
          of the three-surface system and every page inherits it. */}
      <body className="bg-brand-canvas font-sans text-brand-text antialiased">
        {children}
      </body>
    </html>
  );
}
