/**
 * Manual lock inspection/recovery — for when Dustin wants to intervene
 * directly instead of waiting for the supervisor's own stale-lock recovery.
 *
 *   npm run boardroom:lock -- status
 *   npm run boardroom:lock -- recover [--force --reason "..."]
 */
import { getLock, assessStaleLock, recoverStaleLock } from '../lib/boardroom/lock';

function main() {
  const [cmd, ...rest] = process.argv.slice(2);

  if (cmd === 'status' || !cmd) {
    const lock = getLock();
    if (!lock) {
      console.log('No write lock held.');
      return;
    }
    const assessment = assessStaleLock();
    console.log(JSON.stringify({ lock, holderPidAlive: assessment?.holderPidAlive, ageMs: assessment?.ageMs }, null, 2));
    return;
  }

  if (cmd === 'recover') {
    const force = rest.includes('--force');
    const reasonIdx = rest.indexOf('--reason');
    const reason = reasonIdx !== -1 ? rest[reasonIdx + 1] : undefined;
    const result = recoverStaleLock({ force, reason });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.error(`Unknown command: ${cmd}. Use "status" or "recover".`);
  process.exit(1);
}

main();
