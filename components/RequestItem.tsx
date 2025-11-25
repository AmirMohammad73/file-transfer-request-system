
import React, { useState } from 'react';
import { Request, Role, User } from '../types';
import ApprovalStatus from './ApprovalStatus';
import { CheckCircleIcon, XCircleIcon } from './icons';
import ConfirmDialog from './ConfirmDialog';

interface RequestItemProps {
  request: Request;
  currentUser: User;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

const RequestItem: React.FC<RequestItemProps> = ({ request, currentUser, onApprove, onReject }) => {
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  const handleApproveClick = () => {
    setShowApproveDialog(true);
  };

  const handleRejectClick = () => {
    setShowRejectDialog(true);
  };

  const handleApproveConfirm = () => {
    setShowApproveDialog(false);
    onApprove(request.id);
  };

  const handleRejectConfirm = () => {
    setShowRejectDialog(false);
    onReject(request.id);
  };

  return (
    <>
      <ConfirmDialog
        isOpen={showApproveDialog}
        title="تایید درخواست"
        message={`آیا از تایید درخواست #${request.id.split('-')[1]} مطمئن هستید؟`}
        confirmText="بله، تایید کن"
        cancelText="انصراف"
        onConfirm={handleApproveConfirm}
        onCancel={() => setShowApproveDialog(false)}
        type="approve"
      />
      <ConfirmDialog
        isOpen={showRejectDialog}
        title="رد درخواست"
        message={`آیا از رد درخواست #${request.id.split('-')[1]} مطمئن هستید؟`}
        confirmText="بله، رد کن"
        cancelText="انصراف"
        onConfirm={handleRejectConfirm}
        onCancel={() => setShowRejectDialog(false)}
        type="reject"
      />
    <div className="bg-white border border-gray-200 rounded-lg p-5 mb-5 shadow-sm transition hover:shadow-md">
      <div className="flex justify-between items-center pb-4 border-b border-dashed border-gray-300">
        <div>
           <h3 className="font-bold text-lg text-[#2c3e50]">درخواست #{request.id.split('-')[1]} از {request.requesterName}</h3>
           <p className="text-sm text-gray-500">تاریخ ایجاد: {new Date(request.createdAt).toLocaleDateString('fa-IR')}</p>
        </div>
        <div className="flex gap-3">
          {currentUser.role !== Role.NETWORK_ADMIN && (
            <button
              onClick={handleRejectClick}
              className="flex items-center gap-2 px-4 py-2 bg-[#e74c3c] text-white rounded-md hover:bg-[#c0392b] transition-colors cursor-pointer"
            >
              <XCircleIcon className="w-5 h-5" />
              <span>رد درخواست</span>
            </button>
          )}
          <button
            onClick={handleApproveClick}
            className="flex items-center gap-2 px-4 py-2 bg-[#2ecc71] text-white rounded-md hover:bg-[#27ae60] transition-colors cursor-pointer"
          >
            <CheckCircleIcon className="w-5 h-5" />
            <span>{currentUser.role === Role.NETWORK_ADMIN ? 'انجام و تکمیل' : 'تایید درخواست'}</span>
          </button>
        </div>
      </div>
      
      <div className="mt-4 space-y-4">
        {request.files.map((file, index) => (
          <div key={file.id} className="p-3 bg-gray-50 rounded-md border border-gray-100">
             <div className="font-bold text-gray-700 mb-2">فایل {index + 1}</div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-sm">
                <div><strong className="text-gray-500">نام فایل:</strong> {file.fileName}</div>
                <div className="lg:col-span-2"><strong className="text-gray-500">محتوای فایل:</strong> {file.fileContent}</div>
                <div><strong className="text-gray-500">فرمت فایل:</strong> {file.fileFormat}</div>
                <div className="lg:col-span-2"><strong className="text-gray-500">شخص/سازمان گیرنده:</strong> {file.recipient}</div>
                <div><strong className="text-gray-500">شماره نامه ارسال فایل:</strong> {file.letterNumber}</div>
                <div className="lg:col-span-3"><strong className="text-gray-500">فیلدهای فایل:</strong> <span className="text-gray-700">{file.fileFields || '—'}</span></div>
             </div>
          </div>
        ))}
      </div>

      <ApprovalStatus request={request} />
    </div>
    </>
  );
};

export default RequestItem;
