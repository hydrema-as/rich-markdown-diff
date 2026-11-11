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

import * as assert from "assert";
import { classifyLink, lineForFragment, lineRangeOf, slugify } from "../../markdown/links";
import { MarkdownDiffProvider } from "../../markdownDiff";

describe("Links", () => {
  it("classifies external, in-page and file links", () => {
    assert.deepStrictEqual(classifyLink("https://example.com/a#b"), { kind: "external", uri: "https://example.com/a#b" });
    assert.deepStrictEqual(classifyLink("mailto:a@b.c"), { kind: "external", uri: "mailto:a@b.c" });
    assert.deepStrictEqual(classifyLink("#req-flush-149--brake-threshold"), {
      kind: "anchor",
      fragment: "req-flush-149--brake-threshold",
    });
    assert.deepStrictEqual(classifyLink("/docs/interfaces/parameters.md"), {
      kind: "file",
      path: "/docs/interfaces/parameters.md",
      rootRelative: true,
      fragment: undefined,
    });
    assert.deepStrictEqual(classifyLink("/trunk/App/AP_Geschwindigkeit.c#L194"), {
      kind: "file",
      path: "/trunk/App/AP_Geschwindigkeit.c",
      rootRelative: true,
      fragment: "L194",
    });
    assert.deepStrictEqual(classifyLink("../x%20y.md?plain=1#par20"), {
      kind: "file",
      path: "../x y.md",
      rootRelative: false,
      fragment: "par20",
    });
  });

  it("follows no other scheme", () => {
    assert.strictEqual(classifyLink("javascript:alert(1)"), undefined);
    assert.strictEqual(classifyLink("command:workbench.action.quit"), undefined);
    assert.strictEqual(classifyLink("//evil.example/x"), undefined);
    assert.strictEqual(classifyLink(""), undefined);
  });

  it("reads line fragments", () => {
    assert.deepStrictEqual(lineRangeOf("L194"), { start: 193, end: 193 });
    assert.deepStrictEqual(lineRangeOf("L10-L12"), { start: 9, end: 11 });
    assert.deepStrictEqual(lineRangeOf("L10C2-L12C5"), { start: 9, end: 11 });
    assert.deepStrictEqual(lineRangeOf("L10-12"), { start: 9, end: 11 });
    assert.strictEqual(lineRangeOf("par20"), undefined);
  });

  it("slugs headings as the Markdown preview does", () => {
    assert.strictEqual(slugify("REQ-FLUSH-149 — Brake Threshold"), "req-flush-149--brake-threshold");
    assert.strictEqual(slugify("6.4 Enable Latch"), "64-enable-latch");
    assert.strictEqual(slugify("What's (new)?"), "whats-new");
    assert.strictEqual(
      slugify("REQ-PROP-125 — The flow→current curve is checked before use"),
      "req-prop-125--the-flowcurrent-curve-is-checked-before-use",
    );
    assert.strictEqual(slugify("snake_case Ünïcode 3.25"), "snake_case-ünïcode-325");
  });

  it("finds the line an anchor or a heading fragment points at", () => {
    const markdown = [
      "# Spec",
      "",
      "## Notes",
      "```",
      "## Brake Threshold",
      "```",
      "#### REQ-FLUSH-149 — Brake Threshold",
      "",
      "| PAR20 <a id=\"par20\"></a> | brake threshold |",
      "## Notes",
      "### [Linked](x.md) `code` heading",
    ].join("\n");
    assert.strictEqual(lineForFragment(markdown, "req-flush-149--brake-threshold"), 6);
    assert.strictEqual(lineForFragment(markdown, "par20"), 8);
    assert.strictEqual(lineForFragment(markdown, "notes"), 2);
    assert.strictEqual(lineForFragment(markdown, "notes-1"), 9);
    assert.strictEqual(lineForFragment(markdown, "brake-threshold"), undefined);
    assert.strictEqual(lineForFragment(markdown, "linked-code-heading"), 10);
  });

  it("slugs headings the same way in the webview, and follows links before Quick Edit sees the click", () => {
    const html = new MarkdownDiffProvider().getWebviewContent(
      "<p>x</p>", "", "m.js", "a.css", "b.css", "Clipboard", "f.md", "csp", {}, "", "",
    );
    const source = /function headingSlug\(text\) \{[\s\S]*?\n {8}\}/.exec(html);
    assert.ok(source, "the webview defines headingSlug");
    const headingSlug = new Function(`${source[0]}; return headingSlug;`)() as (t: string) => string;
    for (const heading of ["REQ-FLUSH-149 — Brake Threshold", "6.4 Enable Latch", "What's (new)? [x] a\\b `c`", "flow→current _x_ Ünï"]) {
      assert.strictEqual(headingSlug(heading), slugify(heading));
    }
    assert.match(html, /command: 'openLink'[\s\S]*?\}, true\);/);
  });
});
