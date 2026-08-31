import React from "react";

export default function FirstLoginLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The composition lives in AuthShell, which each page renders itself - a page knows its own
    // task heading, and this layout does not. All that remains here is the route guard.
    <>{children}</>
  );
}
