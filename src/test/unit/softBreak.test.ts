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
import { removeEmptyDiffTags } from "../../markdown/structuralDiff";

// The words each pane shows: the right pane hides <del>, the left hides <ins>.
function paneWords(html: string, hidden: "del" | "ins"): string[] {
  return html
    .replace(new RegExp(`<${hidden}\\b[^>]*>[\\s\\S]*?</${hidden}>`, "g"), "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function words(markdown: string): string[] {
  return markdown.split(/\s+/).filter(Boolean);
}

describe("Soft line breaks", () => {
  const provider = new MarkdownDiffProvider();

  it("keeps the words apart when a paragraph is re-wrapped", () => {
    const oldMd =
      "Flushing runs whenever its conditions hold, and the only thing it changes in the cab is a small amount of\n" +
      "propulsion flow the operator did not ask for. It names this function.\n";
    const newMd =
      "Flushing runs whenever its conditions hold. Its only effect in the cab is a small\n" +
      "propulsion flow the operator did not ask for. It names this\n" +
      "function.\n";

    const { html } = provider.computeDiff(oldMd, newMd);

    assert.deepStrictEqual(paneWords(html, "del"), words(newMd));
    assert.deepStrictEqual(paneWords(html, "ins"), words(oldMd));
  });

  it("keeps the words apart when only a word next to a line break changes", () => {
    const oldMd = "The opposite drive pedal disables flushing while it is held. It\nleaves the latch unchanged.\n";
    const newMd = "The opposite drive pedal disables flushing while it is held. It therefore\nleaves the latch unchanged.\n";

    const { html } = provider.computeDiff(oldMd, newMd);

    assert.deepStrictEqual(paneWords(html, "del"), words(newMd));
    assert.deepStrictEqual(paneWords(html, "ins"), words(oldMd));
  });

  it("keeps the words apart when a line break moves to where a space was", () => {
    const oldMd = "It names this function\nand nothing else.\n";
    const newMd = "It names this\nfunction and nothing else.\n";

    const { html } = provider.computeDiff(oldMd, newMd);

    assert.deepStrictEqual(paneWords(html, "del"), words(newMd));
    assert.deepStrictEqual(paneWords(html, "ins"), words(oldMd));
  });

  it("keeps the line break between two links when the second is added", () => {
    const { html } = provider.computeDiff(
      "[Visit GitHub](https://github.com)\n",
      "[Visit GitHub](https://github.com)\n[Visit VS Code](https://code.visualstudio.com)\n",
    );

    assert.deepStrictEqual(paneWords(html, "del"), ["Visit", "GitHub", "Visit", "VS", "Code"]);
  });

  it("drops whitespace-only diff tags between blocks, keeps them between words", () => {
    assert.strictEqual(
      removeEmptyDiffTags('<p>a</p><ins class="diffins">\n</ins><p>b</p>'),
      "<p>a</p><p>b</p>",
    );
    assert.strictEqual(
      removeEmptyDiffTags('</ins><ins class="diffins">\n</ins><ins class="diffins diff-block"><dd>b</dd></ins>'),
      '</ins><ins class="diffins diff-block"><dd>b</dd></ins>',
    );
    assert.strictEqual(
      removeEmptyDiffTags('<p>small<ins class="diffmod">\n</ins>flow</p>'),
      '<p>small<ins class="diffmod">\n</ins>flow</p>',
    );
    assert.strictEqual(
      removeEmptyDiffTags('<p>this<del class="diffmod">&nbsp;</del><ins class="diffmod">\n</ins>function</p>'),
      "<p>this function</p>",
    );
    assert.strictEqual(removeEmptyDiffTags('<p>a<ins class="diffins"></ins>b</p>'), "<p>ab</p>");
  });
});
