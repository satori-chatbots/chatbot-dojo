import React, { useState } from "react";
import { Check, Copy } from "lucide-react";

const SAFE_LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

const escapeCodeHtml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const sanitizeMarkdownLinkHref = (href) => {
  const trimmedHref = href?.trim();
  if (!trimmedHref) {
    return undefined;
  }

  try {
    const baseOrigin = globalThis.location?.origin || "http://localhost";
    const parsedUrl = new URL(trimmedHref, baseOrigin);
    return SAFE_LINK_PROTOCOLS.has(parsedUrl.protocol)
      ? parsedUrl.href
      : undefined;
  } catch {
    return undefined;
  }
};

const normalizeLanguage = (language) => {
  const normalized = (language || "").toLowerCase();

  if (["js", "jsx", "javascript", "ts", "tsx", "typescript"].includes(normalized)) {
    return "javascript";
  }

  if (["py", "python"].includes(normalized)) {
    return "python";
  }

  if (["sh", "shell", "bash", "zsh"].includes(normalized)) {
    return "bash";
  }

  if (["yml", "yaml"].includes(normalized)) {
    return "yaml";
  }

  if (["html", "xml", "svg"].includes(normalized)) {
    return "html";
  }

  return normalized || "plain";
};

const applyKeywordHighlighting = (source, pattern) =>
  source.replaceAll(
    pattern,
    (match) => `<span class="code-token-keyword">${match}</span>`,
  );

const applyNumberHighlighting = (source) =>
  source.replaceAll(
    /(^|[^\w])(-?\d+(?:\.\d+)?)(?![\w.])/gm,
    '$1<span class="code-token-number">$2</span>',
  );

const highlightWithPlaceholders = (source, definitions, transform) => {
  const tokens = [];
  let highlighted = source;

  const stash = (pattern, className) => {
    highlighted = highlighted.replaceAll(pattern, (match) => {
      const tokenKey = `@@CODE_TOKEN_${tokens.length}@@`;
      tokens.push(`<span class="${className}">${match}</span>`);
      return tokenKey;
    });
  };

  for (const definition of definitions) {
    stash(definition.pattern, definition.className);
  }

  highlighted = transform(highlighted);

  return highlighted.replaceAll(/@@CODE_TOKEN_(\d+)@@/g, (_, index) => tokens[Number(index)]);
};

const highlightJson = (code) => {
  let highlighted = escapeCodeHtml(code);

  highlighted = highlighted.replaceAll(
    /"([^"\n]+)"(\s*:)/g,
    '"<span class="code-token-property">$1</span>"$2',
  );

  highlighted = highlighted.replaceAll(
    /:\s*("(?:[^"\\]|\\.)*")/g,
    ': <span class="code-token-string">$1</span>',
  );

  highlighted = applyNumberHighlighting(highlighted);

  highlighted = highlighted.replaceAll(
    /\b(true|false|null)\b/g,
    '<span class="code-token-keyword">$1</span>',
  );

  return highlighted;
};

