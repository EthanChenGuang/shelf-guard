import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { Language} from '../types';
import { I18N } from '../lib/constants';

interface OfflineIndicatorProps {
  lang: Language;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ lang }) => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const t = I18N[lang];

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed bottom-24 left-4 z-50 flex items-center gap-2 rounded-full bg-amber-600/90 backdrop-blur-md px-3 py-1.5 text-xs font-medium text-white shadow-lg border border-amber-400/30">
      <WifiOff className="w-3.5 h-3.5" />
      <span>{t.offlineMode}</span>
    </div>
  );
};
