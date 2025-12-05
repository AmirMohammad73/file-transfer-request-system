
import React from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
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
  if (!isOpen) return null;

  const confirmButtonClass = type === 'approve'
    ? 'bg-[#2ecc71] hover:bg-[#27ae60]'
    : 'bg-[#e74c3c] hover:bg-[#c0392b]';

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[9999] p-4 backdrop-blur-sm"
      onClick={onCancel}
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
          <p className="text-gray-600 mb-6 leading-relaxed">{message}</p>
          <div className="flex gap-3 justify-end">
            <button
              onClick={onCancel}
              className="px-6 py-2.5 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-all focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 cursor-pointer font-medium"
              aria-label="انصراف"
            >
              {cancelText || 'انصراف'}
            </button>
            <button
              onClick={onConfirm}
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

