import {
  badgeComponent,
  breadcrumbsComponent,
  countdownComponent,
  counterComponent,
  featureListComponent,
  isBoundHtml,
  marqueeComponent,
  pricingTableComponent,
  richTextComponent,
  socialLinksComponent,
  tableComponent,
  teamMemberComponent,
  testimonialComponent,
  timelineComponent,
} from "@lintel/builder-model";
import { drawsProps, type RenderMode } from "../component-registry.js";
import { useCurrentItem } from "../data-context.js";
import { cx } from "./behaviour-types.js";
import { markdownToHtml } from "./markdown.js";
import { SiteIcon } from "./media.js";

/** Text and information elements: all plain HTML, with motion only where it is asked for. */

const Marquee = drawsProps(marqueeComponent, ({ props, attributes }) => {
  const list = (hidden: boolean) => (
    <ul className="lintel-marquee__list" aria-hidden={hidden || undefined}>
      {props.items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
  return (
    <div
      {...attributes}
      className={cx(
        attributes.className,
        "lintel-marquee",
        `lintel-marquee--${props.speed}`,
        `lintel-marquee--${props.direction}`,
      )}
    >
      <div className="lintel-marquee__track">
        {list(false)}
        {list(true)}
      </div>
    </div>
  );
});

export function formatNumber(value: number, decimals: number): string {
  return new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** The final number is in the HTML (what search engines and screen readers get); the script only animates towards it. */
const Counter = drawsProps(counterComponent, ({ props, attributes, editableText }) => (
  <p {...attributes} className={cx(attributes.className, "lintel-counter")}>
    <span
      className="lintel-counter__value"
      data-behaviour={props.countsUp ? "counter" : undefined}
      data-value={props.value}
      data-decimals={props.decimals}
    >
      {props.prefix}
      <span className="lintel-counter__number">{formatNumber(props.value, props.decimals)}</span>
      {props.suffix}
    </span>
    <span className="lintel-counter__label" {...editableText("label")}>
      {props.label}
    </span>
  </p>
));

const Badge = drawsProps(badgeComponent, ({ props, attributes, editableText }) => (
  <span
    {...attributes}
    className={cx(attributes.className, "lintel-badge", `lintel-badge--${props.tone}`)}
  >
    {props.icon && <SiteIcon name={props.icon} className="lintel-badge__icon" />}
    <span {...editableText("text")}>{props.text}</span>
  </span>
));

const Table = drawsProps(tableComponent, ({ props, attributes }) => (
  <div
    {...attributes}
    className={cx(attributes.className, "lintel-table")}
    role="region"
    aria-label={props.caption || "Table"}
    tabIndex={0}
  >
    <table className={cx("lintel-table__table", props.striped && "lintel-table__table--striped")}>
      {props.caption && <caption>{props.caption}</caption>}
      {props.headings.length > 0 && (
        <thead>
          <tr>
            {props.headings.map((heading, index) => (
              <th key={index} scope="col">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {props.rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.cells.map((cell, cellIndex) =>
              cellIndex === 0 && props.firstColumnIsHeading ? (
                <th key={cellIndex} scope="row">
                  {cell}
                </th>
              ) : (
                <td key={cellIndex}>{cell}</td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
));

const Timeline = drawsProps(timelineComponent, ({ props, attributes }) => {
  const List = props.numbered ? "ol" : "ul";
  return (
    <List
      {...attributes}
      className={cx(
        attributes.className,
        "lintel-timeline",
        props.numbered && "lintel-timeline--numbered",
      )}
    >
      {props.items.map((item, index) => (
        <li key={index} className="lintel-timeline__item">
          {!props.numbered && item.when && <p className="lintel-timeline__when">{item.when}</p>}
          <h3 className="lintel-timeline__title">{item.title}</h3>
          {item.text && <p className="lintel-timeline__text">{item.text}</p>}
        </li>
      ))}
    </List>
  );
});

function Stars({ rating }: { rating: number }) {
  if (rating <= 0) return null;
  return (
    <p className="lintel-stars" role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <SiteIcon
          key={star}
          name="star"
          className={star <= rating ? "lintel-stars__on" : "lintel-stars__off"}
        />
      ))}
    </p>
  );
}

const Testimonial = drawsProps(testimonialComponent, ({ props, attributes, editableText }) => (
  <figure {...attributes} className={cx(attributes.className, "lintel-testimonial")}>
    <Stars rating={props.rating} />
    <blockquote className="lintel-testimonial__quote">
      <p {...editableText("quote")}>{props.quote}</p>
    </blockquote>
    <figcaption className="lintel-testimonial__person">
      {props.photo.src && (
        <img
          className="lintel-testimonial__photo"
          src={props.photo.src}
          alt=""
          width={48}
          height={48}
          loading="lazy"
        />
      )}
      <span>
        <span className="lintel-testimonial__name">{props.name}</span>
        {props.role && <span className="lintel-testimonial__role">{props.role}</span>}
      </span>
    </figcaption>
  </figure>
));

function linkFor(href: string, mode: RenderMode) {
  return mode === "site" && href ? href : undefined;
}

const PricingTable = drawsProps(pricingTableComponent, ({ props, attributes, mode }) => (
  <ul
    {...attributes}
    className={cx(
      attributes.className,
      "lintel-pricing",
      `lintel-pricing--plans-${Math.max(1, props.plans.length)}`,
    )}
  >
    {props.plans.map((plan, index) => (
      <li
        key={index}
        className={cx(
          "lintel-pricing__plan",
          plan.highlighted && "lintel-pricing__plan--highlighted",
        )}
      >
        {plan.badge && (
          <p className="lintel-badge lintel-badge--brand lintel-pricing__badge">{plan.badge}</p>
        )}
        <h3 className="lintel-pricing__name">{plan.name}</h3>
        <p className="lintel-pricing__price">
          <span className="lintel-pricing__amount">{plan.price}</span>
          {plan.period && <span className="lintel-pricing__period"> {plan.period}</span>}
        </p>
        {plan.description && <p className="lintel-pricing__description">{plan.description}</p>}
        {plan.features.length > 0 && (
          <ul className="lintel-pricing__features">
            {plan.features.map((feature, featureIndex) => (
              <li key={featureIndex}>
                <SiteIcon name="check" className="lintel-pricing__tick" />
                {feature}
              </li>
            ))}
          </ul>
        )}
        {plan.buttonLabel && (
          <a
            className={cx("lintel-button", !plan.highlighted && "lintel-button--secondary")}
            href={linkFor(plan.buttonHref, mode)}
          >
            {plan.buttonLabel}
            <span className="lintel-visually-hidden">: {plan.name}</span>
          </a>
        )}
      </li>
    ))}
  </ul>
));

const networkNames: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  x: "X",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  tiktok: "TikTok",
  pinterest: "Pinterest",
  github: "GitHub",
  mastodon: "Mastodon",
  bluesky: "Bluesky",
  threads: "Threads",
  whatsapp: "WhatsApp",
  email: "Email",
  website: "Website",
};

const networkIcons: Record<string, string> = {
  email: "mail",
  website: "globe",
  whatsapp: "message-circle",
};

export function SocialLinkList({
  links,
  size,
  mode,
  label = "Social media",
}: {
  links: readonly { network: string; href: string }[];
  size: string;
  mode: RenderMode;
  label?: string;
}) {
  return (
    <ul className={cx("lintel-social", `lintel-social--${size}`)} aria-label={label}>
      {links.map((link, index) => (
        <li key={index}>
          <a
            className="lintel-social__link"
            href={linkFor(link.href, mode)}
            rel="me noopener"
            data-network={link.network}
          >
            <SiteIcon
              name={networkIcons[link.network] ?? "at-sign"}
              className="lintel-social__icon"
            />
            <span>{networkNames[link.network] ?? link.network}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

const SocialLinks = drawsProps(socialLinksComponent, ({ props, attributes, mode }) => (
  <div {...attributes} className={cx(attributes.className, "lintel-social-links")}>
    <SocialLinkList links={props.links} size={props.size} mode={mode} />
  </div>
));

const TeamMember = drawsProps(teamMemberComponent, ({ props, attributes, editableText, mode }) => (
  <article {...attributes} className={cx(attributes.className, "lintel-person")}>
    {props.photo.src ? (
      <img
        className="lintel-person__photo"
        src={props.photo.src}
        alt={props.photo.alt}
        loading="lazy"
      />
    ) : (
      mode === "canvas" && <div className="lintel-person__photo" data-lintel-placeholder="image" />
    )}
    <h3 className="lintel-person__name" {...editableText("name")}>
      {props.name}
    </h3>
    {props.role && <p className="lintel-person__role">{props.role}</p>}
    {props.bio && <p className="lintel-person__bio">{props.bio}</p>}
    {props.links.length > 0 && (
      <SocialLinkList links={props.links} size="small" mode={mode} label={`${props.name} online`} />
    )}
  </article>
));

const FeatureList = drawsProps(featureListComponent, ({ props, attributes }) => (
  <ul
    {...attributes}
    className={cx(
      attributes.className,
      "lintel-features",
      `lintel-features--${props.layout}`,
      `lintel-features--columns-${props.columns}`,
    )}
  >
    {props.features.map((feature, index) => (
      <li key={index} className="lintel-features__item">
        <span className="lintel-features__icon" aria-hidden="true">
          <SiteIcon name={feature.icon || "check"} />
        </span>
        <span className="lintel-features__words">
          <strong className="lintel-features__title">{feature.title}</strong>
          {feature.text && <span className="lintel-features__text">{feature.text}</span>}
        </span>
      </li>
    ))}
  </ul>
));

const Breadcrumbs = drawsProps(breadcrumbsComponent, ({ props, attributes, mode }) => (
  <nav
    {...attributes}
    className={cx(attributes.className, "lintel-breadcrumbs")}
    aria-label="Breadcrumbs"
  >
    <ol>
      {props.links.map((link, index) => (
        <li key={index}>
          <a href={linkFor(link.href, mode)}>{link.label}</a>
        </li>
      ))}
      <li>
        <span aria-current="page">{props.current}</span>
      </li>
    </ol>
  </nav>
));

/** The date as words for the HTML; the script ticks the numbers. */
const Countdown = drawsProps(countdownComponent, ({ props, attributes, editableText }) => {
  const units = ["days", "hours", "minutes", ...(props.showSeconds ? ["seconds"] : [])];
  return (
    <div
      {...attributes}
      className={cx(attributes.className, "lintel-countdown")}
      data-behaviour="countdown"
      data-until={props.until || undefined}
      data-finished={props.finishedText}
    >
      <p className="lintel-countdown__label" {...editableText("label")}>
        {props.label}
      </p>
      <p className="lintel-countdown__units" role="timer" aria-live="off">
        {units.map((unit) => (
          <span key={unit} className="lintel-countdown__unit" data-unit={unit}>
            <span className="lintel-countdown__number">--</span>
            <span className="lintel-countdown__name">{unit}</span>
          </span>
        ))}
      </p>
      {props.until && (
        <p className="lintel-visually-hidden">
          Until <time dateTime={props.until}>{props.until.replace("T", " at ")}</time>
        </p>
      )}
    </div>
  );
});

const RichText = drawsProps(richTextComponent, ({ props, attributes, node }) => {
  const item = useCurrentItem();
  const boundPath = node.bindings?.markdown;
  const bound = boundPath ? item?.fields[boundPath] : undefined;
  const html = isBoundHtml(bound) ? bound.html : markdownToHtml(props.markdown);
  return (
    <div
      {...attributes}
      className={cx(attributes.className, "lintel-rich-text")}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});

export const infoRenders = {
  marquee: Marquee,
  counter: Counter,
  badge: Badge,
  table: Table,
  timeline: Timeline,
  testimonial: Testimonial,
  pricingTable: PricingTable,
  socialLinks: SocialLinks,
  teamMember: TeamMember,
  featureList: FeatureList,
  breadcrumbs: Breadcrumbs,
  countdown: Countdown,
  richText: RichText,
};
