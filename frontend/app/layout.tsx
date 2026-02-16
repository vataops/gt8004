import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { WalletProvider } from "@/contexts/WalletContext";
import { ToastProvider } from "@/components/Toast";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HydroX",
  description: "A Powerful PerpDEX on Cardano",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased h-screen flex flex-col overflow-hidden bg-[#0a0a0a]`}
      >
        <WalletProvider>
          <ToastProvider>
            <Header />
            <div className="flex-1 min-h-0 overflow-auto">{children}</div>
            <Footer />
          </ToastProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
