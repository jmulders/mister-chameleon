"use client";

/**
 * RichCopyEditor
 *
 * A lightweight WYSIWYG for the descriptive copy fields (hero subtitle, proof
 * text, feature body, cta text). Bold / italic / link / bullet-list are shown
 * formatted as the author types; the value is stored as the Markdown subset
 * (see lib/blocks/inline-markup.ts).
 *
 * Dependency-free: a contentEditable surface plus document.execCommand for the
 * marks, and a tolerant DOM -> Markdown serialiser. It does not try to keep the
 * contentEditable HTML pristine; instead it re-derives Markdown on every input,
 * so messy execCommand output can never corrupt the stored value.
 */

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { markdownToEditorHtml, editorNodeToMarkdown } from "@/lib/blocks/inline-markup-editor";
import { variablesNeedingFallbackWarning, type VariableEntry } from "@/lib/blocks/substitute-context-tokens";

const SAFE_URL = /^(https?:\/\/|mailto:|tel:|#|\/(?!\/))/i;

export function RichCopyEditor({
  value,
  onChange,
  placeholder,
  ariaLabel,
  className,
  variables,
}: {
  value:        string;
  onChange:     (markdown: string) => void;
  placeholder?: string;
  ariaLabel?:   string;
  className?:   string;
  /** Insertable context variables; shows an "Insert variable" toolbar control. */
  variables?:   readonly VariableEntry[];
}) {
  const [varMenuOpen, setVarMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // The Markdown we last emitted, so an external value change re-renders the DOM
  // but our own onChange echo does not (which would reset the caret).
  const lastEmitted = useRef<string>(" ");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (value === lastEmitted.current) return;
    el.innerHTML = markdownToEditorHtml(value);
    lastEmitted.current = value;
  }, [value]);

  function emit() {
    const el = ref.current;
    if (!el) return;
    const md = editorNodeToMarkdown(el);
    lastEmitted.current = md;
    onChange(md);
  }

  function exec(command: string, arg?: string) {
    ref.current?.focus();
    // execCommand is deprecated but remains the lightest cross-browser way to
    // toggle inline marks in a contentEditable; output is re-serialised anyway.
    document.execCommand(command, false, arg);
    emit();
  }

  function addLink() {
    const url = window.prompt("Link URL (https://, mailto:, tel:, /path or #anchor)")?.trim();
    if (!url) return;
    if (!SAFE_URL.test(url)) {
      window.alert("That link scheme is not allowed.");
      return;
    }
    ref.current?.focus();
    const sel = window.getSelection();
    if (sel && sel.toString().trim() !== "") {
      document.execCommand("createLink", false, url);
    } else {
      // No selection: insert the URL as the link text.
      document.execCommand("insertHTML", false, `<a href="${url}">${url}</a>`);
    }
    emit();
  }

  function insertVariable(token: string) {
    ref.current?.focus();
    // insertText drops the token at the caret (or replaces the selection); it is
    // re-serialised to Markdown like any other edit, so the stored value keeps the
    // literal `{token}` and substitution happens at render time.
    document.execCommand("insertText", false, `{${token}}`);
    setVarMenuOpen(false);
    emit();
  }

  const btnCls =
    "rounded border border-neutral-200 bg-white px-2 py-0.5 text-[11px] text-neutral-600 hover:border-brand-300 hover:text-brand-600";
  // Keep focus/selection in the editor when clicking the toolbar.
  const keepFocus = (e: ReactMouseEvent) => e.preventDefault();

  const builtinVars = variables?.filter((v) => v.source === "built-in") ?? [];
  const customVars = variables?.filter((v) => v.source === "custom") ?? [];
  const hasVars = builtinVars.length > 0 || customVars.length > 0;

  // Non-blocking warning: bare {token}s in the copy whose variable has no
  // fallback (an inline {token|default} is fine, so only a bare {token} matches).
  const noFallbackInUse = useMemo(
    () => (variables ? variablesNeedingFallbackWarning(value, variables) : ([] as VariableEntry[])),
    [variables, value],
  );

  return (
    <div className={className}>
      <div className="mb-1 flex items-center gap-1">
        <button type="button" title="Bold" onMouseDown={keepFocus} onClick={() => exec("bold")} className={btnCls} style={{ fontWeight: 700 }}>B</button>
        <button type="button" title="Italic" onMouseDown={keepFocus} onClick={() => exec("italic")} className={btnCls} style={{ fontStyle: "italic" }}>I</button>
        <button type="button" title="Insert link" onMouseDown={keepFocus} onClick={addLink} className={btnCls}>Link</button>
        <button type="button" title="Bullet list" onMouseDown={keepFocus} onClick={() => exec("insertUnorderedList")} className={btnCls}>• List</button>
        {hasVars && (
          <div className="relative">
            <button
              type="button"
              title="Insert a context variable"
              onMouseDown={keepFocus}
              onClick={() => setVarMenuOpen((o) => !o)}
              className={btnCls}
            >
              Variable ▾
            </button>
            {varMenuOpen && (
              <div
                className="absolute left-0 top-full z-20 mt-1 max-h-64 w-56 overflow-auto rounded-md border border-neutral-200 bg-white py-1 shadow-lg"
                onMouseDown={keepFocus}
              >
                {builtinVars.length > 0 && (
                  <>
                    <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Built-in</div>
                    {builtinVars.map((v) => (
                      <button
                        key={v.token}
                        type="button"
                        onMouseDown={keepFocus}
                        onClick={() => insertVariable(v.token)}
                        className="flex w-full items-baseline justify-between gap-2 px-2.5 py-1 text-left text-[11px] text-neutral-700 hover:bg-neutral-50"
                      >
                        <span>
                          {v.label}
                          {!v.hasFallback && (
                            <span className="ml-1 text-amber-500" title="No fallback set — empty values render blank">•</span>
                          )}
                        </span>
                        <span className="font-mono text-[10px] text-neutral-400">{`{${v.token}}`}</span>
                      </button>
                    ))}
                  </>
                )}
                {customVars.length > 0 && (
                  <>
                    <div className="mt-1 border-t border-neutral-100 px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Custom</div>
                    {customVars.map((v) => (
                      <button
                        key={v.token}
                        type="button"
                        onMouseDown={keepFocus}
                        onClick={() => insertVariable(v.token)}
                        className="flex w-full items-baseline justify-between gap-2 px-2.5 py-1 text-left text-[11px] text-neutral-700 hover:bg-neutral-50"
                      >
                        <span>
                          {v.label}
                          {!v.hasFallback && (
                            <span className="ml-1 text-amber-500" title="No fallback set — empty values render blank">•</span>
                          )}
                        </span>
                        <span className="font-mono text-[10px] text-neutral-400">{`{${v.token}}`}</span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <div
        ref={ref}
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={emit}
        onBlur={emit}
        className="mc-rich-editor min-h-[3.5rem] w-full rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs text-neutral-800 leading-relaxed focus:border-brand-400 focus:outline-none"
      />
      {noFallbackInUse.length > 0 && (
        <p className="mt-1 text-[11px] text-amber-600">
          No fallback set for {noFallbackInUse.map((v) => `{${v.token}}`).join(", ")} — empty values render blank; add a fallback or use <code className="font-mono">{"{token|default}"}</code>.
        </p>
      )}
    </div>
  );
}
