import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { InteractiveBubbleBackground } from "@/components/InteractiveBubbleBackground";
import "./globals.css";

export const metadata: Metadata = {
  title: "Colin Haluska Investments",
  description: "Paper trading platform",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/favicon.svg",
  },
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="apple-touch-icon" href="/favicon.svg" />
      </head>
      <body>
        <InteractiveBubbleBackground />
        <Navbar />
        <main className="container shell">{children}</main>
      </body>
    </html>
  );
}
