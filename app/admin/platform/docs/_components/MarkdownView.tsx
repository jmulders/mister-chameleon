"use client";

/**
 * MarkdownView — renders a markdown string with react-markdown + GFM (tables,
 * task lists, strikethrough). Styled with Tailwind utility classes via a
 * components map (no `prose`/typography-plugin dependency required).
 */

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownView({ content }: { content: string }) {
  return (
    <div className="text-sm leading-relaxed text-neutral-700">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="mt-6 mb-3 text-2xl font-bold text-neutral-900 first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="mt-6 mb-2 border-b border-neutral-100 pb-1 text-lg font-semibold text-neutral-900">{children}</h2>,
          h3: ({ children }) => <h3 className="mt-5 mb-2 text-base font-semibold text-neutral-900">{children}</h3>,
          h4: ({ children }) => <h4 className="mt-4 mb-1 text-sm font-semibold text-neutral-900">{children}</h4>,
          p:  ({ children }) => <p className="my-3">{children}</p>,
          a:  ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" className="font-medium text-blue-600 underline hover:text-blue-800">{children}</a>,
          ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-3 list-decimal space-y-1 pl-5">{children}</ol>,
          li: ({ children }) => <li className="marker:text-neutral-400">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-neutral-900">{children}</strong>,
          blockquote: ({ children }) => <blockquote className="my-3 border-l-4 border-neutral-200 pl-4 text-neutral-500">{children}</blockquote>,
          hr: () => <hr className="my-6 border-neutral-200" />,
          pre: ({ children }) => <pre className="my-3 overflow-x-auto rounded-md bg-neutral-900 p-3 text-xs leading-relaxed text-green-300">{children}</pre>,
          code: ({ className, children, ...props }) => {
            const isBlock = /language-/.test(className || "");
            if (isBlock) return <code className="font-mono text-xs" {...props}>{children}</code>;
            return <code className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-[0.8em] text-neutral-800" {...props}>{children}</code>;
          },
          table: ({ children }) => <div className="my-4 overflow-x-auto"><table className="w-full border-collapse text-sm">{children}</table></div>,
          thead: ({ children }) => <thead className="border-b border-neutral-200 bg-neutral-50">{children}</thead>,
          th: ({ children }) => <th className="px-3 py-2 text-left font-semibold text-neutral-900">{children}</th>,
          td: ({ children }) => <td className="border-b border-neutral-100 px-3 py-2 align-top">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
