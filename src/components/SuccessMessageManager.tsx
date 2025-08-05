import React, { useState, useEffect } from 'react';
import { useMessageSystem } from '../hooks/useMessageSystem';
import SuccessMessage from './SuccessMessage';
import { SUCCESS_MESSAGES } from '../types/postSignup';

const SuccessMessageManager: React.FC = () => {
  const { messages } = useMessageSystem();
  const [successMessages, setSuccessMessages] = useState<Array<{
    id: string;
    message: any;
  }>>([]);

  // Convert regular messages to success message format
  useEffect(() => {
    const newSuccessMessages = messages
      .filter(msg => msg.type === 'success')
      .map(msg => ({
        id: msg.id,
        message: {
          id: msg.id,
          title: 'Success',
          message: msg.message,
          icon: '✅',
          duration: msg.duration || 5000
        }
      }));

    setSuccessMessages(newSuccessMessages);
  }, [messages]);

  const removeMessage = (id: string) => {
    setSuccessMessages(prev => prev.filter(msg => msg.id !== id));
  };

  return (
    <>
      {successMessages.map(({ id, message }) => (
        <SuccessMessage
          key={id}
          message={message}
          onClose={() => removeMessage(id)}
        />
      ))}
    </>
  );
};

export default SuccessMessageManager; 