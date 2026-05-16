import React, { useState } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  /** برای approve: آرگوی اول توضیحات، آرگوی دوم شماره اتاق (ویدئو کنفرانس) */
  onConfirm: (approvalOrRejectionNote?: string, conferenceRoom?: string) => void;
  onCancel: () => void;
  type?: 'approve' | 'reject' | 'cancel';
  /** تأیید ویدئو کنفرانس: شماره اتاق اجباری */
  requireConferenceRoom?: boolean;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  type = 'approve',
  requireConferenceRoom = false,
}) => {
  const [rejectionReason, setRejectionReason] = useState('');
  const [approvalNote, setApprovalNote] = useState('');
  const [conferenceRoom, setConferenceRoom] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    // فقط برای نوع reject نیاز به دلیل داریم
    if (type === 'reject') {
      if (!rejectionReason.trim()) {
        setError('لطفاً دلیل رد درخواست را وارد کنید');
        return;
      }
      if (rejectionReason.trim().length > 500) {
        setError('دلیل رد درخواست نباید بیشتر از 500 کاراکتر باشد');
        return;
      }
      onConfirm(rejectionReason.trim());
    } else if (type === 'approve') {
      if (requireConferenceRoom) {
        if (!conferenceRoom.trim()) {
          setError('لطفاً شماره اتاق را وارد کنید');
          return;
        }
        onConfirm(approvalNote.trim() || undefined, conferenceRoom.trim());
      } else {
        onConfirm(approvalNote.trim() || undefined);
      }
    } else {
      // برای cancel نیاز به دلیل نداریم
      onConfirm(undefined);
    }
    
    setRejectionReason('');
    setApprovalNote('');
    setConferenceRoom('');
    setError('');
  };

  const handleCancel = () => {
    setRejectionReason('');
    setApprovalNote('');
    setConferenceRoom('');
    setError('');
    onCancel();
  };

  const confirmButtonClass = type === 'approve'
    ? 'bg-[#2ecc71] hover:bg-[#27ae60]'
    : type === 'reject'
    ? 'bg-[#e74c3c] hover:bg-[#c0392b]'
    : 'bg-gray-500 hover:bg-gray-600';

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[9999] p-4 backdrop-blur-sm"
      onClick={handleCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div 
        className="bg-white rounded-lg shadow-2xl w-full max-w-md animate-slide-down"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          <h3 id="confirm-dialog-title" className="text-xl font-bold text-gray-800 mb-4">{title}</h3>
          <p className="text-gray-600 mb-4 leading-relaxed">{message}</p>
          
          {/* فیلد دلیل رد - فقط برای نوع reject */}
          {type === 'reject' && (
            <div className="mb-4">
              <label htmlFor="rejection-reason" className="block text-sm font-semibold text-gray-700 mb-2">
                دلیل رد درخواست <span className="text-red-500">*</span>
              </label>
              <textarea
                id="rejection-reason"
                value={rejectionReason}
                onChange={(e) => {
                  setRejectionReason(e.target.value);
                  setError('');
                }}
                maxLength={500}
                rows={4}
                placeholder="لطفاً دلیل رد درخواست را به طور واضح توضیح دهید..."
                className={`w-full p-3 border ${error ? 'border-red-500' : 'border-gray-300'} rounded-md focus:ring-2 focus:ring-[#e74c3c] focus:border-[#e74c3c] resize-none`}
                required
                autoFocus
              />
              <div className="flex justify-between items-center mt-1">
                {error && <span className="text-red-500 text-sm">{error}</span>}
                <span className={`text-sm ${rejectionReason.length > 450 ? 'text-red-500 font-semibold' : 'text-gray-500'} ${!error ? 'ml-auto' : ''}`}>
                  {rejectionReason.length}/500 کاراکتر
                </span>
              </div>
            </div>
          )}

          {/* شماره اتاق - تأیید ویدئو کنفرانس */}
          {type === 'approve' && requireConferenceRoom && (
            <div className="mb-4">
              <label htmlFor="conference-room" className="block text-sm font-semibold text-gray-700 mb-2">
                شماره اتاق <span className="text-red-500">*</span>
              </label>
              <input
                id="conference-room"
                type="text"
                value={conferenceRoom}
                onChange={(e) => {
                  setConferenceRoom(e.target.value);
                  setError('');
                }}
                maxLength={200}
                placeholder="مثال: اتاق جلسات ۳۱۲ یا لینک/کد سیستم"
                className={`w-full p-3 border ${error ? 'border-red-500' : 'border-gray-300'} rounded-md focus:ring-2 focus:ring-[#2ecc71] focus:border-[#2ecc71]`}
                autoFocus
              />
            </div>
          )}

          {/* فیلد توضیحات اختیاری - فقط برای نوع approve */}
          {type === 'approve' && (
            <div className="mb-4">
              <label htmlFor="approval-note" className="block text-sm font-semibold text-gray-700 mb-2">
                توضیحات (اختیاری)
              </label>
              <textarea
                id="approval-note"
                value={approvalNote}
                onChange={(e) => {
                  setApprovalNote(e.target.value);
                  setError('');
                }}
                maxLength={500}
                rows={4}
                placeholder="در صورت نیاز، توضیحات خود را وارد کنید..."
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#2ecc71] focus:border-[#2ecc71] resize-none"
              />
              <div className="flex justify-end items-center mt-1">
                <span className={`text-sm ${approvalNote.length > 450 ? 'text-orange-500 font-semibold' : 'text-gray-500'}`}>
                  {approvalNote.length}/500 کاراکتر
                </span>
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <button
              onClick={handleCancel}
              className="px-6 py-2.5 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-all focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 cursor-pointer font-medium"
              aria-label="انصراف"
            >
              {cancelText || 'انصراف'}
            </button>
            <button
              onClick={handleConfirm}
              className={`px-6 py-2.5 text-white rounded-md transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer font-medium ${confirmButtonClass} ${
                type === 'approve' 
                  ? 'focus:ring-green-500 hover:shadow-lg' 
                  : type === 'reject'
                  ? 'focus:ring-red-500 hover:shadow-lg'
                  : 'focus:ring-gray-500 hover:shadow-lg'
              }`}
              aria-label={confirmText || 'تایید'}
            >
              {confirmText || 'تایید'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;