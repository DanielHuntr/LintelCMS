import { Container } from "../layout/Container.js";
import type { SiteChrome, SiteLabels } from "../site.types.js";
import { socialLinkName } from "./social-links.js";

export interface FooterProps {
  chrome: Pick<
    SiteChrome,
    "siteName" | "footerText" | "contactEmail" | "socialLinks" | "languages"
  >;
  labels: Pick<SiteLabels, "languages" | "socialLinks" | "contact">;
  /** For the copyright line. Passed in, so the same props always give the same HTML. */
  year: number;
}

/**
 * The bottom of every page, from the "Site settings" globals: the footer text, the contact
 * email, social links and the site's languages. Output: `<footer class="lintel-footer">`.
 */
export function Footer({ chrome, labels, year }: FooterProps) {
  const languages = chrome.languages.length > 1 ? chrome.languages : [];
  return (
    <footer className="lintel-footer" data-lintel-component="footer">
      <Container width="wide">
        <div className="lintel-footer__grid">
          <div className="lintel-footer__about">
            <p className="lintel-footer__name">{chrome.siteName}</p>
            {chrome.footerText && (
              <p className="lintel-footer__text" data-lintel-field="footer_text">
                {chrome.footerText}
              </p>
            )}
          </div>
          {chrome.contactEmail && (
            <div className="lintel-footer__column">
              <h2 className="lintel-footer__heading">{labels.contact}</h2>
              <a
                className="lintel-footer__link"
                href={`mailto:${chrome.contactEmail}`}
                data-lintel-field="contact_email"
              >
                {chrome.contactEmail}
              </a>
            </div>
          )}
          {chrome.socialLinks.length > 0 && (
            <div className="lintel-footer__column">
              <h2 className="lintel-footer__heading">{labels.socialLinks}</h2>
              <ul className="lintel-footer__list" data-lintel-field="social_links">
                {chrome.socialLinks.map((url) => (
                  <li key={url}>
                    <a className="lintel-footer__link" href={url} rel="me">
                      {socialLinkName(url)}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {languages.length > 0 && (
            <nav className="lintel-footer__column" aria-label={labels.languages}>
              <h2 className="lintel-footer__heading">{labels.languages}</h2>
              <ul className="lintel-footer__list">
                {languages.map((language) => (
                  <li key={language.code}>
                    <a
                      className="lintel-footer__link"
                      href={language.url}
                      lang={language.code}
                      hrefLang={language.code}
                      aria-current={language.current ? "true" : undefined}
                    >
                      {language.name}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>
        <p className="lintel-footer__copyright">
          © {year} {chrome.siteName}
        </p>
      </Container>
    </footer>
  );
}
