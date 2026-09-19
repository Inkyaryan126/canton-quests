export function isGridContractRewardSettlementEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.GRID_CONTRACT_REWARD_SETTLEMENT_ENABLED === '1';
}
