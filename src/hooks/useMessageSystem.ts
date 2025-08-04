import { useState, useCallback } from 'react';

export interface Message {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  duration?: number;
}

export const useMessageSystem = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  
  const showMessage = useCallback((
    type: 'success' | 'error' | 'info', 
    message: string, 
    duration = 5000
  ) => {
    const id = Date.now().toString();
    const newMessage: Message = { id, type, message, duration };
    
    setMessages(prev => [...prev, newMessage]);
    
    if (duration > 0) {
      setTimeout(() => {
        removeMessage(id);
      }, duration);
    }
  }, []);
  
  const removeMessage = useCallback((id: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== id));
  }, []);
  
  const showSuccessMessage = useCallback((message: string) => {
    showMessage('success', message);
  }, [showMessage]);
  
  const showErrorMessage = useCallback((message: string) => {
    showMessage('error', message);
  }, [showMessage]);
  
  const showInfoMessage = useCallback((message: string) => {
    showMessage('info', message);
  }, [showMessage]);
  
  return {
    messages,
    showSuccessMessage,
    showErrorMessage,
    showInfoMessage,
    removeMessage
  };
}; 