import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { InteractiveBubbleBackground } from "@/components/InteractiveBubbleBackground";
import "./globals.css";

export const metadata: Metadata = {
  title: "Colin Haluska Investments",
  description: "Paper trading platform"
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <InteractiveBubbleBackground />
        <Navbar />
        <main className="container shell">{children}</main>
      </body>
    </html>
  );
}
