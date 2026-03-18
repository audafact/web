import React, { createContext, useContext, useState, useCallback } from 'react';

interface TapTempoContextValue {
  isTapTempoActive: boolean;
  setTapTempoActive: (active: boolean) => void;
}

const TapTempoContext = createContext<TapTempoContextValue | null>(null);

export const TapTempoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeCount, setActiveCount] = useState(0);

  const setTapTempoActive = useCallback((active: boolean) => {
    setActiveCount(prev => {
      if (active) return prev + 1;
      return Math.max(0, prev - 1);
    });
  }, []);

  const value: TapTempoContextValue = {
    isTapTempoActive: activeCount > 0,
    setTapTempoActive,
  };

  return (
    <TapTempoContext.Provider value={value}>
      {children}
    </TapTempoContext.Provider>
  );
};

export const useTapTempo = (): TapTempoContextValue => {
  const context = useContext(TapTempoContext);
  if (!context) {
    return {
      isTapTempoActive: false,
      setTapTempoActive: () => {},
    };
  }
  return context;
};
