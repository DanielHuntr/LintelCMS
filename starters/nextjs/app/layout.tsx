import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteHeader } from "../components/SiteHeader";
import { siteName } from "../lib/site";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: siteName, template: `%s · ${siteName}` },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main">{children}</main>
        <footer className="site-footer meta">
          {siteName} · Content from <a href="https://github.com/DanielHuntr/lintelcms">Lintel</a>
        </footer>
      </body>
    </html>
  );
}
