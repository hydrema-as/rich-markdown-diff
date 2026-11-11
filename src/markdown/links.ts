/*
 * MIT License
 *
 * Copyright (c) 2026 Rich Markdown Diff Authors
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/**
 * What a link in the rendered diff points at, and where in a Markdown file a
 * fragment lands. Kept free of the vscode API so it can be unit tested.
 */

export type LinkTarget =
  | { kind: "external"; uri: string }
  | { kind: "anchor"; fragment: string }
  | { kind: "file"; path: string; rootRelative: boolean; fragment?: string };

const EXTERNAL_SCHEMES = /^(?:https?|mailto):/i;
const ANY_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

function decode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/**
 * Classifies a link's href. Returns undefined for a scheme the diff does not
 * follow, such as javascript: or command:.
 */
export function classifyLink(href: string): LinkTarget | undefined {
  const link = href.trim();
  if (!link) {
    return undefined;
  }
  if (EXTERNAL_SCHEMES.test(link)) {
    return { kind: "external", uri: link };
  }
  if (ANY_SCHEME.test(link) || link.startsWith("//")) {
    return undefined;
  }
  if (link.startsWith("#")) {
    return { kind: "anchor", fragment: decode(link.slice(1)) };
  }
  const hash = link.indexOf("#");
  const pathAndQuery = hash === -1 ? link : link.slice(0, hash);
  const filePath = decode(pathAndQuery.split("?")[0]);
  if (!filePath) {
    return undefined;
  }
  const fragment = hash === -1 ? undefined : decode(link.slice(hash + 1)) || undefined;
  return { kind: "file", path: filePath, rootRelative: filePath.startsWith("/"), fragment };
}

/**
 * The zero-based line range of a GitHub/GitLab line fragment: L12, L12-L20,
 * L12C3-L20C8 or L12-20.
 */
export function lineRangeOf(fragment: string): { start: number; end: number } | undefined {
  const match = /^L(\d+)(?:C\d+)?(?:-L?(\d+)(?:C\d+)?)?$/i.exec(fragment);
  if (!match) {
    return undefined;
  }
  const start = Math.max(0, parseInt(match[1], 10) - 1);
  const end = match[2] ? Math.max(start, parseInt(match[2], 10) - 1) : start;
  return { start, end };
}

/**
 * The anchor VS Code's Markdown preview and GitHub give a heading: lower case,
 * whitespace to hyphens, punctuation removed. "REQ-1 — Brake Threshold"
 * becomes "req-1--brake-threshold".
 */
export function slugify(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(
      /[\][!/'"#$%&()*+,.:;<=>?@\\^{|}~`。，、；：？！…—–·ˉ¨‘’“”々～‖∶＂＇｀｜〃〔〕〈〉《》「」『』．〖〗【】（）［］｛｝]/g,
      "",
    )
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

/** A heading's text as rendered: links reduced to their text, tags and emphasis markers dropped. */
function headingText(source: string): string {
  return source
    .replace(/\s+#+\s*$/, "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/[*_`~]/g, "");
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The zero-based line a fragment points at in a Markdown file: an element
 * carrying it as id or name, else the heading whose slug it is. Repeated
 * headings take -1, -2 suffixes, as in the preview. Fenced code is skipped.
 */
export function lineForFragment(markdown: string, fragment: string): number | undefined {
  const lines = markdown.split(/\r?\n/);
  const anchor = new RegExp(`\\b(?:id|name)\\s*=\\s*["']${escapeRegExp(fragment)}["']`);
  const wanted = fragment.toLowerCase();
  const seen = new Map<string, number>();
  let headingLine: number | undefined;
  let fence: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fenceMatch = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    if (fenceMatch) {
      if (!fence) {
        fence = fenceMatch[1];
      } else if (fenceMatch[1][0] === fence[0] && fenceMatch[1].length >= fence.length) {
        fence = undefined;
      }
      continue;
    }
    if (fence) {
      continue;
    }
    if (anchor.test(line)) {
      return i;
    }
    const heading = /^\s{0,3}#{1,6}\s+(.*)$/.exec(line);
    if (heading && headingLine === undefined) {
      const base = slugify(headingText(heading[1]));
      const count = seen.get(base) ?? 0;
      seen.set(base, count + 1);
      const slug = count === 0 ? base : `${base}-${count}`;
      if (slug === wanted) {
        headingLine = i;
      }
    }
  }
  return headingLine;
}
