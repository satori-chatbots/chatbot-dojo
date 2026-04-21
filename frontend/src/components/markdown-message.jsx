import React, { useState } from "react";
import { Check, Copy } from "lucide-react";

const splitInlineMarkdown = (text) => {
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  const segments = text.split(pattern).filter(Boolean);

  return segments.map((segment, index) => {
    if (/^\*\*[^*]+\*\*$/.test(segment)) {
      return <strong key={`strong-${index}`}>{segment.slice(2, -2)}</strong>;
    }

    if (/^\*[^*]+\*$/.test(segment)) {
      return <em key={`em-${index}`}>{segment.slice(1, -1)}</em>;
    }

    if (/^`[^`]+`$/.test(segment)) {
      return (
        <code
          key={`code-${index}`}
          className="rounded bg-black/10 px-1.5 py-0.5 font-mono text-[0.9em] dark:bg-white/10"
        >
          {segment.slice(1, -1)}
        </code>
      );
    }

    const linkMatch = segment.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const [, label, href] = linkMatch;
      return (
        <a
          key={`link-${index}`}
          href={href}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
        >
          {label}
        </a>
      );
    }

    return <React.Fragment key={`text-${index}`}>{segment}</React.Fragment>;
  });
};

const renderParagraph = (text, key) => {
  const lines = text.split("\n");
  return (
    <p key={key} className="break-words text-sm leading-6">
      {lines.map((line, index) => (
        <React.Fragment key={`${key}-line-${index}`}>
          {index > 0 && <br />}
          {splitInlineMarkdown(line)}
        </React.Fragment>
      ))}
    </p>
  );
};

const renderList = (items, ordered, key) => {
  const ListTag = ordered ? "ol" : "ul";
  return (
    <ListTag
      key={key}
      className={`space-y-1 pl-5 text-sm leading-6 ${
        ordered ? "list-decimal" : "list-disc"
      } break-words`}
    >
      {items.map((item, index) => (
        <li key={`${key}-item-${index}`}>{splitInlineMarkdown(item)}</li>
      ))}
    </ListTag>
  );
};

const CodeBlock = ({ lines, language }) => {
  const [copied, setCopied] = useState(false);
  const code = lines.join("\n");

  const handleCopy = async () => {
    try {
      await globalThis.navigator?.clipboard?.writeText(code);
      setCopied(true);
      globalThis.setTimeout(() => {
        setCopied(false);
      }, 1500);
    } catch (error) {
      console.error("Failed to copy code block:", error);
    }
  };

  return (
    <div className="relative max-w-full">
      <button
        type="button"
        onClick={() => void handleCopy()}
        className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-[11px] font-medium text-white transition hover:bg-black/75"
        aria-label={copied ? "Code copied" : "Copy code"}
        title={copied ? "Copied" : "Copy code"}
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        
      </button>
      <pre className="max-w-full overflow-x-auto rounded-xl bg-black/10 px-3 py-2 pr-16 text-xs leading-6 dark:bg-white/10">
        <code
          data-language={language || undefined}
          className="block min-w-0 whitespace-pre-wrap break-words"
        >
          {code}
        </code>
      </pre>
    </div>
  );
};

const renderHeading = (level, text, key) => {
  const classNameByLevel = {
    1: "text-lg font-semibold leading-7",
    2: "text-base font-semibold leading-7",
    3: "text-sm font-semibold uppercase tracking-wide",
  };

  const HeadingTag = `h${level}`;
  return (
    <HeadingTag key={key} className={classNameByLevel[level] || "font-semibold"}>
      {splitInlineMarkdown(text)}
    </HeadingTag>
  );
};

const parseMarkdown = (content) => {
  const normalized = content.replaceAll("\r\n", "\n");
  const lines = normalized.split("\n");
  const elements = [];
  let lineIndex = 0;

  while (lineIndex < lines.length) {
    const line = lines[lineIndex];

    if (!line.trim()) {
      lineIndex += 1;
      continue;
    }

    const fenceMatch = line.match(/^```([\w-]+)?\s*$/);
    if (fenceMatch) {
      const codeLines = [];
      lineIndex += 1;
      while (lineIndex < lines.length && !/^```\s*$/.test(lines[lineIndex])) {
        codeLines.push(lines[lineIndex]);
        lineIndex += 1;
      }

      if (lineIndex < lines.length) {
        lineIndex += 1;
      }

      elements.push(
        <CodeBlock
          key={`code-${elements.length}`}
          lines={codeLines}
          language={fenceMatch[1]}
        />,
      );
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      elements.push(
        renderHeading(
          headingMatch[1].length,
          headingMatch[2],
          `heading-${elements.length}`,
        ),
      );
      lineIndex += 1;
      continue;
    }

    if (/^(-|\*|\+)\s+/.test(line)) {
      const items = [];
      while (lineIndex < lines.length && /^(-|\*|\+)\s+/.test(lines[lineIndex])) {
        items.push(lines[lineIndex].replace(/^(-|\*|\+)\s+/, ""));
        lineIndex += 1;
      }

      elements.push(renderList(items, false, `list-${elements.length}`));
      continue;
    }

    const orderedMatch = line.match(/^(\d+)\.\s+/);
    if (orderedMatch) {
      const items = [];
      while (lineIndex < lines.length && /^\d+\.\s+/.test(lines[lineIndex])) {
        items.push(lines[lineIndex].replace(/^\d+\.\s+/, ""));
        lineIndex += 1;
      }

      elements.push(renderList(items, true, `list-${elements.length}`));
      continue;
    }

    const paragraphLines = [line];
    lineIndex += 1;
    while (
      lineIndex < lines.length &&
      lines[lineIndex].trim() &&
      !/^```/.test(lines[lineIndex]) &&
      !/^(#{1,3})\s+/.test(lines[lineIndex]) &&
      !/^(-|\*|\+)\s+/.test(lines[lineIndex]) &&
      !/^\d+\.\s+/.test(lines[lineIndex])
    ) {
      paragraphLines.push(lines[lineIndex]);
      lineIndex += 1;
    }

    elements.push(
      renderParagraph(paragraphLines.join("\n"), `paragraph-${elements.length}`),
    );
  }

  return elements;
};

const MarkdownMessage = ({ content, className = "" }) => {
  const children = parseMarkdown(content || "");

  return (
    <div className={`min-w-0 max-w-full overflow-x-hidden ${className}`}>
      {children}
    </div>
  );
};

export default MarkdownMessage;
