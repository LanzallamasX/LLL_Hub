import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { AuthProvider } from "@/contexts/AuthContext";
import { AbsencesProvider } from "@/contexts/AbsencesContext";



const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LLL Hub | Lanzallamas",
  description: "Gestioná tus vacaciones y ausencias en un solo lugar.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="bg-lll-bg">
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-lll-bg text-lll-text antialiased`}
      >
        <AuthProvider>

          <AbsencesProvider>{children}</AbsencesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
