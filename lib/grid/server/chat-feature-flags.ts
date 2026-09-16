export function isGridChatEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.GRID_CHAT_ENABLED === '1';
}
