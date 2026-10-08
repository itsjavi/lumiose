// Classes defined in `<style global>` blocks, indexed per file across the workspace. Global
// blocks apply app-wide (spec §4.6.1), so their classes are offered and defined in every file of
// the same project, e.g. the root `_layout.stsx`'s utility classes in any component.

import type { ScanResult } from "@lumen/compiler";
import type { Range } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { selectorClasses } from "./classes.ts";
import { virtualCss } from "./stsx.ts";
import { fileKey, pathToUri } from "./workspace.ts";

export interface GlobalClass {
  name: string;
  uri: string;
  /** Absolute path of the defining file. */
  path: string;
  /** The class name, without the dot. */
  range: Range;
}

interface IndexedFile {
  root: string;
  classes: GlobalClass[];
}

export class GlobalClassIndex {
  readonly #files = new Map<string, IndexedFile>();

  /** Indexes (or re-indexes) one `.stsx` file of the project at `root`. */
  update(path: string, root: string, text: string, scan: ScanResult, uri = pathToUri(path)): void {
    const blocks = scan.blocks.filter((block) => block.global);
    if (blocks.length === 0) {
      this.#files.delete(fileKey(path));
      return;
    }
    const document = TextDocument.create(uri, "stsx", 0, text);
    const classes = blocks.flatMap((block) =>
      selectorClasses(virtualCss(text, block), block.content.start, block.content.end).map(
        (occurrence): GlobalClass => ({
          name: occurrence.name,
          uri,
          path,
          range: {
            start: document.positionAt(occurrence.start),
            end: document.positionAt(occurrence.end),
          },
        }),
      ),
    );
    this.#files.set(fileKey(path), { root: fileKey(root), classes });
  }

  delete(path: string): void {
    this.#files.delete(fileKey(path));
  }

  /** Global classes defined in the other files of the project at `root`. */
  classes(root: string, except: string): GlobalClass[] {
    const rootKey = fileKey(root);
    const exceptKey = fileKey(except);
    const found: GlobalClass[] = [];
    for (const [key, file] of this.#files) {
      if (file.root === rootKey && key !== exceptKey) found.push(...file.classes);
    }
    return found;
  }
}
