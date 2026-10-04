import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Montserrat } from "next/font/google";
import { D4App } from "@/modules/d4/web/D4App";
import { d4DataMode } from "@/modules/d4/web/data/mode";
import { D4BodyClass } from "@/modules/d4/web/ui/D4BodyClass";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const montserrat = Montserrat({ variable: "--font-montserrat", subsets: ["latin"], weight: ["600"], display: "swap" });
const fontVariables = `${inter.variable} ${montserrat.variable}`;

export const metadata: Metadata = {
  title: "HRMS D4 — Performance & Training",
  description: "Performance and Training Development",
};

export default function D4Layout({ children }: { children: ReactNode }) {
  return <div className={`${fontVariables} d4-root flex-1`}>
    <D4BodyClass className={`${fontVariables} d4-body`} />
    <D4App mode={d4DataMode}>{children}</D4App>
  </div>;
}
