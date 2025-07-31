import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SidebarTrigger } from "@/components/ui/sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "96-well Designer",
  description: "A 96-well plate management application",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SidebarProvider>
          <main className="relative">
            <SidebarTrigger className="absolute top-4 left-4 z-50" />
            {children}
          </main>
        </SidebarProvider>
      </body>
    </html>
  );
}
