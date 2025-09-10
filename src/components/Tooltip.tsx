import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

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
  const [finalPosition, setFinalPosition] = useState(position);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  
  const showTooltip = (e: React.MouseEvent | React.FocusEvent) => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const tooltipHeight = 40; // Approximate tooltip height
      const tooltipWidth = 200; // Approximate tooltip width
      const spacing = 12; // Space between tooltip and trigger
      const viewportPadding = 0; // Padding from viewport edges
      
      let x = rect.left + rect.width / 2;
      let y = rect.top;
      let finalPosition = position;
      
      // Check if tooltip would be cut off at the top
      if (position === 'top' && rect.top - tooltipHeight - spacing < 0) {
        // Switch to bottom if tooltip would go off-screen
        y = rect.bottom + spacing;
        finalPosition = 'bottom';
      } else if (position === 'top') {
        y = rect.top - tooltipHeight - spacing - 8; // Extra spacing for top tooltips
        finalPosition = 'top';
      } else if (position === 'bottom') {
        y = rect.bottom + spacing;
        finalPosition = 'bottom';
      } else if (position === 'left') {
        // For left tooltips, we need to position the RIGHT edge of the tooltip
        // at rect.left - spacing, so left edge = rect.left - spacing - actualWidth
        // But since we don't know actual width yet, we'll position it and adjust with CSS
        x = rect.left - spacing;
        y = rect.top + rect.height / 2;
        finalPosition = 'left';
      } else if (position === 'right') {
        x = rect.right + spacing;
        y = rect.top + rect.height / 2;
        finalPosition = 'right';
      }
      
      // Ensure tooltip stays within viewport bounds
      x = Math.max(viewportPadding, Math.min(x, window.innerWidth - tooltipWidth - viewportPadding));
      y = Math.max(viewportPadding, Math.min(y, window.innerHeight - tooltipHeight - viewportPadding));
      
      setTooltipPosition({ x, y });
      setFinalPosition(finalPosition);
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
    if (isVisible) {
      // If tooltip is visible, hide it
      setIsVisible(false);
    } else {
      // If tooltip is not visible, show it with proper positioning
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        const tooltipHeight = 40; // Approximate tooltip height
        const tooltipWidth = 200; // Approximate tooltip width
        const spacing = 12; // Space between tooltip and trigger
        
        let x = rect.left + rect.width / 2;
        let y = rect.top;
        let finalPosition = position;
        
        // Check if tooltip would be cut off at the top
        if (position === 'top' && rect.top - tooltipHeight - spacing < 0) {
          // Switch to bottom if tooltip would go off-screen
          y = rect.bottom + spacing;
          finalPosition = 'bottom';
        } else if (position === 'top') {
          y = rect.top - tooltipHeight - spacing - 8; // Extra spacing for top tooltips
          finalPosition = 'top';
        } else if (position === 'bottom') {
          y = rect.bottom + spacing;
          finalPosition = 'bottom';
        } else if (position === 'left') {
          // For left tooltips, we need to position the RIGHT edge of the tooltip
          x = rect.left - spacing;
          y = rect.top + rect.height / 2;
          finalPosition = 'left';
        } else if (position === 'right') {
          x = rect.right + spacing;
          y = rect.top + rect.height / 2;
          finalPosition = 'right';
        }
        
        setTooltipPosition({ x, y });
        setFinalPosition(finalPosition);
        setIsVisible(true);
      }
    }
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
    const handleClickOutside = (event: MouseEvent) => {
      if (trigger === 'click' && isVisible && triggerRef.current && !triggerRef.current.contains(event.target as Node)) {
        setIsVisible(false);
      }
    };

    if (trigger === 'click' && isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [trigger, isVisible]);
  
  return (
    <div className={`tooltip-container ${className}`}>
      <div
        ref={triggerRef}
        className="tooltip-trigger"
        {...eventHandlers[trigger]}
      >
        {children}
      </div>
      
      {isVisible && createPortal(
        <div
          ref={tooltipRef}
          className={`feature-tooltip tooltip-${finalPosition}`}
          style={{
            position: 'fixed',
            left: tooltipPosition.x,
            top: tooltipPosition.y,
            transform: position === 'top' || position === 'bottom' 
              ? 'translateX(-50%)' 
              : position === 'right' 
                ? 'translateY(-50%)' 
              : position === 'left'
                ? 'translateX(-100%) translateY(-50%)'
                : 'none',
            maxWidth: `${maxWidth}px`,
            zIndex
          }}
        >
          {content}
        </div>,
        document.body
      )}
    </div>
  );
};

export default Tooltip; 