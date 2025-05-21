import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Theme, Box } from "@radix-ui/themes";
import "./globals.css";
import '@radix-ui/themes/styles.css';

// Import client components
import QueryClientProvider from './QueryClientProvider';
import Sidebar from '@/components/Sidebar';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ['400', '700'],
});

export const metadata: Metadata = {
  title: "Profimine",
  description: "Data analysis dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="light">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ height: "100vh", width: "100vw", margin: 0, padding: 0 }}
      >
        <QueryClientProvider>
          <Theme accentColor="green" scaling="100%" radius="medium">
            <div className="flex h-screen w-screen bg-gray-50 relative">
              <Sidebar />
              <main className="flex-1 overflow-auto p-4 md:p-6 h-full md:ml-0 ml-0 pt-16 md:pt-6">
                {children}
              </main>
            </div>
          </Theme>
        </QueryClientProvider>
      </body>
    </html>
  );
}
