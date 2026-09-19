import { collectGridBuilderOsSnapshot } from '../lib/grid/ops/grid-builder-os';

function main(): void {
  const args = process.argv.slice(2);
  const command = args[0] ?? 'status';
  const json = args.includes('--json');

  if (command !== 'status') {
    throw new Error('Usage: grid-builder-os status [--json]');
  }

  const snapshot = collectGridBuilderOsSnapshot({ cwd: process.cwd() });
  if (json) {
    process.stdout.write(JSON.stringify(snapshot, null, 2) + '\n');
    return;
  }

  const lines = [
    'THE GRID — BUILDER OS',
    `Creation progress: ${snapshot.overall.percent}% (${snapshot.overall.completed}/${snapshot.overall.total} integrated)`,
    `Playable loop: ${snapshot.playableLoop.score}/100 (${snapshot.playableLoop.status})`,
    `Builders: ${snapshot.workers.length}`,
    `Run state: ${snapshot.run.status} — ${snapshot.run.message}`,
    '',
  ];

  for (const worker of snapshot.workers) {
    lines.push(`${worker.role}: ${worker.state} — ${worker.task}`);
  }

  if (snapshot.needsYou.length) {
    lines.push('', 'NEEDS YOU:');
    for (const item of snapshot.needsYou) lines.push(`- ${item}`);
  }

  process.stdout.write(lines.join('\n') + '\n');
}

try {
  main();
} catch (error) {
  process.stderr.write((error instanceof Error ? error.message : String(error)) + '\n');
  process.exitCode = 1;
}

