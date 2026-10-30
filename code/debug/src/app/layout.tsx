import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Velo Stands · Debug",
  description: "Last image and log stream for every ESP32 sensor in the field.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
