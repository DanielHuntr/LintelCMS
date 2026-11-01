import type { ReactNode } from "react";
import { DisplayTitle } from "../design/DisplayTitle.js";
import { FullScreenLayout } from "../layout/FullScreenLayout.js";

interface PublicScreenProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

/** The frame of screens people reach before signing in: sign-in's own look, centred. */
export function PublicScreen({ title, subtitle, children }: PublicScreenProps) {
  return (
    <FullScreenLayout>
      <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-24">
        <div className="w-full max-w-[420px]">
          <DisplayTitle>{title}</DisplayTitle>
          {subtitle && (
            <p className="mt-3 text-headline font-normal text-label-secondary">{subtitle}</p>
          )}
          {children}
        </div>
      </div>
    </FullScreenLayout>
  );
}
