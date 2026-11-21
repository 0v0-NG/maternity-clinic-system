'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, PlusCircle, Calendar, User } from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Home', href: '/dashboard', icon: Home, matchExact: true },
  { label: 'Book', href: '/book', icon: PlusCircle, matchExact: false },
  { label: 'Appointments', href: '/appointments', icon: Calendar, matchExact: false },
  { label: 'Profile', href: '/profile', icon: User, matchExact: false },
];

export default function MotherBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Bottom Navigation"
      className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-border shadow-md"
    >
      <div className="max-w-md mx-auto flex items-center justify-around h-16 px-2">
        {NAV_ITEMS.map(({ label, href, icon: Icon, matchExact }) => {
          const isActive = matchExact
            ? pathname === href
            : pathname === href || pathname.startsWith(`${href}/`);

          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                isActive
                  ? 'text-primary-500 font-bold'
                  : 'text-body-muted hover:text-primary-600 font-medium'
              }`}
            >
              <Icon size={22} strokeWidth={isActive ? 2.4 : 1.8} />
              <span className="text-[11px] mt-0.5">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
