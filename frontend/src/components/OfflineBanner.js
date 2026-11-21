'use client';

import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

// Shows "You appear to be offline" when the browser reports no connection.
export default function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3">
      <div className="flex items-center gap-2">
        <WifiOff size={16} />
        <span className="text-sm font-semibold">You appear to be offline</span>
      </div>
    </div>
  );
}
