/**
 * Connect a field wrapper's label to the control inside it.
 *
 * The admin has many small `Field` wrappers that render a <label> next to
 * their children. Without `htmlFor` that label is only text: a screen reader
 * announces the control as an unnamed "edit text", and clicking the label does
 * not put the cursor in the field. In the admin 421 of 698 fields were like
 * that.
 *
 * When the wrapper holds exactly one native input, select or textarea, this
 * gives it an id (unless it has one) and returns that id for the label. In any
 * other case it changes nothing, so a wrapper around buttons or several
 * controls keeps working as before.
 */
import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  type ReactElement,
  type ReactNode,
} from "react";

const CONTROLS = new Set(["input", "select", "textarea"]);

export function useFieldLabel(children: ReactNode): { htmlFor: string | undefined; children: ReactNode } {
  const generatedId = useId();

  const items = Children.toArray(children);
  if (items.length !== 1) return { htmlFor: undefined, children };

  const child = items[0];
  if (!isValidElement(child) || typeof child.type !== "string" || !CONTROLS.has(child.type)) {
    return { htmlFor: undefined, children };
  }

  const control = child as ReactElement<{ id?: string }>;
  if (control.props.id) return { htmlFor: control.props.id, children };
  return { htmlFor: generatedId, children: cloneElement(control, { id: generatedId }) };
}
