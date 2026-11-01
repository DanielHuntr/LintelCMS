import {
  type ConditionScope,
  innerScope,
  isFieldVisible,
  topScope,
} from "@lintel/field-conditions";
import { createContext, useContext, type ReactNode } from "react";
import type { FieldMessages } from "../api/client.js";
import { classNames } from "../design/classNames.js";
import type { EntryData, Field, FieldValue } from "./field.types.js";
import type { InnerFieldProps } from "./fieldEditorProps.js";
import { widthClass } from "./fieldLayout.js";

/**
 * The values around the fields being drawn, so a field inside a group, repeater row or block
 * can have conditions on the fields outside it ("$parent.", "$root."). Each grid adds its
 * own values for the grids inside it.
 */
const ConditionScopeContext = createContext<ConditionScope | null>(null);

interface FieldGridProps {
  fields: readonly Field[];
  /** The values at this level: the entry's, or a group's, row's or block's. */
  data: EntryData;
  errors: FieldMessages;
  onChange: (handle: string, value: FieldValue) => void;
  renderField: (props: InnerFieldProps) => ReactNode;
  /**
   * Put before each field's handle in `data-field-handle`, so an error from the API
   * ("sections.<block id>.heading") can find the field to focus.
   */
  handlePrefix?: string;
  className?: string;
}

/**
 * Fields on a 12-column grid, each as wide as its width setting (the whole row on narrow
 * screens), showing only those whose conditions are met. The same rules run on the server
 * when the entry is saved (see @lintel/field-conditions), so what is hidden here is never
 * required there. Section headings and spacers are drawn here; Tab fields are handled by
 * whoever draws the tabs.
 */
export function FieldGrid({
  fields,
  data,
  errors,
  onChange,
  renderField,
  handlePrefix,
  className,
}: FieldGridProps) {
  const parent = useContext(ConditionScopeContext);
  const scope = parent ? innerScope(data, parent) : topScope(data);
  const shown = fields.filter(
    (field) =>
      field.type !== "tab" &&
      field.type !== "hidden" &&
      !field.hidden &&
      isFieldVisible(field.conditions, scope),
  );

  return (
    <ConditionScopeContext.Provider value={scope}>
      <div className="@container">
        <div className={classNames("grid grid-cols-12 gap-x-5 gap-y-7", className)}>
          {shown.map((field) => (
            <div
              key={field.handle}
              className={classNames("min-w-0", widthClass(field.width))}
              {...(handlePrefix ? { "data-field-handle": `${handlePrefix}.${field.handle}` } : {})}
            >
              {field.type === "section" ? (
                <SectionHeading field={field} />
              ) : field.type === "spacer" ? (
                <div aria-hidden="true" />
              ) : (
                renderField({
                  field,
                  value: data[field.handle],
                  onChange,
                  error: errors[field.handle],
                })
              )}
            </div>
          ))}
        </div>
      </div>
    </ConditionScopeContext.Provider>
  );
}

/**
 * The value of another field beside this one (in the same group, row, block or entry), for
 * editors that follow another field, such as a slug made from the title.
 */
export function useSiblingValue(handle: string | undefined): unknown {
  const scope = useContext(ConditionScopeContext);
  return handle ? scope?.values[handle] : undefined;
}

function SectionHeading({ field }: { field: Field }) {
  return (
    <div className="flex flex-col gap-1 pt-2 hairline-bottom pb-2">
      <h3 className="text-headline text-label">{field.label}</h3>
      {field.helpText && <p className="text-footnote text-label-secondary">{field.helpText}</p>}
    </div>
  );
}
