
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">{title}</h3>
          <p className="text-gray-600 mb-6">{message}</p>
          <div className="flex gap-3 justify-end">
            <button
              onClick={onCancel}
              className="px-6 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors cursor-pointer"
            >
              {cancelText || 'انصراف'}
            </button>
            <button
              onClick={onConfirm}
              className={`px-6 py-2 text-white rounded-md transition-colors cursor-pointer ${confirmButtonClass}`}
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

