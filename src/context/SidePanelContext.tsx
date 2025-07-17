import React, { createContext, useContext, useState } from 'react';

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
  const [isOpen, setIsOpen] = useState(false);

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