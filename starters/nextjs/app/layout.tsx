import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteHeader } from "../components/SiteHeader";
import { showsBuiltWithLintel } from "../lib/lintel";
import { siteName } from "../lib/site";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: siteName, template: `%s · ${siteName}` },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const builtWithLintel = await showsBuiltWithLintel();

  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main">{children}</main>
        <footer className="site-footer meta">
          {siteName}
          {builtWithLintel && (
            <>
              {" "}
              · Built with <a href="https://github.com/DanielHuntr/lintelcms">Lintel</a>
            </>
          )}
        </footer>
      </body>
    </html>
  );
}
