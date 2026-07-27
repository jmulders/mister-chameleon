"use client";

import { useEffect, useRef } from "react";

/**
 * Minimal WYSIWYG editor for an email HTML block. contentEditable + a small
 * toolbar (execCommand). Uncontrolled: the DOM is initialised once so typing
 * never resets the caret; changes are emitted via onChange(innerHTML).
 * The HTML is sanitized server-side on save.
 */

const tbBtn = "rounded border border-neutral-300 bg-white px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50";

export function HtmlBlockEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (value || "")) ref.current.innerHTML = value || "";
    // Initialise once — subsequent edits are driven by the DOM, not by props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = () => onChange(ref.current?.innerHTML ?? "");
  const cmd = (command: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    emit();
  };
  const link  = () => { const u = window.prompt("Link URL (https://…)"); if (u) cmd("createLink", u); };
  const image = () => { const u = window.prompt("Image URL (https://…)"); if (u) cmd("insertImage", u); };
  const table = () => cmd("insertHTML",
    `<table style="border-collapse:collapse;width:100%"><tbody>` +
    `<tr><td style="border:1px solid #ddd;padding:6px">Cell</td><td style="border:1px solid #ddd;padding:6px">Cell</td></tr>` +
    `<tr><td style="border:1px solid #ddd;padding:6px">Cell</td><td style="border:1px solid #ddd;padding:6px">Cell</td></tr>` +
    `</tbody></table><p><br></p>`);

  const B = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
    <button type="button" className={tbBtn} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>{children}</button>
  );

  return (
    <div className="rounded-md border border-neutral-300">
      <div className="flex flex-wrap gap-1 border-b border-neutral-200 bg-neutral-50 p-1.5">
        <B onClick={() => cmd("bold")}><b>B</b></B>
        <B onClick={() => cmd("italic")}><i>I</i></B>
        <B onClick={() => cmd("underline")}><u>U</u></B>
        <B onClick={() => cmd("formatBlock", "H2")}>H2</B>
        <B onClick={() => cmd("formatBlock", "P")}>P</B>
        <B onClick={() => cmd("insertUnorderedList")}>• List</B>
        <B onClick={() => cmd("insertOrderedList")}>1. List</B>
        <B onClick={link}>Link</B>
        <B onClick={image}>Image</B>
        <B onClick={table}>Table</B>
        <B onClick={() => cmd("removeFormat")}>Clear</B>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        className="min-h-[120px] px-3 py-2 text-sm text-neutral-800 focus:outline-none [&_a]:text-indigo-600 [&_a]:underline [&_h2]:mb-1 [&_h2]:text-lg [&_h2]:font-semibold [&_img]:max-w-full [&_table]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
      />
    </div>
  );
}
