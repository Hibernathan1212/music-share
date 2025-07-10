// src/app/layout.tsx
import { type Metadata } from "next";
import "~/styles/globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { Geist } from "next/font/google";
import ConvexClientProvider from "~/components/providers/ConvexClientProvider"; // Your Convex/Clerk Provider
import { ThemeProvider } from "~/components/providers/theme-provider"; // Your ThemeProvider from next-themes
import { Toaster } from "~/components/ui/sonner"; 

export const metadata: Metadata = {
  title: "Musishare",
  description: "The music sharing platform",
  icons: [{ rel: "icon", url: "/favicon.png" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geist.variable}`}>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <ClerkProvider>
            <ConvexClientProvider>
              {children}
            </ConvexClientProvider>
          </ClerkProvider>
          <Toaster /> {/* Global toaster for notifications */}
        </ThemeProvider>
      </body>
    </html>
  );
}