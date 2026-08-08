import React from "react";

export default function LoginLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-brand-background flex items-center justify-center p-4">
      {children}
    </div>
  );
}
