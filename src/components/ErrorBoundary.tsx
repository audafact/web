import React from 'react';
import { ErrorMonitor } from '../services/errorMonitor';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: any;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error?: Error; resetError: () => void }>;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }
  
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: any): void {
    const errorMonitor = ErrorMonitor.getInstance();
    errorMonitor.captureError(error, 'react_boundary', {
      componentStack: errorInfo.componentStack
    });
  }
  
  resetError = (): void => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };
  
  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error} resetError={this.resetError} />;
      }
      
      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <h2>Something went wrong</h2>
            <p>We've been notified and are working to fix this issue.</p>
            <button 
              onClick={this.resetError}
              className="error-boundary-button"
            >
              Try Again
            </button>
            <button 
              onClick={() => window.location.reload()}
              className="error-boundary-button secondary"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    
    return this.props.children;
  }
}

// Default fallback component
export const DefaultErrorFallback: React.FC<{ 
  error?: Error; 
  resetError: () => void 
}> = ({ error, resetError }) => {
  return (
    <div className="error-boundary">
      <div className="error-boundary-content">
        <h2>Something went wrong</h2>
        <p>We've been notified and are working to fix this issue.</p>
        {error && process.env.NODE_ENV === 'development' && (
          <details className="error-details">
            <summary>Error Details (Development)</summary>
            <pre>{error.message}</pre>
            <pre>{error.stack}</pre>
          </details>
        )}
        <div className="error-actions">
          <button onClick={resetError} className="error-boundary-button">
            Try Again
          </button>
          <button 
            onClick={() => window.location.reload()} 
            className="error-boundary-button secondary"
          >
            Reload Page
          </button>
        </div>
      </div>
    </div>
  );
}; 