import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

interface MobileStartBarProps {
  href: string;
  label?: string;
  eyebrow?: string;
}

export default function MobileStartBar({
  href,
  label = 'Start Playing',
  eyebrow = 'Ready in 60 seconds',
}: MobileStartBarProps) {
  return (
    <div className="cq-mobile-start" aria-label="Quick start">
      <div>
        <span>{eyebrow}</span>
        <strong>{label}</strong>
      </div>
      <Link href={href}>
        {label}
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </div>
  );
}
