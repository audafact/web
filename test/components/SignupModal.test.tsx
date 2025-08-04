import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { SignupModal } from '../../src/components/SignupModal';
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
  return render(
    <AuthProvider>
      <DemoProvider>
        {component}
      </DemoProvider>
    </AuthProvider>
  );
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

    expect(screen.getByText('🎧 Ready to remix your own sounds?')).toBeInTheDocument();
    expect(screen.getByText('Upload your own tracks and create unique mixes')).toBeInTheDocument();
    expect(screen.getByText('Upload unlimited tracks')).toBeInTheDocument();
    expect(screen.getByText('Sign up to upload tracks')).toBeInTheDocument();
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

    expect(screen.getByText('💾 Don\'t lose your work')).toBeInTheDocument();
    expect(screen.getByText('Save your session and pick up where you left off')).toBeInTheDocument();
    expect(screen.getByText('Save unlimited sessions')).toBeInTheDocument();
    expect(screen.getByText('Sign up to save session')).toBeInTheDocument();
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

    expect(screen.getByText('🎙 Record your performances')).toBeInTheDocument();
    expect(screen.getByText('Upgrade to Pro Creator')).toBeInTheDocument();
    expect(screen.getByText('⭐ This feature requires a Pro Creator subscription')).toBeInTheDocument();
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
    const passwordInput = screen.getByPlaceholderText('Password (min 6 characters)');
    const submitButton = screen.getByText('Sign up to upload tracks');

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Creating account...')).toBeInTheDocument();
    });
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

    await waitFor(() => {
      expect(screen.getByText('Connecting...')).toBeInTheDocument();
    });
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

    expect(screen.queryByText('🎧 Ready to remix your own sounds?')).not.toBeInTheDocument();
  });
}); 