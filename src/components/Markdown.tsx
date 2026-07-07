import { Fragment, type ReactNode } from "react";

/** Minimal markdown renderer for Aetheris replies — bold/italic/inline code,
 *  bullet & numbered lists, and headings. No remote dependency: the model's
 *  output uses a small, predictable subset of markdown, so a small regex
 *  pass covers it without pulling in a full markdown stack. */

function renderInline(text: string, keyBase: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /(\*\*(.+?)\*\*|`(.+?)`|\*(.+?)\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = re.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    if (match[2] !== undefined) parts.push(<strong key={`${keyBase}-${i}`}>{match[2]}</strong>);
    else if (match[3] !== undefined) parts.push(
      <code key={`${keyBase}-${i}`} className="rounded bg-foreground/10 px-1 py-0.5 text-[0.85em]">{match[3]}</code>,
    );
    else if (match[4] !== undefined) parts.push(<em key={`${keyBase}-${i}`}>{match[4]}</em>);
    last = re.lastIndex;
    i += 1;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export default function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushList = (key: string) => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={key} className={list.ordered ? "list-decimal space-y-0.5 pl-5" : "list-disc space-y-0.5 pl-5"}>
        {list.items.map((item, idx) => (
          <li key={idx}>{renderInline(item, `${key}-${idx}`)}</li>
        ))}
      </Tag>,
    );
    list = null;
  };

  lines.forEach((line, idx) => {
    const heading = /^(#{1,3})\s+(.*)/.exec(line);
    const bullet = /^\s*[-*]\s+(.*)/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)/.exec(line);

    if (heading) {
      flushList(`list-${idx}`);
      const level = heading[1].length;
      const className = level === 1 ? "text-base font-semibold" : level === 2 ? "text-sm font-semibold" : "text-sm font-medium";
      blocks.push(<p key={idx} className={className}>{renderInline(heading[2], `h-${idx}`)}</p>);
    } else if (bullet) {
      if (!list || list.ordered) flushList(`list-${idx}`);
      list ??= { ordered: false, items: [] };
      list.items.push(bullet[1]);
    } else if (numbered) {
      if (!list || !list.ordered) flushList(`list-${idx}`);
      list ??= { ordered: true, items: [] };
      list.items.push(numbered[1]);
    } else if (line.trim() === "") {
      flushList(`list-${idx}`);
    } else {
      flushList(`list-${idx}`);
      blocks.push(<p key={idx}>{renderInline(line, `p-${idx}`)}</p>);
    }
  });
  flushList("list-end");

  return <div className="space-y-1.5">{blocks.map((b, i) => <Fragment key={i}>{b}</Fragment>)}</div>;
}
