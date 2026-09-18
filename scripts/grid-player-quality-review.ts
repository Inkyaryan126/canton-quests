import fs from 'node:fs';
import path from 'node:path';

export type GridPlayerQualityCode =
  | 'button-missing-type'
  | 'button-touch-target'
  | 'icon-only-control-name'
  | 'image-missing-alt'
  | 'background-loop-unthrottled';

export interface GridPlayerQualityIssue {
  code: GridPlayerQualityCode;
  file: string;
  message: string;
}

export interface GridPlayerQualityReport {
  ok: boolean;
  surfaceCount: number;
  issues: GridPlayerQualityIssue[];
}

function walk(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(root, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

export function discoverGridPlayerSurfaces(repoRoot: string): string[] {
  const gridRoot = path.join(repoRoot, 'app/grid');
  return walk(gridRoot)
    .filter((file) => /(?:-client|grid-world-client)\.tsx$/.test(path.basename(file)))
    .map((file) => path.relative(repoRoot, file))
    .sort();
}

function lineNumber(source: string, index: number): number {
  return source.slice(0, index).split('\n').length;
}

function stripJsx(value: string): string {
  return value
    .replace(/<[^>]+>/gs, ' ')
    .replace(/\{[^{}]*\}/gs, ' ')
    .replace(/&[a-z0-9#]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function openingTagEnd(source: string, start: number): number {
  let quote: string | null = null;
  let braceDepth = 0;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    const previous = source[index - 1];
    if (quote) {
      if (char === quote && previous !== '\\') quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') { braceDepth += 1; continue; }
    if (char === '}') { braceDepth = Math.max(0, braceDepth - 1); continue; }
    if (char === '>' && braceDepth === 0) return index;
  }
  return -1;
}

function buttonBlocks(source: string): Array<{ opening: string; body: string; index: number }> {
  const blocks: Array<{ opening: string; body: string; index: number }> = [];
  let cursor = 0;
  while (cursor < source.length) {
    const start = source.indexOf('<button', cursor);
    if (start === -1) break;
    const openEnd = openingTagEnd(source, start);
    if (openEnd === -1) break;
    const close = source.indexOf('</button>', openEnd + 1);
    if (close === -1) break;
    blocks.push({
      opening: source.slice(start, openEnd + 1),
      body: source.slice(openEnd + 1, close),
      index: start,
    });
    cursor = close + '</button>'.length;
  }
  return blocks;
}

function hasTouchTarget(openingTag: string): boolean {
  const classValue = openingTag.match(/className\s*=\s*["'`]([^"'`]*)["'`]/s)?.[1] ?? '';
  return /\bmin-h-(?:10|11|12|14|16)\b/.test(classValue)
    || /\bh-(?:10|11|12|14|16)\b/.test(classValue)
    || /\bmin-w-(?:10|11|12|14|16)\b/.test(classValue)
    || /\bw-(?:10|11|12|14|16)\b/.test(classValue);
}

function reviewSurface(repoRoot: string, relativeFile: string): GridPlayerQualityIssue[] {
  const source = fs.readFileSync(path.join(repoRoot, relativeFile), 'utf8');
  const issues: GridPlayerQualityIssue[] = [];

  for (const block of buttonBlocks(source)) {
    const opening = block.opening;
    const body = block.body;
    const line = lineNumber(source, block.index);
    if (!/\btype\s*=\s*["'](?:button|submit|reset)["']/.test(opening)) {
      issues.push({
        code: 'button-missing-type',
        file: relativeFile,
        message: `Button near line ${line} must declare an explicit type.`,
      });
    }
    if (!hasTouchTarget(opening)) {
      issues.push({
        code: 'button-touch-target',
        file: relativeFile,
        message: `Button near line ${line} needs an explicit >=40px Tailwind touch-size guardrail (h/min-h/w/min-w-10 or larger).`,
      });
    }

    const visibleText = stripJsx(body);
    const hasAccessibleName = /\baria-label\s*=|\baria-labelledby\s*=|\btitle\s*=/.test(opening);
    const containsOnlyComponentMarkup =
      visibleText.length === 0 &&
      /<[A-Z][A-Za-z0-9]*/.test(body) &&
      !/\{[^}]+\}/s.test(body);
    if (containsOnlyComponentMarkup && !hasAccessibleName) {
      issues.push({
        code: 'icon-only-control-name',
        file: relativeFile,
        message: `Icon-only button near line ${line} needs aria-label/aria-labelledby.`,
      });
    }
  }

  for (const match of source.matchAll(/<img\b([\s\S]*?)\/?\s*>/gi)) {
    const opening = match[0];
    if (!/\balt\s*=/.test(opening)) {
      issues.push({
        code: 'image-missing-alt',
        file: relativeFile,
        message: `Image near line ${lineNumber(source, match.index ?? 0)} is missing alt text.`,
      });
    }
  }

  const hasBackgroundLoop = /\bsetInterval\s*\(|\brequestAnimationFrame\s*\(/.test(source);
  const visibilityAware = /document\.hidden|visibilitychange/.test(source);
  if (hasBackgroundLoop && !visibilityAware) {
    issues.push({
      code: 'background-loop-unthrottled',
      file: relativeFile,
      message: 'Background polling/animation loop must pause or throttle when the document is hidden.',
    });
  }

  return issues;
}

export function reviewGridPlayerQuality(repoRoot: string): GridPlayerQualityReport {
  const surfaces = discoverGridPlayerSurfaces(repoRoot);
  const issues = surfaces.flatMap((file) => reviewSurface(repoRoot, file));
  return { ok: issues.length === 0, surfaceCount: surfaces.length, issues };
}

function main(): void {
  const repoRoot = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
  const report = reviewGridPlayerQuality(repoRoot);
  console.log(`Grid player quality review: ${report.surfaceCount} private client surfaces checked`);
  if (report.ok) {
    console.log('GRID PLAYER QUALITY REVIEW OK');
    return;
  }
  for (const issue of report.issues) {
    console.error(`${issue.code}: ${issue.file}: ${issue.message}`);
  }
  process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) main();
