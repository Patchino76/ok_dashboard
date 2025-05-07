import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Theme, Container, Box } from "@radix-ui/themes";
import "./globals.css";
import '@radix-ui/themes/styles.css';

// Import the client component that handles the dynamic import with ssr: false
import NavbarClient from './NavbarClient';
import QueryClientProvider from './QueryClientProvider';

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
  title: "OK Dashboard",
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
        style={{ height: "100vh", width: "100vw" }}
      >
        <QueryClientProvider>
          <Theme accentColor="violet" scaling="100%" radius="medium">
            <Box style={{ width: '95vw', height: '95vh', margin: '0 auto' }}>
              <NavbarClient />
              <Container py="4">
                {children}
              </Container>
            </Box>
          </Theme>
        </QueryClientProvider>
      </body>
    </html>
  );
}
