import { pageLinkHref, readPageLinkId } from "@lintel/builder-model";
import type { Editor } from "@tiptap/react";
import { useState, type FormEvent } from "react";
import { Button } from "../design/Button.js";
import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";
import { ChoosePageButton } from "../page-links/ChoosePageButton.js";
import { LinkedPageField } from "../page-links/LinkedPageField.js";
import { TypeAddressButton } from "../page-links/TypeAddressButton.js";

interface RichTextLinkFormProps {
  editor: Editor;
  onDone: () => void;
}

/**
 * Adds, changes or removes a link on the selected words. It opens under the toolbar instead
 * of in a browser prompt, so it looks like the rest of the admin and works with screen readers.
 * "Choose a page…" links to the page itself (`lintel:page/<id>`), so the link follows the page
 * when its address changes; the form then shows the page's title rather than an address.
 */
export function RichTextLinkForm({ editor, onDone }: RichTextLinkFormProps) {
  const existingAddress = (editor.getAttributes("link") as { href?: string }).href ?? "";
  const [address, setAddress] = useState(existingAddress);
  const linkedPageId = readPageLinkId(address);

  function applyLink(event: FormEvent) {
    event.preventDefault();
    const href = address.trim();
    if (href === "") {
      removeLink();
      return;
    }
    linkTo(href, href);
  }

  /** `text` is what to link when nothing is selected: the address, or a picked page's title. */
  function linkTo(href: string, text: string) {
    const chain = editor.chain().focus().extendMarkRange("link");
    if (editor.state.selection.empty && !editor.isActive("link")) {
      chain.insertContent({ type: "text", text, marks: [{ type: "link", attrs: { href } }] });
    } else {
      chain.setLink({ href });
    }
    chain.run();
    onDone();
  }

  function removeLink() {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    onDone();
  }

  return (
    <form
      onSubmit={applyLink}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          editor.commands.focus();
          onDone();
        }
      }}
      className="flex flex-wrap items-end gap-2 px-3 py-3 hairline-bottom"
    >
      {linkedPageId ? (
        <LinkedPageField entryId={linkedPageId} className="min-w-56 flex-1" />
      ) : (
        <TextField
          label={t("fields.richText.linkAddress")}
          type="url"
          inputMode="url"
          placeholder={t("fields.link.urlPlaceholder")}
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          autoFocus
          className="min-w-56 flex-1"
        />
      )}
      <div className="flex flex-col gap-1 self-center">
        <ChoosePageButton
          onChoose={(page) => linkTo(pageLinkHref(page.id), page.title || page.url)}
        />
        {linkedPageId && <TypeAddressButton onClick={() => setAddress("")} />}
      </div>
      {existingAddress && (
        <Button variant="plain" onClick={removeLink}>
          {t("fields.richText.removeLink")}
        </Button>
      )}
      <Button type="submit" variant="tinted">
        {t("fields.richText.applyLink")}
      </Button>
    </form>
  );
}
