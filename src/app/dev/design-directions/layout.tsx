import { notFound } from "next/navigation";
import {
  IBM_Plex_Sans,
  Nunito_Sans,
  Source_Sans_3,
  Source_Serif_4,
} from "next/font/google";

import type { ReactNode } from "react";

const editorialSans = Source_Sans_3({
  subsets: ["cyrillic", "latin"],
  variable: "--dd-font-editorial-sans",
  display: "swap",
});

const editorialDisplay = Source_Serif_4({
  subsets: ["cyrillic", "latin"],
  variable: "--dd-font-editorial-display",
  display: "swap",
});

const workspaceSans = IBM_Plex_Sans({
  subsets: ["cyrillic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--dd-font-workspace-sans",
  display: "swap",
});

const learningSans = Nunito_Sans({
  subsets: ["cyrillic", "latin"],
  variable: "--dd-font-learning-sans",
  display: "swap",
});

export default function DesignDirectionsLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <div
      className={[
        editorialSans.variable,
        editorialDisplay.variable,
        workspaceSans.variable,
        learningSans.variable,
      ].join(" ")}
      style={{ minHeight: "100vh" }}
    >
      {children}
    </div>
  );
}
