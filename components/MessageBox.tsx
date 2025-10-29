
import React from 'react';

interface MessageBoxProps {
  message: string;
  type?: 'error' | 'info';
  onDismiss?: () => void;
}

export const MessageBox: React.FC<MessageBoxProps> = ({ message, type = 'error', onDismiss }) => {
  const baseClasses = 'p-4 rounded-md text-sm flex items-center justify-between';
  const typeClasses = {
    error: 'bg-red-100 border border-red-400 text-red-700',
    info: 'bg-blue-100 border border-blue-400 text-blue-700',
  };

  return (
    <div className={`${baseClasses} ${typeClasses[type]}`} role="alert">
      <span>{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="ml-4 font-bold">X</button>
      )}
    </div>
  );
};
