import { CircleCheck, ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "../design/Card.js";
import { t } from "../i18n/strings.js";

/**
 * One numbered step of a guided "Connect" flow (Stripe, PayPal, Mollie): a card with its
 * number, or a tick once it's done, and the step's words and fields.
 */
export function Step({
  number,
  title,
  done,
  children,
}: {
  number: number;
  title: string;
  done: boolean;
  children: ReactNode;
}) {
  return (
    <li>
      <Card>
        <div className="flex gap-4">
          <span
            aria-hidden="true"
            className={`flex size-7 shrink-0 items-center justify-center rounded-full text-footnote font-semibold ${done ? "bg-success text-on-accent" : "bg-accent/14 text-accent"}`}
          >
            {done ? <CircleCheck className="size-4" /> : number}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-3 text-body text-label-secondary">
            <h2 className="text-headline text-label">
              <span className="sr-only">{t("shop.payments.stepNumber", { number })} </span>
              {title}
              {done && <span className="sr-only"> ({t("shop.setup.done")})</span>}
            </h2>
            {children}
          </div>
        </div>
      </Card>
    </li>
  );
}

/** A link into the provider's own dashboard, opening in a new tab. */
export function ExternalButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex w-fit items-center gap-1.5 text-body font-medium text-accent underline decoration-1 underline-offset-2 hover:decoration-2 focus-visible:focus-ring"
    >
      {children}
      <ExternalLink aria-hidden="true" className="size-4" />
      <span className="sr-only">{t("help.newTab")}</span>
    </a>
  );
}
