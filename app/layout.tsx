import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { Toaster } from "@/components/ui/sonner";
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
  title: "BioJarvis - AI-Powered Bioinformatics Research Assistant",
  description:
    "Ask questions about drug mechanisms in plain English, explore 3D protein structures, and access real-time data from PDB, ChEMBL, UniProt, and PubMed.",
  keywords: [
    "bioinformatics",
    "drug research",
    "protein structure",
    "AI",
    "Claude",
    "PDB",
    "ChEMBL",
    "UniProt",
    "PubMed",
  ],
  authors: [{ name: "BioJarvis Team" }],
  openGraph: {
    title: "BioJarvis - AI-Powered Bioinformatics Research Assistant",
    description:
      "Understand drug mechanisms through conversational AI and 3D visualization",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          {children}
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </body>
    </html>
  );
}
