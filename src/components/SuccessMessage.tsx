import React, { useState, useEffect } from 'react';
import { SuccessMessage as SuccessMessageType } from '../types/postSignup';

interface SuccessMessageProps {
  message: SuccessMessageType;
  onClose: () => void;
}

const SuccessMessage: React.FC<SuccessMessageProps> = ({ message, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Allow animation to complete
    }, message.duration);
    
    return () => clearTimeout(timer);
  }, [message.duration, onClose]);
  
  return (
    <div className={`success-message ${isVisible ? 'visible' : 'hidden'}`}>
      <div className="success-content">
        <div className="success-icon">{message.icon}</div>
        <div className="success-text">
          <h4>{message.title}</h4>
          <p>{message.message}</p>
        </div>
        <button className="close-button" onClick={onClose}>
          ✕
        </button>
      </div>
      
      {message.actions && (
        <div className="success-actions">
          {message.actions.map((action, index) => (
            <button
              key={index}
              className={`action-button ${action.variant}`}
              onClick={action.action}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SuccessMessage; 