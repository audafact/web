import { useState, useEffect, useCallback } from "react";

interface BreakpointConfig {
  mobile: number;
  tablet: number;
  desktop: number;
}

const BREAKPOINTS: BreakpointConfig = {
  mobile: 768,
  tablet: 1024,
  desktop: 1200,
};

interface ScreenSize {
  width: number;
  height: number;
}

interface Breakpoints {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

export const useResponsiveDesign = () => {
  const [screenSize, setScreenSize] = useState<ScreenSize>({
    width: typeof window !== "undefined" ? window.innerWidth : 1200,
    height: typeof window !== "undefined" ? window.innerHeight : 800,
  });

  const [breakpoints, setBreakpoints] = useState<Breakpoints>({
    isMobile:
      typeof window !== "undefined"
        ? window.innerWidth < BREAKPOINTS.mobile
        : false,
    isTablet:
      typeof window !== "undefined"
        ? window.innerWidth >= BREAKPOINTS.mobile &&
          window.innerWidth < BREAKPOINTS.tablet
        : false,
    isDesktop:
      typeof window !== "undefined"
        ? window.innerWidth >= BREAKPOINTS.tablet
        : true,
  });

  // Debounced resize handler to prevent excessive re-renders
  const debouncedHandleResize = useCallback(() => {
    let timeoutId: NodeJS.Timeout;
    return () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const width = window.innerWidth;
        const height = window.innerHeight;

        setScreenSize({ width, height });
        setBreakpoints({
          isMobile: width < BREAKPOINTS.mobile,
          isTablet: width >= BREAKPOINTS.mobile && width < BREAKPOINTS.tablet,
          isDesktop: width >= BREAKPOINTS.tablet,
        });
      }, 100); // 100ms debounce
    };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const handleResize = debouncedHandleResize();
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, [debouncedHandleResize]);

  return {
    screenSize,
    breakpoints,
    isMobile: breakpoints.isMobile,
    isTablet: breakpoints.isTablet,
    isDesktop: breakpoints.isDesktop,
    BREAKPOINTS,
  };
};
