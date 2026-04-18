import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Singapore Trip Finder",
  description: "Find the cheapest 4-day weekend trips from Seattle to Singapore",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
