/**
 * Canton Quests Boardroom V2 — crash-safe file I/O.
 *
 * Every runtime-state write (lock, budget, task records) goes through
 * writeFileAtomic so a crash mid-write can never leave a half-written,
 * corrupted JSON file behind: the new content is written to a sibling
 * `.tmp` file first, then moved into place with fs.renameSync, which is
 * atomic on POSIX filesystems (a single directory-entry swap — readers
 * only ever see the old complete file or the new complete file, never a
 * partial one).
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function writeFileAtomic(filePath: string, contents: string): void {
  ensureDir(path.dirname(filePath));
  const tmpPath = `${filePath}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  fs.writeFileSync(tmpPath, contents, 'utf8');
  fs.renameSync(tmpPath, filePath);
}

export function writeJsonAtomic(filePath: string, value: unknown): void {
  writeFileAtomic(filePath, JSON.stringify(value, null, 2) + '\n');
}

export function readJsonIfExists<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf8');
  if (!raw.trim()) return null;
  return JSON.parse(raw) as T;
}

export function removeIfExists(filePath: string): void {
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

export function listJsonFiles(dirPath: string): string[] {
  if (!fs.existsSync(dirPath)) return [];
  return fs
    .readdirSync(dirPath)
    .filter((f) => f.endsWith('.json'))
    .map((f) => path.join(dirPath, f));
}

/**
 * Appends a line to a log file, creating parent directories as needed.
 * Not atomic in the rename sense (appends are inherently sequential) but
 * each append is a single write() syscall for reasonably small lines.
 */
export function appendLog(filePath: string, line: string): void {
  ensureDir(path.dirname(filePath));
  fs.appendFileSync(filePath, line.endsWith('\n') ? line : line + '\n', 'utf8');
}
