import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import JSZip from "jszip";

export class FileBundle {
  private readonly files = new Map<string, string | Buffer>();

  addText(path: string, contents: string): void {
    this.files.set(normalizePath(path), contents);
  }

  addBuffer(path: string, contents: Buffer): void {
    this.files.set(normalizePath(path), contents);
  }

  async addDirectory(root: string, targetPrefix = ""): Promise<void> {
    await addDirectoryRecursive(this, root, root, targetPrefix);
  }

  async toBase64Zip(): Promise<string> {
    const zip = new JSZip();
    for (const [path, contents] of this.files) {
      zip.file(path, contents);
    }
    return zip.generateAsync({ type: "base64", compression: "DEFLATE" });
  }
}

async function addDirectoryRecursive(bundle: FileBundle, root: string, current: string, targetPrefix: string): Promise<void> {
  const entries = await readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(current, entry.name);
    if (entry.isDirectory()) {
      await addDirectoryRecursive(bundle, root, fullPath, targetPrefix);
      continue;
    }
    if (!entry.isFile()) continue;
    const relPath = normalizePath(join(targetPrefix, relative(root, fullPath)));
    bundle.addBuffer(relPath, await readFile(fullPath));
  }
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\/+/, "");
}
