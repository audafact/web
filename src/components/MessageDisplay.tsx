import React from 'react';
import { Message } from '../hooks/useMessageSystem';

interface MessageDisplayProps {
  messages: Message[];
  onRemove: (id: string) => void;
}

export const MessageDisplay: React.FC<MessageDisplayProps> = ({ messages, onRemove }) => {
  const getMessageStyles = (type: Message['type']) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getIcon = (type: Message['type']) => {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'info':
        return 'ℹ️';
      default:
        return '💬';
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex items-center p-4 rounded-lg border shadow-lg max-w-sm transition-all duration-300 ${getMessageStyles(message.type)}`}
        >
          <span className="mr-3 text-lg">{getIcon(message.type)}</span>
          <span className="flex-1 text-sm font-medium">{message.message}</span>
          <button
            onClick={() => onRemove(message.id)}
            className="ml-3 text-gray-400 hover:text-gray-600 transition-colors"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}; 