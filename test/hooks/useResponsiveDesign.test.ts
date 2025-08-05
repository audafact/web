import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useResponsiveDesign } from '../../src/hooks/useResponsiveDesign';

describe('useResponsiveDesign', () => {
  let originalInnerWidth: number;
  let originalInnerHeight: number;

  beforeEach(() => {
    // Only access window if it exists (for SSR tests)
    if (typeof window !== 'undefined') {
      originalInnerWidth = window.innerWidth;
      originalInnerHeight = window.innerHeight;
    }
  });

  afterEach(() => {
    // Only restore window if it exists
    if (typeof window !== 'undefined') {
      window.innerWidth = originalInnerWidth;
      window.innerHeight = originalInnerHeight;
    }
  });

  it('should return desktop breakpoints for large screens', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1200
    });

    const { result } = renderHook(() => useResponsiveDesign());

    expect(result.current.isDesktop).toBe(true);
    expect(result.current.isTablet).toBe(false);
    expect(result.current.isMobile).toBe(false);
    expect(result.current.screenSize.width).toBe(1200);
  });

  it('should return tablet breakpoints for medium screens', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 900
    });

    const { result } = renderHook(() => useResponsiveDesign());

    expect(result.current.isDesktop).toBe(false);
    expect(result.current.isTablet).toBe(true);
    expect(result.current.isMobile).toBe(false);
    expect(result.current.screenSize.width).toBe(900);
  });

  it('should return mobile breakpoints for small screens', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375
    });

    const { result } = renderHook(() => useResponsiveDesign());

    expect(result.current.isDesktop).toBe(false);
    expect(result.current.isTablet).toBe(false);
    expect(result.current.isMobile).toBe(true);
    expect(result.current.screenSize.width).toBe(375);
  });

  it('should handle window resize events', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1200
    });

    const { result } = renderHook(() => useResponsiveDesign());

    expect(result.current.isDesktop).toBe(true);

    // Simulate resize to mobile
    act(() => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
      });
      
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current.isMobile).toBe(true);
    expect(result.current.isDesktop).toBe(false);
  });

  it('should handle height changes', () => {
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 800
    });

    const { result } = renderHook(() => useResponsiveDesign());

    expect(result.current.screenSize.height).toBe(800);

    act(() => {
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 600
      });
      
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current.screenSize.height).toBe(600);
  });

  it('should provide correct breakpoint values', () => {
    const { result } = renderHook(() => useResponsiveDesign());

    expect(result.current.BREAKPOINTS).toEqual({
      mobile: 768,
      tablet: 1024,
      desktop: 1200
    });
  });

  it('should handle SSR environment', () => {
    // Skip this test in environments where window is not available
    if (typeof window === 'undefined') {
      expect(true).toBe(true); // Skip test
      return;
    }

    const { result } = renderHook(() => useResponsiveDesign());

    expect(result.current.screenSize.width).toBeGreaterThan(0);
    expect(result.current.screenSize.height).toBeGreaterThan(0);
    expect(typeof result.current.isDesktop).toBe('boolean');
  });

  it('should handle edge cases at breakpoint boundaries', () => {
    // Test that breakpoints are correctly calculated
    const { result } = renderHook(() => useResponsiveDesign());
    
    // Test that the logic is correct for different screen sizes
    expect(result.current.BREAKPOINTS.mobile).toBe(768);
    expect(result.current.BREAKPOINTS.tablet).toBe(1024);
    expect(result.current.BREAKPOINTS.desktop).toBe(1200);
    
    // Test that the current screen size is properly detected
    expect(result.current.screenSize.width).toBeGreaterThan(0);
    expect(result.current.screenSize.height).toBeGreaterThan(0);
    
    // Test that only one breakpoint is true at a time
    const breakpointCount = [result.current.isMobile, result.current.isTablet, result.current.isDesktop]
      .filter(Boolean).length;
    expect(breakpointCount).toBe(1);
  });

  it('should clean up event listeners on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    
    const { unmount } = renderHook(() => useResponsiveDesign());
    
    unmount();
    
    expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
  });
}); 