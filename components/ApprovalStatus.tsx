import React from 'react';
import { Request, Role, Status, RequestType } from '../types';
import { ROLE_HIERARCHY, ROLE_NAMES } from '../constants';
import { CheckIcon } from './icons';

interface ApprovalStatusProps {
  request: Request;
}

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
        date: new Date(request.createdAt).toLocaleDateString('fa-IR') 
      };
    }

    const approval = request.approvalHistory.find(a => a.approverRole === step);
    if (approval) {
      return {
        status: approval.status === Status.APPROVED || approval.status === Status.COMPLETED ? 'checked' : 'rejected',
        name: approval.approverName,
        date: new Date(approval.date).toLocaleDateString('fa-IR'),
      };
    }
    
    if (request.currentApprover === step && request.status === Status.PENDING) {
      return { status: 'pending', name: ROLE_NAMES[step], date: 'در انتظار تایید' };
    }

    return { status: 'unchecked', name: ROLE_NAMES[step], date: ' ' };
  };

  return (
    <div className="mt-6 pt-5 border-t border-dashed border-gray-300">
      <div className="text-center font-bold mb-4 text-[#2c3e50] text-lg">مراحل تأیید</div>
      <div className={`grid ${approvalSteps.length === 4 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-5'} gap-4`}>
        {approvalSteps.map(step => {
          const { status, name, date } = getStatusForStep(step);
          
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
                <div>{name}</div>
                <div>{date}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ApprovalStatus;