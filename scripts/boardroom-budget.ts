/**
 * Astra budget: self-report allowance, inspect state, and confirm a reset
 * credit AFTER actually redeeming it manually. Redemption itself is never
 * automated — see boardroom/BOARDROOM.md honesty rule 3.
 *
 *   npm run boardroom:budget -- show
 *   npm run boardroom:budget -- self-report 62
 *   npm run boardroom:budget -- confirm-reset-1
 *   npm run boardroom:budget -- confirm-reset-2
 */
import { getBudgetState, selfReportAllowance, requestReset, confirmResetRedeemed } from '../lib/boardroom/budget';

function main() {
  const [cmd, arg] = process.argv.slice(2);

  if (cmd === 'show' || !cmd) {
    console.log(JSON.stringify(getBudgetState(), null, 2));
    return;
  }

  if (cmd === 'self-report') {
    const pct = Number(arg);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      console.error('Usage: boardroom:budget self-report <0-100>');
      process.exit(1);
    }
    const state = selfReportAllowance(pct, 'DUSTIN');
    console.log(JSON.stringify(state, null, 2));
    return;
  }

  if (cmd === 'request-reset-1' || cmd === 'request-reset-2') {
    const which = cmd.endsWith('1') ? 1 : 2;
    console.log(requestReset(which).message);
    return;
  }

  if (cmd === 'confirm-reset-1' || cmd === 'confirm-reset-2') {
    const which = cmd.endsWith('1') ? 1 : 2;
    try {
      const state = confirmResetRedeemed(which);
      console.log(`Reset #${which} confirmed redeemed.`);
      console.log(JSON.stringify(state, null, 2));
    } catch (err: any) {
      console.error(err.message);
      process.exit(1);
    }
    return;
  }

  console.error('Usage: boardroom:budget -- show | self-report <pct> | request-reset-1 | request-reset-2 | confirm-reset-1 | confirm-reset-2');
  process.exit(1);
}

main();
