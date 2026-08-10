import Image from 'next/image';
import Link from 'next/link';
import { Eye, Route } from 'lucide-react';
import { cqImages } from '@/lib/marketing-assets';

export default function CinematicFooter() {
  return (
    <footer className="cq-footer">
      <div>
        <Image src={cqImages.badge} alt="Canton Quests badge" width={72} height={72} />
        <p>Canton Quests Event Factory Engine</p>
      </div>
      <div className="cq-footer-links">
        <Link href="/watch">
          <Eye size={15} aria-hidden="true" />
          Watch Live
        </Link>
        <Link href="/qr/AURA-BREW-2026">
          <Route size={15} aria-hidden="true" />
          Test QR
        </Link>
        <Link href="/admin">Game Master</Link>
      </div>
    </footer>
  );
}
