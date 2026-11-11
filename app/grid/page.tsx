import { redirect } from 'next/navigation';

/** Legacy Canton Quests entry stays as a direct redirect so old bookmarks still work. */
export default function GridEntryPage() {
  redirect('https://dominatethegrid.com');
}
