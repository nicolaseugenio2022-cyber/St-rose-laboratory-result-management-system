import React from "react";

export default function FirstLoginLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-background p-4">
      {children}
    </div>
  );
}
