import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tap Review MVP",
  description: "Initial scaffold for an NFC and QR Google review analytics MVP."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
