import { classNames } from "../class-names.js";
import { Container } from "../layout/Container.js";
import { ResponsiveImage } from "../media/ResponsiveImage.js";
import type { SiteChrome, SiteLabels } from "../site.types.js";
import { MainMenu } from "./MainMenu.js";

export type HeaderLayout = "bar" | "masthead";

export interface HeaderProps {
  chrome: Pick<SiteChrome, "siteName" | "logo" | "homeUrl" | "menu">;
  labels: Pick<SiteLabels, "mainMenu">;
  /** "bar": name on the left, menu on the right. "masthead": a large centred name, menu below. */
  layout?: HeaderLayout;
}

/**
 * The top of every page: the site's logo or name, linking home, and the main menu.
 * Output: `<header class="lintel-header lintel-header--bar">`.
 */
export function Header({ chrome, labels, layout = "bar" }: HeaderProps) {
  return (
    <header
      className={classNames("lintel-header", `lintel-header--${layout}`)}
      data-lintel-component="header"
    >
      <Container width="wide">
        <div className="lintel-header__inner">
          <a className="lintel-header__brand" href={chrome.homeUrl} data-lintel-field="site_name">
            {chrome.logo ? (
              <ResponsiveImage
                // The logo is the link's text, so it is named after the site.
                image={{ ...chrome.logo, alt: chrome.siteName }}
                sizes="12rem"
                priority
                className="lintel-header__logo"
                field="logo"
              />
            ) : (
              chrome.siteName
            )}
          </a>
          <MainMenu items={chrome.menu} label={labels.mainMenu} />
        </div>
      </Container>
    </header>
  );
}
