import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "MeperBoard",
  description: "Local-first kanban board for the Meper suite's GitHub issues",
};

/**
 * Applies the persisted theme before first paint so the correct palette renders
 * on the very first frame (no FOUC). Resolution order: localStorage, then
 * prefers-color-scheme, defaulting to dark. Keep in sync with THEME_STORAGE_KEY
 * in components/app-header/theme-toggle.tsx.
 */
const themeInitScript = `(function(){try{var t=localStorage.getItem("meperboard-theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";}}catch(e){t="dark";}document.documentElement.classList.toggle("dark",t==="dark");})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
