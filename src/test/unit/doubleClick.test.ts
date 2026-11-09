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
import { MarkdownDiffProvider } from "../../markdownDiff";

describe("Double Click Navigation", () => {
  let provider: MarkdownDiffProvider;

  before(async () => {
    provider = new MarkdownDiffProvider();
    await provider.waitForReady();
  });

  it("should inject data-line attributes into paragraphs", () => {
    const md = "Line 1\n\nLine 3";
    // data-line attributes are injected by markdown-it at render time,
    // but stripped before htmldiff to prevent block element fragmentation
    // (e.g. identical headings at different source lines being split into
    // <del>/<ins> pairs). The diff output should NOT contain data-line.

    const { html: diff } = provider.computeDiff(md, md);
    assert.ok(
      diff.includes("data-line="),
      "Diff output should contain data-line attributes (preserved for Quick Edit)",
    );
  });

  it("should inject data-line attributes into headers", () => {
    const md = "# Header 1";
    const { html: diff } = provider.computeDiff(md, md);
    assert.ok(
      diff.includes("data-line="),
      "Header diff should contain data-line attributes",
    );
  });

  it("should inject data-line attributes into lists", () => {
    const md = "- Item 1\n- Item 2";
    const { html: diff } = provider.computeDiff(md, md);
    assert.ok(
      diff.includes("data-line="),
      "List diff should contain data-line attributes",
    );
  });

  it("should inject data-line attributes into definition lists", () => {
    const md = "Term 1\n: Definition 1";
    const { html: diff } = provider.computeDiff(md, md);
    assert.ok(
      diff.includes("data-line="),
      "Definition List diff should contain data-line attributes",
    );
  });
});

describe("Double click after a Quick Edit click", () => {
  it("takes back the Quick Edit the first click started and opens the source", () => {
    const webviewContent = new MarkdownDiffProvider().getWebviewContent(
      "<p data-line=\"0\">a</p>",
      "katex.css",
      "mermaid.js",
      "hljs-light.css",
      "hljs-dark.css",
    );
    const dblclick = webviewContent.indexOf("document.body.addEventListener('dblclick'");
    const takeBack = webviewContent.indexOf("BlockEditor.close();", dblclick);
    const overlayGuard = webviewContent.indexOf("e.target.closest('.block-editor-overlay')", dblclick);
    assert.ok(dblclick > -1 && takeBack > dblclick, "the double-click handler closes the Quick Edit");
    assert.ok(takeBack < overlayGuard, "before the guard that ignores clicks inside the Quick Edit overlay");
    assert.ok(
      webviewContent.includes("lastQuickEdit = { at: performance.now(), lineStart };"),
      "a single click records the Quick Edit it started",
    );
  });
});
