import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ErrorMonitor } from '../../src/services/errorMonitor';

describe('Error Monitoring', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    
    // Reset the singleton instance
    (ErrorMonitor as any).instance = undefined;
  });
  
  it('should capture errors with context', () => {
    const errorMonitor = ErrorMonitor.getInstance();
    
    const error = new Error('Test error');
    errorMonitor.captureError(error, 'test_context', { custom: 'data' });
    
    const errors = errorMonitor.getErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe('Test error');
    expect(errors[0].context.customContext.custom).toBe('data');
  });
  
  it('should determine error severity correctly', () => {
    const errorMonitor = ErrorMonitor.getInstance();
    
    const networkError = new Error('Failed to fetch');
    errorMonitor.captureError(networkError, 'network');
    
    const errors = errorMonitor.getErrors();
    expect(errors[0].severity).toBe('critical');
  });
  
  it('should capture custom errors', () => {
    const errorMonitor = ErrorMonitor.getInstance();
    
    errorMonitor.captureCustomError('Custom error message', 'test_context', 'high');
    
    const errors = errorMonitor.getErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe('Custom error message');
    expect(errors[0].type).toBe('custom');
    expect(errors[0].severity).toBe('high');
  });
  
  it('should generate unique error IDs', () => {
    const errorMonitor = ErrorMonitor.getInstance();
    
    const error1 = new Error('Error 1');
    const error2 = new Error('Error 2');
    
    errorMonitor.captureError(error1, 'context1');
    errorMonitor.captureError(error2, 'context2');
    
    const errors = errorMonitor.getErrors();
    expect(errors[0].id).not.toBe(errors[1].id);
  });
  
  it('should generate error fingerprints', () => {
    const errorMonitor = ErrorMonitor.getInstance();
    
    const error = new Error('Test error');
    errorMonitor.captureError(error, 'test_context');
    
    const errors = errorMonitor.getErrors();
    expect(errors[0].fingerprint).toBeDefined();
    expect(typeof errors[0].fingerprint).toBe('string');
  });
  
  it('should include browser context in errors', () => {
    const errorMonitor = ErrorMonitor.getInstance();
    
    const error = new Error('Test error');
    errorMonitor.captureError(error, 'test_context');
    
    const errors = errorMonitor.getErrors();
    const context = errors[0].context;
    
    expect(context.userAgent).toBeDefined();
    expect(context.screenSize).toBeDefined();
    expect(context.viewportSize).toBeDefined();
    expect(context.networkStatus).toBeDefined();
  });
  
  it('should limit stored errors to 50', () => {
    const errorMonitor = ErrorMonitor.getInstance();
    
    // Add 60 errors
    for (let i = 0; i < 60; i++) {
      const error = new Error(`Error ${i}`);
      errorMonitor.captureError(error, 'test_context');
    }
    
    const errors = errorMonitor.getErrors();
    expect(errors).toHaveLength(50);
    expect(errors[0].message).toBe('Error 10'); // First 10 should be removed
  });
  
  it('should calculate error rate correctly', () => {
    const errorMonitor = ErrorMonitor.getInstance();
    
    // Add some recent errors
    const error1 = new Error('Error 1');
    const error2 = new Error('Error 2');
    
    errorMonitor.captureError(error1, 'context1');
    errorMonitor.captureError(error2, 'context2');
    
    const errorRate = errorMonitor.getErrorRate();
    expect(errorRate).toBe(2);
  });
  
  it('should clear errors', () => {
    const errorMonitor = ErrorMonitor.getInstance();
    
    const error = new Error('Test error');
    errorMonitor.captureError(error, 'test_context');
    expect(errorMonitor.getErrors()).toHaveLength(1);
    
    errorMonitor.clearErrors();
    expect(errorMonitor.getErrors()).toHaveLength(0);
  });
  
  it('should store errors in localStorage', () => {
    const errorMonitor = ErrorMonitor.getInstance();
    
    const error = new Error('Test error');
    errorMonitor.captureError(error, 'test_context');
    
    const stored = localStorage.getItem('error_log');
    expect(stored).toBeDefined();
    
    const parsed = JSON.parse(stored!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].message).toBe('Test error');
  });
  
  it('should handle different error severities', () => {
    const errorMonitor = ErrorMonitor.getInstance();
    
    // Critical error
    const networkError = new Error('Failed to fetch');
    errorMonitor.captureError(networkError, 'network');
    
    // High severity error
    const audioError = new Error('AudioContext error');
    errorMonitor.captureError(audioError, 'audio');
    
    // Medium severity error
    const storageError = new Error('localStorage error');
    errorMonitor.captureError(storageError, 'storage');
    
    // Low severity error
    const genericError = new Error('Generic error');
    errorMonitor.captureError(genericError, 'generic');
    
    const errors = errorMonitor.getErrors();
    expect(errors[0].severity).toBe('critical');
    expect(errors[1].severity).toBe('high');
    expect(errors[2].severity).toBe('medium');
    expect(errors[3].severity).toBe('low');
  });
}); 