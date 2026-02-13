import React from 'react';
import { Request, Role, Status, RequestType } from '../types';
import { ROLE_HIERARCHY, ROLE_NAMES } from '../constants';
import { CheckIcon } from './icons';

interface ApprovalStatusProps {
  request: Request;
}

const formatPersianDateTime = (isoDate: string): string => {
  const date = new Date(isoDate);
  
  const persianDate = date.toLocaleDateString('fa-IR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const time = date.toLocaleTimeString('fa-IR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  
  return `${persianDate} - ${time}`;
};

const ApprovalStatus: React.FC<ApprovalStatusProps> = ({ request }) => {
  const approvalSteps = request.requestType === RequestType.BACKUP
    ? [Role.REQUESTER, Role.GROUP_LEAD, Role.NETWORK_HEAD, Role.NETWORK_ADMIN]
    : request.requestType === RequestType.VDI || request.requestType === 'VDI_OPEN'
    ? [Role.REQUESTER, Role.DEPUTY, Role.NETWORK_HEAD, Role.NETWORK_ADMIN]
    : request.requestType === RequestType.USB_PORT
    ? [Role.REQUESTER, Role.GROUP_LEAD, Role.DEPUTY, Role.NETWORK_HEAD, Role.NETWORK_USB_ADMIN]
    : [Role.REQUESTER, ...ROLE_HIERARCHY];

  const getStatusForStep = (step: Role) => {
    if (step === Role.REQUESTER) {
      return { 
        status: 'checked', 
        name: request.requesterName, 
        date: formatPersianDateTime(request.createdAt),
        rejectionReason: undefined,
        approvalNote: undefined,
        isFromPreviousVersion: false,
      };
    }

    const approval = request.approvalHistory.find(a => a.approverRole === step);
    if (approval) {
      return {
        status: approval.status === Status.APPROVED || approval.status === Status.COMPLETED ? 'checked' : 'rejected',
        name: approval.approverName,
        date: formatPersianDateTime(approval.date),
        rejectionReason: approval.rejectionReason,
        approvalNote: approval.approvalNote,
        isFromPreviousVersion: approval.isFromPreviousVersion || false,
      };
    }
    
    if (request.currentApprover === step && request.status === Status.PENDING) {
      return { 
        status: 'pending', 
        name: ROLE_NAMES[step], 
        date: 'در انتظار تایید',
        rejectionReason: undefined,
        approvalNote: undefined,
        isFromPreviousVersion: false,
      };
    }

    return { 
      status: 'unchecked', 
      name: ROLE_NAMES[step], 
      date: ' ',
      rejectionReason: undefined,
      approvalNote: undefined,
      isFromPreviousVersion: false,
    };
  };

  return (
    <div className="mt-6 pt-5 border-t border-dashed border-gray-300">
      {/* نمایش badge اگر درخواست اصلاح شده باشد */}
      {request.isRevised && request.revisionCount && request.revisionCount > 0 && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-300 rounded-lg">
          <div className="text-center font-semibold text-blue-800">
            🔄 این درخواست {request.revisionCount} بار اصلاح شده است
          </div>
        </div>
      )}

      <div className="text-center font-bold mb-4 text-[#2c3e50] text-lg">
        {request.isRevised ? 'مراحل تأیید (نسخه فعلی)' : 'مراحل تأیید'}
      </div>
      
      <div className={`grid ${approvalSteps.length === 4 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-5'} gap-4`}>
        {approvalSteps.map(step => {
          const { status, name, date, rejectionReason, approvalNote, isFromPreviousVersion } = getStatusForStep(step);
          
          let bgColor = 'bg-gray-200';
          let borderColor = 'border-gray-300';
          let iconColor = 'text-gray-400';
          let opacity = 'opacity-100';

          // اگر از نسخه قبلی باشد، خاکستری کم‌رنگ
          if (isFromPreviousVersion) {
            bgColor = 'bg-gray-300';
            borderColor = 'border-gray-400';
            iconColor = 'text-gray-500';
            opacity = 'opacity-50';
          } else if (status === 'checked') {
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
            <div key={step} className={`flex flex-col items-center ${opacity}`}>
              <div className="text-sm font-semibold mb-2 text-[#2c3e50] text-center">{ROLE_NAMES[step]}</div>
              <div className={`w-10 h-10 border-2 ${borderColor} ${bgColor} rounded-full flex items-center justify-center relative`}>
                {status === 'checked' && <CheckIcon className={`w-6 h-6 ${iconColor}`} />}
                {status === 'rejected' && <span className={`text-xl ${iconColor}`}>×</span>}
                {isFromPreviousVersion && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-gray-500 text-white text-xs rounded-full flex items-center justify-center">
                    ↺
                  </div>
                )}
              </div>
              <div className="text-center text-xs text-gray-600 mt-2 leading-tight">
                <div className="font-medium">{name}</div>
                <div className="text-gray-500 text-[10px] leading-relaxed whitespace-pre-line">{date}</div>
                {rejectionReason && !isFromPreviousVersion && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-right max-w-[180px] mx-auto">
                    <div className="font-semibold text-red-700 mb-1 text-xs">دلیل رد:</div>
                    <div className="text-red-600 text-xs leading-relaxed break-words whitespace-pre-wrap">
                      {rejectionReason}
                    </div>
                  </div>
                )}
                {approvalNote && !isFromPreviousVersion && status === 'checked' && (
                  <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-right max-w-[180px] mx-auto">
                    <div className="font-semibold text-green-700 mb-1 text-xs">توضیحات:</div>
                    <div className="text-green-600 text-xs leading-relaxed break-words whitespace-pre-wrap">
                      {approvalNote}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* نمایش نسخه‌های قبلی */}
      {request.previousVersions && request.previousVersions.length > 0 && (
        <div className="mt-6 pt-4 border-t border-dashed border-gray-400">
          <div className="text-center font-semibold mb-4 text-gray-600 text-base">
            📜 تاریخچه نسخه‌های قبلی (اصلاح شده)
          </div>
          {request.previousVersions.map((version, versionIndex) => (
            <div key={versionIndex} className="mb-6 p-4 bg-gray-50 border-2 border-gray-300 rounded-lg">
              <div className="text-sm font-bold text-gray-700 mb-3 pb-2 border-b border-gray-400">
                نسخه {versionIndex + 1} - رد شده و اصلاح شده
              </div>
              <div className={`grid ${approvalSteps.length === 4 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-5'} gap-4`}>
                {version.map((approval: any, index: number) => {
                  const stepRole = approval.approverRole as Role;
                  const isApproved = approval.status === 'APPROVED' || approval.status === 'COMPLETED';
                  const isRejected = approval.status === 'REJECTED';
                  
                  return (
                    <div key={index} className="flex flex-col items-center opacity-60">
                      <div className="text-xs font-semibold mb-2 text-gray-700 text-center">
                        {ROLE_NAMES[stepRole]}
                      </div>
                      <div className={`w-8 h-8 border-2 ${
                        isApproved 
                          ? 'bg-gray-400 border-gray-500' 
                          : isRejected 
                          ? 'bg-gray-400 border-gray-500'
                          : 'bg-gray-200 border-gray-300'
                      } rounded-full flex items-center justify-center`}>
                        {isApproved && <CheckIcon className="w-5 h-5 text-white" />}
                        {isRejected && <span className="text-lg text-white">×</span>}
                      </div>
                      <div className="text-center text-xs text-gray-600 mt-2 leading-tight">
                        <div className="font-medium">{approval.approverName}</div>
                        <div className="text-gray-500 text-[10px]">
                          {formatPersianDateTime(approval.date)}
                        </div>
                        {approval.rejectionReason && (
                          <div className="mt-2 p-2 bg-gray-100 border border-gray-300 rounded text-right max-w-[180px] mx-auto">
                            <div className="font-semibold text-gray-700 mb-1 text-xs">دلیل رد:</div>
                            <div className="text-gray-600 text-xs leading-relaxed break-words whitespace-pre-wrap">
                              {approval.rejectionReason}
                            </div>
                          </div>
                        )}
                        {approval.approvalNote && isApproved && (
                          <div className="mt-2 p-2 bg-gray-100 border border-gray-300 rounded text-right max-w-[180px] mx-auto">
                            <div className="font-semibold text-gray-700 mb-1 text-xs">توضیحات:</div>
                            <div className="text-gray-600 text-xs leading-relaxed break-words whitespace-pre-wrap">
                              {approval.approvalNote}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ApprovalStatus;