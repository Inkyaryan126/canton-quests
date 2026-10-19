import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/** The standalone Grid game is live at its own verified production origin. */
export default function GridEntryPage() {
  redirect('https://grid.cantonquests.com/grid');
}
