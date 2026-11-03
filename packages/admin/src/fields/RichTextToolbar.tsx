import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import {
  Bold,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  TextQuote,
  type LucideIcon,
} from "lucide-react";
import { Fragment, useRef, useState, type KeyboardEvent } from "react";
import { classNames } from "../design/classNames.js";
import { t, type StringKey } from "../i18n/strings.js";

interface ToolbarAction {
  label: StringKey;
  icon: LucideIcon;
  isActive: (editor: Editor) => boolean;
  run: (editor: Editor) => void;
}

/** The formatting buttons, in the order writers reach for them. Separators split the groups. */
const actionGroups: ToolbarAction[][] = [
  [
    {
      label: "fields.richText.heading",
      icon: Heading2,
      isActive: (editor) => editor.isActive("heading", { level: 2 }),
      run: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      label: "fields.richText.subheading",
      icon: Heading3,
      isActive: (editor) => editor.isActive("heading", { level: 3 }),
      run: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
  ],
  [
    {
      label: "fields.richText.bold",
      icon: Bold,
      isActive: (editor) => editor.isActive("bold"),
      run: (editor) => editor.chain().focus().toggleBold().run(),
    },
    {
      label: "fields.richText.italic",
      icon: Italic,
      isActive: (editor) => editor.isActive("italic"),
      run: (editor) => editor.chain().focus().toggleItalic().run(),
    },
  ],
  [
    {
      label: "fields.richText.bulletList",
      icon: List,
      isActive: (editor) => editor.isActive("bulletList"),
      run: (editor) => editor.chain().focus().toggleBulletList().run(),
    },
    {
      label: "fields.richText.numberedList",
      icon: ListOrdered,
      isActive: (editor) => editor.isActive("orderedList"),
      run: (editor) => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      label: "fields.richText.quote",
      icon: TextQuote,
      isActive: (editor) => editor.isActive("blockquote"),
      run: (editor) => editor.chain().focus().toggleBlockquote().run(),
    },
  ],
];

const actions = actionGroups.flat();

interface RichTextToolbarProps {
  editor: Editor;
  /** The id of the text it formats, for `aria-controls`. */
  controlId: string;
  isLinkFormOpen: boolean;
  onToggleLinkForm: () => void;
  /** Opens the image picker, for a picture where the cursor is. */
  onAddPicture: () => void;
}

/**
 * A toolbar in the ARIA sense: one tab stop, with the arrow keys moving between buttons,
 * so keyboard users pass it in one keystroke on the way to the text.
 */
export function RichTextToolbar({
  editor,
  controlId,
  isLinkFormOpen,
  onToggleLinkForm,
  onAddPicture,
}: RichTextToolbarProps) {
  const [focusIndex, setFocusIndex] = useState(0);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);

  // Re-render only when the formatting under the cursor changes, not on every keystroke.
  const activeStates = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      actions: actions.map((action) => action.isActive(current)),
      link: current.isActive("link"),
    }),
  });

  // Every button in order, the link button after italic, with a separator before each group,
  // and Add picture last, in a group of its own.
  const formattingItems = actionGroups.flatMap((group, groupIndex) => {
    const items = group.map((action, indexInGroup) => ({
      label: t(action.label),
      icon: action.icon,
      isPressed: activeStates.actions[actions.indexOf(action)] ?? false,
      onPress: () => action.run(editor),
      startsGroup: groupIndex > 0 && indexInGroup === 0,
    }));
    if (groupIndex !== 1) return items;
    return [
      ...items,
      {
        label: t("fields.richText.link"),
        icon: Link2,
        isPressed: activeStates.link || isLinkFormOpen,
        onPress: onToggleLinkForm,
        startsGroup: false,
      },
    ];
  });
  const buttonItems = [
    ...formattingItems,
    {
      label: t("fields.richText.addPicture"),
      icon: ImagePlus,
      isPressed: undefined,
      onPress: onAddPicture,
      startsGroup: true,
    },
  ];

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const count = buttonItems.length;
    const nextIndexByKey: Partial<Record<string, number>> = {
      ArrowRight: (focusIndex + 1) % count,
      ArrowLeft: (focusIndex - 1 + count) % count,
      Home: 0,
      End: count - 1,
    };
    const nextIndex = nextIndexByKey[event.key];
    if (nextIndex === undefined) return;
    event.preventDefault();
    setFocusIndex(nextIndex);
    buttons.current[nextIndex]?.focus();
  }

  return (
    <div
      role="toolbar"
      aria-label={t("fields.richText.toolbar")}
      aria-controls={controlId}
      onKeyDown={handleKeyDown}
      className="sticky top-16 z-10 flex flex-wrap items-center gap-0.5 rounded-t-card bg-surface/90 px-2 py-1.5 backdrop-blur-xl hairline-bottom"
    >
      {buttonItems.map((item, index) => (
        <Fragment key={item.label}>
          {item.startsGroup && <span aria-hidden="true" className="mx-1.5 h-4 w-px bg-separator" />}
          <button
            ref={(element) => {
              buttons.current[index] = element;
            }}
            type="button"
            aria-label={item.label}
            title={item.label}
            aria-pressed={item.isPressed}
            tabIndex={index === focusIndex ? 0 : -1}
            onFocus={() => setFocusIndex(index)}
            // Keep the text selection: a mousedown on a button would otherwise blur the editor.
            onMouseDown={(event) => event.preventDefault()}
            onClick={item.onPress}
            className={classNames(
              "flex size-8 items-center justify-center rounded-control transition-colors duration-150 ease-standard focus-visible:focus-ring",
              item.isPressed
                ? "bg-accent/14 text-accent"
                : "text-label-secondary hover:bg-fill hover:text-label",
            )}
          >
            <item.icon aria-hidden="true" strokeWidth={2} className="size-[17px]" />
          </button>
        </Fragment>
      ))}
    </div>
  );
}
