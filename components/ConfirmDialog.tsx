import React, { useState } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: (rejectionReason?: string) => void;
  onCancel: () => void;
  type?: 'approve' | 'reject';
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
}) => {
  const [rejectionReason, setRejectionReason] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    // اگر نوع رد درخواست است، بررسی کن که دلیل وارد شده باشد
    if (type === 'reject') {
      if (!rejectionReason.trim()) {
        setError('لطفاً دلیل رد درخواست را وارد کنید');
        return;
      }
      if (rejectionReason.trim().length > 500) {
        setError('دلیل رد درخواست نباید بیشتر از 500 کاراکتر باشد');
        return;
      }
    }
    
    // ارسال دلیل (اگر نوع reject بود) یا undefined
    onConfirm(type === 'reject' ? rejectionReason.trim() : undefined);
    
    // پاک کردن state
    setRejectionReason('');
    setError('');
  };

  const handleCancel = () => {
    setRejectionReason('');
    setError('');
    onCancel();
  };

  const confirmButtonClass = type === 'approve'
    ? 'bg-[#2ecc71] hover:bg-[#27ae60]'
    : 'bg-[#e74c3c] hover:bg-[#c0392b]';

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
                  : 'focus:ring-red-500 hover:shadow-lg'
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