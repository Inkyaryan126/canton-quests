import { verifyGridMapRuntime } from '../lib/grid/ops/map-runtime';

verifyGridMapRuntime()
  .then((report) => {
    console.log(JSON.stringify(report, null, 2));
    const disabled = report.cases.find((entry) => entry.case === 'disabled');
    const unauthenticated = report.cases.find((entry) => entry.case === 'unauthenticated');
    if (disabled?.status !== 404 || unauthenticated?.status !== 401) {
      throw new Error('Grid map runtime gate/error contract failed');
    }
    console.log('GRID MAP RUNTIME: GREEN — local gate and auth error behavior verified.');
  })
  .catch((error) => {
    console.error('GRID MAP RUNTIME: FAIL — ' + (error instanceof Error ? error.message : String(error)));
    process.exitCode = 1;
  });
