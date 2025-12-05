import React from 'react';
import Toast from './Toast';
import { useToast } from '../hooks/useToast';

export const ToastContext = React.createContext<{
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}>({
  showToast: () => {},
});

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toast, showToast, hideToast } = useToast();

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />
    </ToastContext.Provider>
  );
};

export const useToastContext = () => React.useContext(ToastContext);

