import { CopyButton } from "../design/CopyButton.js";
import { t } from "../i18n/strings.js";

/** Commands to type on the server, each with a copy button. `{version}` is filled in. */
export function CommandList({ commands, version }: { commands: string[]; version: string }) {
  if (commands.length === 0) return null;
  return (
    <ol aria-label={t("updates.commandsLabel")} className="flex flex-col gap-2">
      {commands.map((command) => {
        const filledIn = command.replaceAll("{version}", version);
        return (
          <li
            key={command}
            className="flex items-center gap-2 rounded-control bg-fill/60 py-1.5 pr-1.5 pl-3"
          >
            <code className="min-w-0 flex-1 overflow-x-auto font-mono text-footnote whitespace-pre text-label">
              {filledIn}
            </code>
            <CopyButton value={filledIn} label={t("updates.copyCommand")} variant="plain" />
          </li>
        );
      })}
    </ol>
  );
}
