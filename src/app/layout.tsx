import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <body className="antialiased font-sans text-slate-900 bg-slate-50">
        {children}
      </body>
    </html>
  );
}
