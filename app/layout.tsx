import type { Metadata } from "next";
import { Inter, Montserrat, Poppins } from "next/font/google";
import "./globals.css";

// Headings in Poppins, everything else in Inter (team font rule, confirmed 15 Nov 2026).
const poppins = Poppins({ variable: "--font-poppins", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], display: "swap" });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
// Login/register come from the B2 branch and use Montserrat.
const montserrat = Montserrat({ variable: "--font-montserrat", subsets: ["latin"], weight: ["600"], display: "swap" });

export const metadata: Metadata = {
  title: "HRMS D4 · Performance & Training",
  description: "Performance and Training Development",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // Most copy (notices, messages, help text) is Indonesian; English labels are the minority (UI-D4-001).
    <html lang="id" className={`${poppins.variable} ${inter.variable} ${montserrat.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
