export const GAME_MASTER_DISPLAY_NAME = 'Mr. Consigliere';

export const GAME_MASTER_GREETINGS = [
  'Good evening, Mr. Consigliere. Canton awaits your direction.',
  'Welcome back, Mr. Consigliere. The city board is lit.',
  'Good evening, Mr. Consigliere. The field is ready for your signal.',
];

export function getGameMasterGreeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning, Mr. Consigliere. Canton is coming online.';
  if (hour < 17) return 'Good afternoon, Mr. Consigliere. The operation is standing by.';
  return GAME_MASTER_GREETINGS[0];
}
