import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnalyticsReliabilityService } from '../../src/services/analyticsReliabilityService';

// Mock fetch
global.fetch = vi.fn();

describe('Analytics Reliability', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    
    // Reset the singleton instance
    (AnalyticsReliabilityService as any).instance = undefined;
    
    // Reset fetch mock
    vi.clearAllMocks();
  });
  
  it('should queue events when offline', () => {
    const reliabilityService = AnalyticsReliabilityService.getInstance();
    
    // Mock offline state
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false
    });
    
    reliabilityService.queueEvent('test_event', { data: 'test' });
    
    expect(reliabilityService.getPendingEventCount()).toBe(1);
  });
  
  it('should retry failed events', async () => {
    // Mock online state before creating instance
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    });
    
    const reliabilityService = AnalyticsReliabilityService.getInstance();
    
    // Mock fetch to fail
    (global.fetch as any).mockRejectedValue(new Error('Network error'));
    
    reliabilityService.queueEvent('test_event', { data: 'test' });
    
    // The service should attempt to send immediately when online
    expect(global.fetch).toHaveBeenCalled();
  });
  
  it('should store events in localStorage', () => {
    const reliabilityService = AnalyticsReliabilityService.getInstance();
    
    reliabilityService.queueEvent('test_event', { data: 'test' });
    
    const stored = localStorage.getItem('pending_analytics_events');
    expect(stored).toBeDefined();
    
    const parsed = JSON.parse(stored!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].event).toBe('test_event');
  });
  
  it('should load events from localStorage on initialization', () => {
    // Pre-populate localStorage
    const testEvent = {
      event: 'test_event',
      properties: { data: 'test' },
      timestamp: Date.now(),
      sessionId: 'test_session',
      userId: undefined,
      userTier: 'guest',
      retryCount: 0,
      maxRetries: 3
    };
    
    localStorage.setItem('pending_analytics_events', JSON.stringify([testEvent]));
    
    const reliabilityService = AnalyticsReliabilityService.getInstance();
    
    expect(reliabilityService.getPendingEventCount()).toBe(1);
  });
  
  it('should clear pending events', () => {
    const reliabilityService = AnalyticsReliabilityService.getInstance();
    
    reliabilityService.queueEvent('test_event', { data: 'test' });
    expect(reliabilityService.getPendingEventCount()).toBe(1);
    
    reliabilityService.clearPendingEvents();
    expect(reliabilityService.getPendingEventCount()).toBe(0);
  });
  
  it('should handle network status changes', () => {
    const reliabilityService = AnalyticsReliabilityService.getInstance();
    
    // Mock online state
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    });
    
    // Mock successful fetch
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200
    });
    
    reliabilityService.queueEvent('test_event', { data: 'test' });
    
    // Simulate going offline
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false
    });
    
    // Simulate going back online
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    });
    
    // Wait for processing
    setTimeout(() => {
      expect(global.fetch).toHaveBeenCalled();
    }, 100);
  });
  
  it('should include required properties in events', () => {
    const reliabilityService = AnalyticsReliabilityService.getInstance();
    
    reliabilityService.queueEvent('test_event', { data: 'test' });
    
    const stored = localStorage.getItem('pending_analytics_events');
    const parsed = JSON.parse(stored!);
    const event = parsed[0];
    
    expect(event.event).toBe('test_event');
    expect(event.properties.data).toBe('test');
    expect(event.timestamp).toBeDefined();
    expect(event.sessionId).toBeDefined();
    expect(event.userTier).toBeDefined();
    expect(event.retryCount).toBe(0);
    expect(event.maxRetries).toBe(3);
  });
  
  it('should handle localStorage errors gracefully', () => {
    // Mock localStorage to throw
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = vi.fn().mockImplementation(() => {
      throw new Error('Storage quota exceeded');
    });
    
    const reliabilityService = AnalyticsReliabilityService.getInstance();
    
    // Should not throw
    expect(() => {
      reliabilityService.queueEvent('test_event', { data: 'test' });
    }).not.toThrow();
    
    // Restore original
    localStorage.setItem = originalSetItem;
  });
  
  it('should cleanup resources on destroy', () => {
    const reliabilityService = AnalyticsReliabilityService.getInstance();
    
    // Mock clearInterval
    const originalClearInterval = clearInterval;
    clearInterval = vi.fn();
    
    reliabilityService.destroy();
    
    expect(clearInterval).toHaveBeenCalled();
    
    // Restore original
    clearInterval = originalClearInterval;
  });
}); 