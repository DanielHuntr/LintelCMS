import type { ReactNode } from "react";
import { AppMark } from "../design/AppMark.js";

interface SetupShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

/**
 * The calm, centred frame around every setup screen, in the same visual language as sign-in:
 * the app mark, the page's one h1 and a sentence, then the current step.
 */
export function SetupShell({ title, subtitle, children }: SetupShellProps) {
  return (
    <main className="flex min-h-screen justify-center bg-background px-4 py-14 text-label">
      <div className="flex w-full max-w-[440px] flex-col items-center">
        <AppMark size="large" />
        <h1 className="mt-6 text-title text-label">{title}</h1>
        <p className="mt-1.5 text-center text-body text-label-secondary">{subtitle}</p>
        <div className="mt-8 w-full">{children}</div>
      </div>
    </main>
  );
}
