import React, { useState, useRef, useEffect } from 'react';

interface TooltipProps {
  content: string | React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  trigger?: 'hover' | 'click' | 'focus';
  delay?: number;
  className?: string;
  children: React.ReactNode;
  maxWidth?: number;
  zIndex?: number;
}

const Tooltip: React.FC<TooltipProps> = ({
  content,
  position = 'top',
  trigger = 'hover',
  delay = 200,
  className = '',
  children,
  maxWidth = 200,
  zIndex = 1000
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const timeoutRef = useRef<NodeJS.Timeout>();
  const triggerRef = useRef<HTMLDivElement>(null);
  
  const showTooltip = (e: React.MouseEvent | React.FocusEvent) => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      let x = rect.left + rect.width / 2;
      let y = rect.top;
      
      switch (position) {
        case 'top':
          y = rect.top - 10;
          break;
        case 'bottom':
          y = rect.bottom + 10;
          break;
        case 'left':
          x = rect.left - 10;
          y = rect.top + rect.height / 2;
          break;
        case 'right':
          x = rect.right + 10;
          y = rect.top + rect.height / 2;
          break;
      }
      
      setTooltipPosition({ x, y });
    }
    
    if (delay > 0) {
      timeoutRef.current = setTimeout(() => setIsVisible(true), delay);
    } else {
      setIsVisible(true);
    }
  };
  
  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };
  
  const toggleTooltip = (e: React.MouseEvent) => {
    e.preventDefault();
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setTooltipPosition({
        x: rect.left + rect.width / 2,
        y: rect.top - 10
      });
    }
    setIsVisible(!isVisible);
  };
  
  const eventHandlers = {
    hover: {
      onMouseEnter: showTooltip,
      onMouseLeave: hideTooltip
    },
    click: {
      onClick: toggleTooltip
    },
    focus: {
      onFocus: showTooltip,
      onBlur: hideTooltip
    }
  };
  
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  return (
    <div className={`tooltip-container ${className}`}>
      <div
        ref={triggerRef}
        className="tooltip-trigger"
        {...eventHandlers[trigger]}
      >
        {children}
      </div>
      
      {isVisible && (
        <div
          className={`feature-tooltip tooltip-${position}`}
          style={{
            left: tooltipPosition.x,
            top: tooltipPosition.y,
            transform: position === 'top' || position === 'bottom' 
              ? 'translateX(-50%)' 
              : 'translateY(-50%)',
            maxWidth: `${maxWidth}px`,
            zIndex
          }}
        >
          {content}
        </div>
      )}
    </div>
  );
};

export default Tooltip; 