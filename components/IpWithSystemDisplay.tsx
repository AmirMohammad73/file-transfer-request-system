import React, { useState, useEffect } from 'react';
import { backupResourcesAPI } from '../utils/api';

interface IpWithSystemDisplayProps {
  ip: string;
  showWarning?: boolean;
  className?: string;
  compact?: boolean;
}

const IpWithSystemDisplay: React.FC<IpWithSystemDisplayProps> = ({
  ip,
  showWarning = true,
  className = '',
  compact = false,
}) => {
  const [systemInfo, setSystemInfo] = useState<{
    systemName: string | null;
    contName: string | null;
    registered: boolean;
    loading: boolean;
  }>({
    systemName: null,
    contName: null,
    registered: false,
    loading: false,
  });

  useEffect(() => {
    const fetchSystemInfo = async () => {
      if (!ip || !ip.trim()) {
        setSystemInfo({
          systemName: null,
          contName: null,
          registered: false,
          loading: false,
        });
        return;
      }

      try {
        setSystemInfo(prev => ({ ...prev, loading: true }));
        const info = await backupResourcesAPI.getSystemByIp(ip.trim());
        
        setSystemInfo({
          systemName: info.systemName,
          contName: info.contName,
          registered: info.registered,
          loading: false,
        });
      } catch (error) {
        console.error('Error fetching system info:', error);
        setSystemInfo({
          systemName: null,
          contName: null,
          registered: false,
          loading: false,
        });
      }
    };

    fetchSystemInfo();
  }, [ip]);

  if (!ip || !ip.trim()) {
    return null;
  }

  if (systemInfo.loading) {
    return (
      <div className={`flex items-center gap-2 text-sm ${className}`}>
        <span className="text-gray-600 font-mono">{ip}</span>
        <span className="text-gray-400 text-xs">در حال بررسی...</span>
      </div>
    );
  }

  if (!systemInfo.registered) {
    return (
      <div className={`flex flex-col gap-1 ${className}`}>
        <div className="flex items-center gap-2">
          <span className="text-gray-600 font-mono">{ip}</span>
          {showWarning && (
            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-md">
              ⚠️ ثبت نشده
            </span>
          )}
        </div>
        {showWarning && !compact && (
          <div className="text-xs text-yellow-600 bg-yellow-50 p-2 rounded-md border border-yellow-200">
            <strong>هشدار:</strong> این آدرس IP در شناسنامه سامانه‌ها ثبت نشده است.
            ممکن است درخواست شما توسط واحد امنیت شبکه رد شود.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="flex items-center gap-2">
        <span className="text-gray-600 font-mono">{ip}</span>
        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-md">
          ✅ {systemInfo.systemName || 'سامانه'}
        </span>
      </div>
      {!compact && systemInfo.contName && (
        <div className="text-xs text-gray-600">
          پیمانکار: {systemInfo.contName}
        </div>
      )}
    </div>
  );
};

export default IpWithSystemDisplay;