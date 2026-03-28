import React, { createContext, useContext, useState } from 'react';
import { BREAKPOINTS } from '../hooks/useResponsiveDesign';

interface SidePanelContextType {
  isOpen: boolean;
  toggleSidePanel: () => void;
  openSidePanel: () => void;
  closeSidePanel: () => void;
}

const SidePanelContext = createContext<SidePanelContextType | undefined>(undefined);

export const useSidePanel = () => {
  const context = useContext(SidePanelContext);
  if (context === undefined) {
    throw new Error('useSidePanel must be used within a SidePanelProvider');
  }
  return context;
};

interface SidePanelProviderProps {
  children: React.ReactNode;
}

export const SidePanelProvider: React.FC<SidePanelProviderProps> = ({ children }) => {
  // Open by default from `lg` (1024px) up; narrower viewports start collapsed for sampler width.
  const [isOpen, setIsOpen] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= BREAKPOINTS.tablet
  );

  const toggleSidePanel = () => setIsOpen(!isOpen);
  const openSidePanel = () => setIsOpen(true);
  const closeSidePanel = () => setIsOpen(false);

  return (
    <SidePanelContext.Provider value={{
      isOpen,
      toggleSidePanel,
      openSidePanel,
      closeSidePanel
    }}>
      {children}
    </SidePanelContext.Provider>
  );
}; 