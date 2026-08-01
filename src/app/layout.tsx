import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, Source_Serif_4 } from "next/font/google";

import { getPublicEnv } from "@/config/public-env";

import "@/styles/globals.css";
import "@/styles/prose.css";
import "@/styles/motion.css";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["cyrillic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans",
  display: "swap",
});

const sourceSerif4 = Source_Serif_4({
  subsets: ["cyrillic", "latin"],
  variable: "--font-source-serif-4",
  display: "swap",
});

const publicEnv = getPublicEnv();

export const metadata: Metadata = {
  title: {
    default: publicEnv.NEXT_PUBLIC_APP_NAME,
    template: `%s · ${publicEnv.NEXT_PUBLIC_APP_NAME}`,
  },
  description:
    "Корпоративный портал знаний: инструкции, статьи и библиотека промтов.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FFFFFF",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={`${ibmPlexSans.variable} ${sourceSerif4.variable}`}>
      <body>{children}</body>
    </html>
  );
}
