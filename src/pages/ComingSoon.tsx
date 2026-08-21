import { useLocation } from 'react-router-dom';
import { Construction } from 'lucide-react';

export default function ComingSoon() {
  const location = useLocation();
  const moduleName = location.pathname.split('/')[1];
  const formattedName = moduleName
    ? moduleName.charAt(0).toUpperCase() + moduleName.slice(1)
    : 'Module';

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mb-4">
        <Construction className="h-8 w-8 text-amber-500" />
      </div>
      <h2 className="text-lg font-semibold text-slate-900 mb-1">{formattedName}</h2>
      <p className="text-sm text-slate-500 text-center max-w-sm">
        Coming in next step. This module is part of the planned roadmap and will be built
        on top of the existing database foundation.
      </p>
    </div>
  );
}
