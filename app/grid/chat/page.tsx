import type { Metadata } from 'next';
import GridChatClient from './grid-chat-client';

export const metadata: Metadata = {
  title: 'Grid Comms — Canton City 001',
  description: 'The Grid player communications network for Canton City 001.',
};

export default function GridChatPage() {
  return <GridChatClient />;
}
