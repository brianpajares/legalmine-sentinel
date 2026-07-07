import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LegalMine Sentinel | Plataforma GeoAI de Inteligencia y Cumplimiento Minero",
  description: "Plataforma de inteligencia geoespacial para detectar minería ilegal, cruzar derechos catastrales, REINFO, y evaluar oportunidades de minería formal en Perú.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full scroll-smooth">
      <body className="h-full bg-[#070a13] text-[#f3f4f6] antialiased">
        {children}
      </body>
    </html>
  );
}
