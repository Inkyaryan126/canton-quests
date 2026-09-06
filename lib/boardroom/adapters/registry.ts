import { codexAdapter } from './codexAdapter';
import { claudeAdapter } from './claudeAdapter';
import { agyAdapter } from './agyAdapter';
import type { AgentAdapter } from './types';
import type { AgentName } from '../types';

export const ADAPTERS: Record<AgentName, AgentAdapter> = {
  ASTRA: codexAdapter,
  CLAUDE: claudeAdapter,
  AGY: agyAdapter,
};

export function getAdapter(agent: AgentName): AgentAdapter {
  return ADAPTERS[agent];
}
