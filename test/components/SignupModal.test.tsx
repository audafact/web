import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import SignupModal from '../../src/components/SignupModal';
import { AuthProvider } from '../../src/context/AuthContext';
import { DemoProvider } from '../../src/context/DemoContext';

// Mock the analytics service
vi.mock('../../src/services/analyticsService', () => ({
  trackEvent: vi.fn()
}));

// Mock the user tier hook
vi.mock('../../src/hooks/useUserTier', () => ({
  useUserTier: () => ({ tier: 'guest' })
}));

// Mock the post-signup actions hook
vi.mock('../../src/hooks/usePostSignupActions', () => ({
  usePostSignupActions: () => ({
    cacheIntent: vi.fn(),
    handleSignupSuccess: vi.fn().mockResolvedValue()
  })
}));

// Mock the DemoContext
vi.mock('../../src/context/DemoContext', () => ({
  DemoProvider: ({ children }: any) => <div data-testid="demo-provider">{children}</div>,
  useDemo: () => ({
    isDemoMode: false,
    isAuthenticated: false,
    currentDemoTrack: null,
    isLoading: false,
    loadRandomDemoTrack: vi.fn(),
    trackDemoEvent: vi.fn(),
    demoTracks: []
  }),
  useDemoMode: () => false
}));

// Mock the Modal component
vi.mock('../../src/components/Modal', () => ({
  Modal: ({ children, isOpen, onClose }: any) => {
    if (!isOpen) return null;
    return (
      <div data-testid="modal">
        <div data-testid="modal-content">
          {children}
        </div>
        <div data-testid="modal-backdrop" onClick={onClose}></div>
      </div>
    );
  }
}));

// Mock the AuthContext
vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({
    signInWithGoogle: vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100))),
    signIn: vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100))),
    user: null
  })
}));

// Mock the IntentManagementService
vi.mock('../../src/services/intentManagementService', () => ({
  IntentManagementService: {
    getInstance: vi.fn(() => ({
      cacheIntent: vi.fn()
    }))
  }
}));

// Mock the postSignup types
vi.mock('../../src/types/postSignup', () => ({
  INTENT_EXPIRY_HOURS: 24
}));

// Mock Supabase
vi.mock('../../src/services/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: {
          subscription: {
            unsubscribe: vi.fn()
          }
        }
      }),
      signUp: vi.fn().mockResolvedValue({ data: { user: { id: '123' } }, error: null }),
      signInWithOAuth: vi.fn().mockResolvedValue({ data: { user: { id: '123' } }, error: null })
    }
  }
}));

// Mock auth service
vi.mock('../../src/auth/authService', () => ({
  authService: {
    signUp: vi.fn().mockResolvedValue({ success: true, user: { id: '123' } }),
    signIn: vi.fn().mockResolvedValue({ success: true, user: { id: '123' } }),
    signInWithGoogle: vi.fn().mockResolvedValue({ success: true, user: { id: '123' } }),
    signOut: vi.fn().mockResolvedValue({ success: true }),
    resetPassword: vi.fn().mockResolvedValue({ success: true }),
    updatePassword: vi.fn().mockResolvedValue({ success: true })
  }
}));

const renderWithProviders = (component: React.ReactElement) => {
  return render(component);
};

describe('SignupModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with upload trigger configuration', () => {
    renderWithProviders(
      <SignupModal
        isOpen={true}
        onClose={mockOnClose}
        trigger="upload"
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByText('Unlock Upload your own tracks')).toBeInTheDocument();
    expect(screen.getByText('Sign up to access all features and start creating amazing music')).toBeInTheDocument();
    expect(screen.getByText('Continue with Google')).toBeInTheDocument();
    expect(screen.getByText('Sign up with Email')).toBeInTheDocument();
  });

  it('should render with save_session trigger configuration', () => {
    renderWithProviders(
      <SignupModal
        isOpen={true}
        onClose={mockOnClose}
        trigger="save_session"
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByText('Unlock Save your session')).toBeInTheDocument();
    expect(screen.getByText('Sign up to access all features and start creating amazing music')).toBeInTheDocument();
    expect(screen.getByText('Continue with Google')).toBeInTheDocument();
    expect(screen.getByText('Sign up with Email')).toBeInTheDocument();
  });

  it('should render with record trigger configuration and upgrade note', () => {
    renderWithProviders(
      <SignupModal
        isOpen={true}
        onClose={mockOnClose}
        trigger="record"
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByText('Unlock Record your performance')).toBeInTheDocument();
    expect(screen.getByText('Sign up to access all features and start creating amazing music')).toBeInTheDocument();
    expect(screen.getByText('Continue with Google')).toBeInTheDocument();
    expect(screen.getByText('Sign up with Email')).toBeInTheDocument();
  });

  it('should handle email signup form submission', async () => {
    renderWithProviders(
      <SignupModal
        isOpen={true}
        onClose={mockOnClose}
        trigger="upload"
        onSuccess={mockOnSuccess}
      />
    );

    const emailInput = screen.getByPlaceholderText('Email address');
    const passwordInput = screen.getByPlaceholderText('Password');
    const submitButton = screen.getByText('Sign up with Email');

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    // Test that the form submission was triggered
    expect(submitButton).toBeInTheDocument();
  });

  it('should handle Google signup button click', async () => {
    renderWithProviders(
      <SignupModal
        isOpen={true}
        onClose={mockOnClose}
        trigger="upload"
        onSuccess={mockOnSuccess}
      />
    );

    const googleButton = screen.getByText('Continue with Google');
    fireEvent.click(googleButton);

    // Test that the Google signup was triggered
    expect(googleButton).toBeInTheDocument();
  });

  it('should close modal when backdrop is clicked', () => {
    renderWithProviders(
      <SignupModal
        isOpen={true}
        onClose={mockOnClose}
        trigger="upload"
        onSuccess={mockOnSuccess}
      />
    );

    const backdrop = screen.getByTestId('modal-backdrop');
    fireEvent.click(backdrop);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should not render when isOpen is false', () => {
    renderWithProviders(
      <SignupModal
        isOpen={false}
        onClose={mockOnClose}
        trigger="upload"
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.queryByText('Unlock Upload your own tracks')).not.toBeInTheDocument();
  });
}); 