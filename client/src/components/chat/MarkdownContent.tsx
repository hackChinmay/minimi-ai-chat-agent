import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { isSafeUrl } from '../../utils/sanitize';

interface MarkdownContentProps {
  content: string;
}

export const MarkdownContent: React.FC<MarkdownContentProps> = ({ content }) => {
  if (!content) return null;

  // Split content into blocks by code fences or newlines
  const blocks = parseBlocks(content);

  return (
    <div className="prose-chat text-sm leading-relaxed space-y-2.5 break-words">
      {blocks.map((block, idx) => (
        <BlockRenderer key={idx} block={block} />
      ))}
    </div>
  );
};

// ----------------------------------------------------------------------------
// Block Parser & Types
// ----------------------------------------------------------------------------

type BlockType =
  | { type: 'code'; language: string; code: string }
  | { type: 'heading'; level: number; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'blockquote'; text: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'paragraph'; text: string };

function parseBlocks(markdown: string): BlockType[] {
  const blocks: BlockType[] = [];
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced Code Block
    if (line.trim().startsWith('```')) {
      const language = line.trim().replace(/^```/, '').trim() || 'text';
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length && lines[i].trim().startsWith('```')) {
        i++; // skip closing fence
      }
      blocks.push({
        type: 'code',
        language,
        code: codeLines.join('\n'),
      });
      continue;
    }

    // Heading (# to ####)
    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      });
      i++;
      continue;
    }

    // Blockquote (> )
    if (line.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({
        type: 'blockquote',
        text: quoteLines.join('\n'),
      });
      continue;
    }

    // Unordered list (- or * )
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i++;
      }
      blocks.push({
        type: 'list',
        ordered: false,
        items,
      });
      continue;
    }

    // Ordered list (1. 2. etc.)
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      blocks.push({
        type: 'list',
        ordered: true,
        items,
      });
      continue;
    }

    // Markdown Table (| col1 | col2 |)
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }
      if (tableLines.length >= 2) {
        const parseRow = (r: string) =>
          r
            .slice(1, -1)
            .split('|')
            .map((c) => c.trim());
        const headers = parseRow(tableLines[0]);
        // line 1 is usually separator (|---|---|)
        const contentRows = tableLines.slice(2).map(parseRow);
        blocks.push({
          type: 'table',
          headers,
          rows: contentRows,
        });
        continue;
      }
    }

    // Blank line
    if (!line.trim()) {
      i++;
      continue;
    }

    // Paragraph (accumulate consecutive non-empty lines)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].match(/^(#{1,4})\s+/) &&
      !lines[i].startsWith('>') &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !(lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|'))
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({
        type: 'paragraph',
        text: paraLines.join(' '),
      });
    }
  }

  return blocks;
}

// ----------------------------------------------------------------------------
// Block Component
// ----------------------------------------------------------------------------

const BlockRenderer: React.FC<{ block: BlockType }> = ({ block }) => {
  switch (block.type) {
    case 'code':
      return <CodeBlock code={block.code} language={block.language} />;
    case 'heading': {
      const Tag = `h${Math.min(block.level + 1, 6)}` as keyof JSX.IntrinsicElements;
      const sizeClass =
        block.level === 1
          ? 'text-lg font-bold'
          : block.level === 2
          ? 'text-base font-semibold'
          : 'text-sm font-semibold';
      return (
        <Tag className={`${sizeClass} mt-3 mb-1 text-slate-900 dark:text-slate-100`}>
          <InlineRenderer text={block.text} />
        </Tag>
      );
    }
    case 'list': {
      const ListTag = block.ordered ? 'ol' : 'ul';
      const listStyle = block.ordered ? 'list-decimal' : 'list-disc';
      return (
        <ListTag className={`${listStyle} pl-5 space-y-1 my-1.5 text-slate-800 dark:text-slate-200`}>
          {block.items.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              <InlineRenderer text={item} />
            </li>
          ))}
        </ListTag>
      );
    }
    case 'blockquote':
      return (
        <blockquote className="border-l-4 border-indigo-500/50 pl-3 my-2 italic text-slate-600 dark:text-slate-400">
          <InlineRenderer text={block.text} />
        </blockquote>
      );
    case 'table':
      return (
        <div className="overflow-x-auto my-3 rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="min-w-full text-xs text-left">
            <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                {block.headers.map((h, idx) => (
                  <th key={idx} className="px-3 py-2">
                    <InlineRenderer text={h} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {block.rows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3 py-2 text-slate-800 dark:text-slate-200">
                      <InlineRenderer text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'paragraph':
    default:
      return (
        <p className="text-slate-800 dark:text-slate-200 leading-relaxed">
          <InlineRenderer text={block.text} />
        </p>
      );
  }
};

// ----------------------------------------------------------------------------
// Code Block with Copy
// ----------------------------------------------------------------------------

const CodeBlock: React.FC<{ code: string; language: string }> = ({ code, language }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div className="my-3 rounded-lg overflow-hidden border border-slate-800 bg-slate-950 text-slate-100 shadow-sm text-xs">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-slate-900 border-b border-slate-800 text-[11px] font-mono text-slate-400">
        <span>{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-slate-100 transition-colors focus:outline-none"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3.5 overflow-x-auto font-mono text-xs leading-relaxed text-slate-200">
        <code>{code}</code>
      </pre>
    </div>
  );
};

// ----------------------------------------------------------------------------
// Inline Token Renderer (bold, italic, code, links, citations)
// ----------------------------------------------------------------------------

export const InlineRenderer: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;

  // Regex to split on:
  // 1. Markdown Links [text](url)
  // 2. Inline code `code`
  // 3. Bold **text**
  // 4. Citation badges [1], [2], [source-1]
  const pattern =
    /(\[[^\]]+\]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[(?:source-)?\d+\])/g;

  const parts = text.split(pattern);

  return (
    <>
      {parts.map((part, idx) => {
        if (!part) return null;

        // Markdown Link: [text](url)
        const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (linkMatch) {
          const linkText = linkMatch[1];
          const linkUrl = linkMatch[2];
          if (isSafeUrl(linkUrl)) {
            return (
              <a
                key={idx}
                href={linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium break-all"
              >
                {linkText}
              </a>
            );
          }
          return <span key={idx}>{linkText}</span>;
        }

        // Inline Code: `code`
        if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
          return (
            <code
              key={idx}
              className="px-1.5 py-0.5 rounded text-[12px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700/60"
            >
              {part.slice(1, -1)}
            </code>
          );
        }

        // Bold: **text**
        if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
          return (
            <strong key={idx} className="font-semibold text-slate-900 dark:text-slate-100">
              {part.slice(2, -2)}
            </strong>
          );
        }

        // Italic: *text*
        if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
          return (
            <em key={idx} className="italic">
              {part.slice(1, -1)}
            </em>
          );
        }

        // Citation token: [1] or [source-1]
        const citationMatch = part.match(/^\[(?:source-)?(\d+)\]$/);
        if (citationMatch) {
          const num = citationMatch[1];
          return (
            <sup
              key={idx}
              className="inline-flex items-center justify-center font-bold text-[10px] text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 rounded px-1 ml-0.5"
            >
              [{num}]
            </sup>
          );
        }

        return <React.Fragment key={idx}>{part}</React.Fragment>;
      })}
    </>
  );
};
