import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const FORBIDDEN_BROWSER_GLOBALS = new Set([
  'window',
  'document',
  'navigator',
  'localStorage',
  'sessionStorage',
]);

function typeScriptFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...typeScriptFiles(full));
    else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) files.push(full);
  }
  return files.sort();
}

function browserGlobalsUsed(filePath: string): string[] {
  const source = ts.createSourceFile(
    filePath,
    fs.readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const hits = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && FORBIDDEN_BROWSER_GLOBALS.has(node.text)) hits.add(node.text);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return [...hits].sort();
}

describe('GRID platform architecture boundary', () => {
  it('keeps browser globals out of shared core and server game logic', () => {
    const roots = [
      path.join(process.cwd(), 'lib/grid/core'),
      path.join(process.cwd(), 'lib/grid/server'),
    ];
    const violations = roots.flatMap(typeScriptFiles)
      .map((filePath) => ({
        filePath: path.relative(process.cwd(), filePath),
        globals: browserGlobalsUsed(filePath),
      }))
      .filter((entry) => entry.globals.length > 0);
    expect(violations).toEqual([]);
  });
});
