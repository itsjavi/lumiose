// Downloads and file names.

export const slug = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "song";

export function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Driver code as a file: the text with a final newline. */
export const codeFile = (text: string): string => (text.endsWith("\n") ? text : `${text}\n`);

/** Downloads driver code as `<title>.asm`, the format Import file reads. */
export function exportCode(text: string, title: string): string {
  const name = `${slug(title)}.asm`;
  download(new Blob([codeFile(text)], { type: "text/plain" }), name);
  return name;
}

/** Copies driver code to the clipboard; resolves false when the browser refuses. */
export async function copyCode(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(codeFile(text));
    return true;
  } catch {
    return false;
  }
}
