import { redirect } from 'next/navigation';

/** The standalone Grid game is live at its own verified production origin. */
export default function GridEntryPage() {
  redirect('https://the-grid-mocha.vercel.app/grid');
}
