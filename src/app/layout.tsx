import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LegalMine Sentinel — Mining due diligence & GeoRisk intelligence",
  description:
    "Screen the legal, environmental and territorial risk of a mining asset against official registries and geospatial services, with an explainable score and a traceable evidence dossier. Preliminary screening, not legal advice.",
  openGraph: {
    title: "LegalMine Sentinel",
    description:
      "Mining intelligence before capital is committed. Official sources, explainable screening, evidence dossier.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full scroll-smooth">
      <body className="h-full bg-[#070a13] text-[#f3f4f6] antialiased">{children}</body>
    </html>
  );
}
