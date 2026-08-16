import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wisdom Squared",
  description: "Freshly generated KenKen puzzles, verified for a single solution.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