const highlightYaml = (code) =>
  highlightWithPlaceholders(
    escapeCodeHtml(code),
    [
      {
        pattern: /(#.*$)/gm,
        className: "code-token-comment",
      },
      {
        pattern: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g,
        className: "code-token-string",
      },
    ],
    (highlighted) => {
      let nextValue = highlighted.replaceAll(
        /^(\s*)([A-Za-z_][\w-]*)(\s*:)/gm,
        '$1<span class="code-token-property">$2</span>$3',
      );

      nextValue = applyNumberHighlighting(nextValue);
      nextValue = nextValue.replaceAll(
        /\b(true|false|null|yes|no|on|off)\b/gi,
        '<span class="code-token-keyword">$1</span>',
      );

      return nextValue;
    },
  );

const highlightJavaScript = (code) =>
  highlightWithPlaceholders(
    escapeCodeHtml(code),
    [
      {
        pattern: /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm,
        className: "code-token-comment",
      },
      {
        pattern: /(`(?:\\[\s\S]|[^`])*`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g,
        className: "code-token-string",
      },
    ],
    (highlighted) => {
      let nextValue = applyKeywordHighlighting(
        highlighted,
        /\b(const|let|var|function|return|if|else|for|while|switch|case|break|continue|try|catch|finally|throw|new|class|extends|import|from|export|default|await|async|typeof|instanceof|in|of)\b/g,
      );

      nextValue = nextValue.replaceAll(
        /\b(true|false|null|undefined|this|super)\b/g,
        '<span class="code-token-constant">$&</span>',
      );
      nextValue = applyNumberHighlighting(nextValue);

      return nextValue;
    },
  );

const highlightPython = (code) =>
  highlightWithPlaceholders(
    escapeCodeHtml(code),
    [
      {
        pattern: /(#.*$)/gm,
        className: "code-token-comment",
      },
      {
        pattern: /("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g,
        className: "code-token-string",
      },
    ],
    (highlighted) => {
      let nextValue = applyKeywordHighlighting(
        highlighted,
        /\b(def|class|return|if|elif|else|for|while|try|except|finally|raise|import|from|as|with|pass|break|continue|lambda|yield|async|await|match|case|in|is|not|and|or)\b/g,
      );

      nextValue = nextValue.replaceAll(
        /\b(True|False|None|self)\b/g,
        '<span class="code-token-constant">$1</span>',
      );
      nextValue = applyNumberHighlighting(nextValue);

      return nextValue;
    },
  );

const highlightBash = (code) =>
  highlightWithPlaceholders(
    escapeCodeHtml(code),
    [
      {
        pattern: /(#.*$)/gm,
        className: "code-token-comment",
      },
      {
        pattern: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g,
        className: "code-token-string",
      },
    ],
    (highlighted) => {
      let nextValue = applyKeywordHighlighting(
        highlighted,
        /\b(if|then|else|fi|for|do|done|case|esac|while|in|function)\b/g,
      );

      nextValue = nextValue.replaceAll(
        /(\$\{?[\w@#?$!*.-]+\}?)/g,
        '<span class="code-token-variable">$1</span>',
      );
      nextValue = nextValue.replaceAll(
        /(^|\s)(--?[\w-]+)/gm,
        '$1<span class="code-token-attribute">$2</span>',
      );

      return nextValue;
    },
  );

const highlightHtml = (code) =>
  highlightWithPlaceholders(
    escapeCodeHtml(code),
    [
      {
        pattern: /(&lt;!--[\s\S]*?--&gt;)/g,
        className: "code-token-comment",
      },
      {
        pattern: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g,
        className: "code-token-string",
      },
    ],
    (highlighted) =>
      highlighted.replaceAll(
        /(&lt;\/?)([\w-]+)(.*?)(\/?&gt;)/g,
        '$1<span class="code-token-keyword">$2</span>$3$4',
      ).replaceAll(
        /\b([\w:-]+)(=)/g,
        '<span class="code-token-attribute">$1</span>$2',
      ),
  );

const highlightSql = (code) =>
  highlightWithPlaceholders(
    escapeCodeHtml(code),
    [
      {
        pattern: /(--.*$|\/\*[\s\S]*?\*\/)/gm,
        className: "code-token-comment",
      },
      {
        pattern: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g,
        className: "code-token-string",
      },
    ],
    (highlighted) => {
      let nextValue = applyKeywordHighlighting(
        highlighted,
        /\b(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP|BY|ORDER|HAVING|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|ALTER|DROP|AS|AND|OR|NOT|NULL|LIMIT|OFFSET)\b/gi,
      );

      nextValue = applyNumberHighlighting(nextValue);
      return nextValue;
    },
  );

const highlightCss = (code) =>
  highlightWithPlaceholders(
    escapeCodeHtml(code),
    [
      {
        pattern: /(\/\*[\s\S]*?\*\/)/g,
        className: "code-token-comment",
      },
      {
        pattern: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g,
        className: "code-token-string",
      },
    ],
    (highlighted) => {
      let nextValue = highlighted.replaceAll(
        /(^|[{;\s])([a-z-]+)(\s*:)/gm,
        '$1<span class="code-token-property">$2</span>$3',
      );

      nextValue = nextValue.replaceAll(
        /(#(?:[\da-fA-F]{3}|[\da-fA-F]{6})\b)/g,
        '<span class="code-token-number">$1</span>',
      );
      nextValue = applyNumberHighlighting(nextValue);

      return nextValue;
    },
  );

const highlightGenericCode = (code) =>
  highlightWithPlaceholders(
    escapeCodeHtml(code),
    [
      {
        pattern: /(\/\/.*$|#.*$|\/\*[\s\S]*?\*\/)/gm,
        className: "code-token-comment",
      },
      {
        pattern: /(`(?:\\[\s\S]|[^`])*`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g,
        className: "code-token-string",
      },
    ],
    (highlighted) => applyNumberHighlighting(highlighted),
  );

const highlightCode = (code, language) => {
  const normalizedLanguage = normalizeLanguage(language);

  switch (normalizedLanguage) {
    case "json": {
      return highlightJson(code);
    }
    case "yaml": {
      return highlightYaml(code);
    }
    case "javascript": {
      return highlightJavaScript(code);
    }
    case "python": {
      return highlightPython(code);
    }
    case "bash": {
      return highlightBash(code);
    }
    case "html": {
      return highlightHtml(code);
    }
    case "sql": {
      return highlightSql(code);
    }
    case "css": {
      return highlightCss(code);
    }
    default: {
      return highlightGenericCode(code);
    }
  }
};

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
      const sanitizedHref = sanitizeMarkdownLinkHref(href);
      if (!sanitizedHref) {
        return <React.Fragment key={`text-${index}`}>{label}</React.Fragment>;
      }

      return (
        <a
          key={`link-${index}`}
          href={sanitizedHref}
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
  const highlightedCode = highlightCode(code, language);

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
      {language ? (
        <span className="absolute left-3 top-2 z-10 rounded-md bg-black/50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/85">
          {normalizeLanguage(language)}
        </span>
      ) : null}
      <button
        type="button"
        onClick={() => void handleCopy()}
        className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-[11px] font-medium text-white transition hover:bg-black/75"
        aria-label={copied ? "Code copied" : "Copy code"}
        title={copied ? "Copied" : "Copy code"}
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        <span>{copied ? "Copied" : "Copy"}</span>
      </button>
      <pre className="max-w-full overflow-x-auto rounded-xl bg-black/10 px-3 py-2 pt-10 pr-16 text-xs leading-6 dark:bg-white/10">
        <code
          data-language={language || undefined}
          className="block min-w-0 whitespace-pre-wrap break-words"
          dangerouslySetInnerHTML={{ __html: highlightedCode }}
        />
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
