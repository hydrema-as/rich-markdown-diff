import * as vscode from "vscode";
import type MarkdownIt = require("markdown-it");

/** A markdown-it plugin as an extension contributes it to the Markdown preview. */
export type MarkdownItPlugin = (md: MarkdownIt) => unknown;

/** The setting that names the extensions whose preview contributions the diff uses. */
const SETTING = "previewExtensions";

/**
 * The installed extensions the `previewExtensions` setting names, in its
 * order. An extension that is not installed is skipped.
 */
export function getPreviewExtensions(): vscode.Extension<unknown>[] {
  const ids = vscode.workspace
    .getConfiguration("rich-markdown-diff")
    .get<string[]>(SETTING, []);
  return (Array.isArray(ids) ? ids : [])
    .filter((id): id is string => typeof id === "string")
    .map((id) => vscode.extensions.getExtension(id))
    .filter((ext): ext is vscode.Extension<unknown> => !!ext);
}

function contributedPaths(
  ext: vscode.Extension<unknown>,
  point: "markdown.previewStyles" | "markdown.previewScripts",
): vscode.Uri[] {
  const paths = ext.packageJSON?.contributes?.[point];
  return Array.isArray(paths)
    ? paths
        .filter((p): p is string => typeof p === "string")
        .map((p) => vscode.Uri.joinPath(ext.extensionUri, p))
    : [];
}

/**
 * The style sheets and scripts the extensions contribute to the Markdown
 * preview, which the diff page loads too.
 */
export function getPreviewAssets(extensions: vscode.Extension<unknown>[]): {
  styles: vscode.Uri[];
  scripts: vscode.Uri[];
} {
  return {
    styles: extensions.flatMap((ext) =>
      contributedPaths(ext, "markdown.previewStyles"),
    ),
    scripts: extensions.flatMap((ext) =>
      contributedPaths(ext, "markdown.previewScripts"),
    ),
  };
}

/**
 * The markdown-it plugins the extensions contribute to the Markdown preview:
 * each one that declares `markdown.markdownItPlugins` is activated, and its
 * exported `extendMarkdownIt` taken, as the built-in preview does. One that
 * fails to activate is left out.
 */
export async function getPreviewPlugins(
  extensions: vscode.Extension<unknown>[],
): Promise<MarkdownItPlugin[]> {
  const plugins: MarkdownItPlugin[] = [];
  for (const ext of extensions) {
    if (!ext.packageJSON?.contributes?.["markdown.markdownItPlugins"]) {
      continue;
    }
    try {
      const exports = (ext.isActive ? ext.exports : await ext.activate()) as
        | { extendMarkdownIt?: unknown }
        | undefined;
      if (typeof exports?.extendMarkdownIt === "function") {
        plugins.push(exports.extendMarkdownIt as MarkdownItPlugin);
      }
    } catch (error) {
      console.warn(`Markdown preview plugin of ${ext.id} not loaded:`, error);
    }
  }
  return plugins;
}
