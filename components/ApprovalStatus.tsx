import React from 'react';
import { Request, Role, Status, RequestType } from '../types';
import { ROLE_HIERARCHY, ROLE_NAMES } from '../constants';
import { CheckIcon } from './icons';

interface ApprovalStatusProps {
  request: Request;
}

// تابع برای فرمت کردن تاریخ و ساعت به فارسی
const formatPersianDateTime = (isoDate: string): string => {
  const date = new Date(isoDate);
  
  // تاریخ فارسی
  const persianDate = date.toLocaleDateString('fa-IR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  // ساعت و دقیقه
  const time = date.toLocaleTimeString('fa-IR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  
  return `${persianDate} - ${time}`;
};

const ApprovalStatus: React.FC<ApprovalStatusProps> = ({ request }) => {
  // Determine approval steps based on request type
  const approvalSteps = request.requestType === RequestType.BACKUP
    ? [Role.REQUESTER, Role.GROUP_LEAD, Role.NETWORK_HEAD, Role.NETWORK_ADMIN]
    : request.requestType === RequestType.VDI
    ? [Role.REQUESTER, Role.DEPUTY, Role.NETWORK_HEAD, Role.NETWORK_ADMIN]
    : [Role.REQUESTER, ...ROLE_HIERARCHY];

  const getStatusForStep = (step: Role) => {
    if (step === Role.REQUESTER) {
      return { 
        status: 'checked', 
        name: request.requesterName, 
        date: formatPersianDateTime(request.createdAt),
        rejectionReason: undefined
      };
    }

    const approval = request.approvalHistory.find(a => a.approverRole === step);
    if (approval) {
      return {
        status: approval.status === Status.APPROVED || approval.status === Status.COMPLETED ? 'checked' : 'rejected',
        name: approval.approverName,
        date: formatPersianDateTime(approval.date),
        rejectionReason: approval.rejectionReason
      };
    }
    
    if (request.currentApprover === step && request.status === Status.PENDING) {
      return { 
        status: 'pending', 
        name: ROLE_NAMES[step], 
        date: 'در انتظار تایید',
        rejectionReason: undefined
      };
    }

    return { 
      status: 'unchecked', 
      name: ROLE_NAMES[step], 
      date: ' ',
      rejectionReason: undefined
    };
  };

  return (
    <div className="mt-6 pt-5 border-t border-dashed border-gray-300">
      <div className="text-center font-bold mb-4 text-[#2c3e50] text-lg">مراحل تأیید</div>
      <div className={`grid ${approvalSteps.length === 4 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-5'} gap-4`}>
        {approvalSteps.map(step => {
          const { status, name, date, rejectionReason } = getStatusForStep(step);
          
          let bgColor = 'bg-gray-200';
          let borderColor = 'border-gray-300';
          let iconColor = 'text-gray-400';

          if (status === 'checked') {
            bgColor = 'bg-[#2ecc71]';
            borderColor = 'border-[#2ecc71]';
            iconColor = 'text-white';
          } else if (status === 'rejected') {
            bgColor = 'bg-[#e74c3c]';
            borderColor = 'border-[#e74c3c]';
            iconColor = 'text-white';
          } else if (status === 'pending') {
            borderColor = 'border-[#3498db]';
          }

          return (
            <div key={step} className="flex flex-col items-center">
              <div className="text-sm font-semibold mb-2 text-[#2c3e50] text-center">{ROLE_NAMES[step]}</div>
              <div className={`w-10 h-10 border-2 ${borderColor} ${bgColor} rounded-full flex items-center justify-center`}>
                {status === 'checked' && <CheckIcon className={`w-6 h-6 ${iconColor}`} />}
                {status === 'rejected' && <span className={`text-xl ${iconColor}`}>×</span>}
              </div>
              <div className="text-center text-xs text-gray-600 mt-2 leading-tight">
                <div className="font-medium">{name}</div>
                <div className="text-gray-500 text-[10px] leading-relaxed whitespace-pre-line">{date}</div>
                {/* نمایش دلیل رد در صورت وجود */}
                {rejectionReason && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-right max-w-[180px] mx-auto">
                    <div className="font-semibold text-red-700 mb-1 text-xs">دلیل رد:</div>
                    <div className="text-red-600 text-xs leading-relaxed break-words whitespace-pre-wrap">
                      {rejectionReason}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ApprovalStatus;