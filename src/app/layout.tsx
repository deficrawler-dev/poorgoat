import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://poorgoat.fun"),
  title: {
    default: "PoorGoat | Track the Goat",
    template: "%s | PoorGoat",
  },
  description:
    "Live $POORGOAT market data and an on-chain GoatScore for the $ANSEM ecosystem.",
  applicationName: "PoorGoat",
  openGraph: {
    title: "PoorGoat | Track the Goat",
    description:
      "Track $POORGOAT and measure your $ANSEM ecosystem conviction.",
    type: "website",
    siteName: "PoorGoat",
  },
  twitter: {
    card: "summary_large_image",
    title: "PoorGoat | Track the Goat",
    description:
      "Track $POORGOAT and measure your $ANSEM ecosystem conviction.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b0b09",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}