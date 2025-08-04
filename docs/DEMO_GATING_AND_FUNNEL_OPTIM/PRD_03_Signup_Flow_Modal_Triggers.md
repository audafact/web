# 🔐 PRD 3: Signup Flow & Modal Triggers

## 📋 Overview

**Scope:** Signup modal UI with contextual CTA, modal configuration per trigger (upload, save, etc.), post-signup action resumption

**Dependencies:** PRD 2 (gate types), PRD 1 (entry point)  
**Parallelizable:** Yes  
**Estimated Timeline:** 1-2 weeks

---

## 🎯 Objectives

- Create compelling signup modals with contextual messaging
- Provide seamless authentication flow with social login options
- Enable post-signup action resumption for better user experience
- Optimize conversion through targeted messaging and clear value propositions

---

## 🏗️ Technical Requirements

### 3.1 Signup Modal Configuration

#### Modal Config Schema
```typescript
interface SignupModalConfig {
  title: string;
  message: string;
  benefits: string[];
  ctaText: string;
  redirectAction?: string;
  upgradeRequired?: boolean;
}

interface SignupModalProps {
  isOpen: boolean;
  onClose: () => void;
  trigger: string;
  redirectAction?: string;
}
```

#### Trigger-Specific Configurations
```typescript
const SIGNUP_MODAL_CONFIGS: Record<string, SignupModalConfig> = {
  upload: {
    title: "🎧 Ready to remix your own sounds?",
    message: "Upload your own tracks and create unique mixes",
    benefits: [
      "Upload unlimited tracks",
      "Save your sessions",
      "Access full library",
      "Sync across devices"
    ],
    ctaText: "Sign up to upload tracks",
    redirectAction: 'upload'
  },
  
  save_session: {
    title: "💾 Don't lose your work",
    message: "Save your session and pick up where you left off",
    benefits: [
      "Save unlimited sessions",
      "Sync across devices",
      "Share with others",
      "Version history"
    ],
    ctaText: "Sign up to save session",
    redirectAction: 'save_session'
  },
  
  add_library_track: {
    title: "🎵 Expand your library",
    message: "Add tracks from our curated collection to your studio",
    benefits: [
      "Access 100+ curated tracks",
      "Multiple genres and BPMs",
      "High-quality audio files",
      "Regular new additions"
    ],
    ctaText: "Sign up to browse library",
    redirectAction: 'add_library_track'
  },
  
  edit_cues: {
    title: "🎯 Customize your cues",
    message: "Set precise cue points for perfect transitions",
    benefits: [
      "Custom cue point placement",
      "Precise timing control",
      "Save cue configurations",
      "Share cue setups"
    ],
    ctaText: "Sign up to edit cues",
    redirectAction: 'edit_cues'
  },
  
  edit_loops: {
    title: "🔄 Perfect your loops",
    message: "Create seamless loops with custom start/end points",
    benefits: [
      "Custom loop regions",
      "Seamless transitions",
      "Save loop configurations",
      "Export loop settings"
    ],
    ctaText: "Sign up to edit loops",
    redirectAction: 'edit_loops'
  },
  
  record: {
    title: "🎙 Record your performances",
    message: "Capture and export your live mixing sessions",
    benefits: [
      "Record unlimited sessions",
      "Export to multiple formats",
      "Share performances",
      "Professional quality"
    ],
    ctaText: "Upgrade to Pro Creator",
    redirectAction: 'record',
    upgradeRequired: true
  },
  
  download: {
    title: "💿 Download your work",
    message: "Export your recordings in high quality",
    benefits: [
      "Multiple export formats",
      "High-quality audio",
      "No watermarks",
      "Commercial use rights"
    ],
    ctaText: "Upgrade to Pro Creator",
    redirectAction: 'download',
    upgradeRequired: true
  }
};
```

### 3.2 Signup Modal Component

```typescript
const SignupModal: React.FC<SignupModalProps> = ({ 
  isOpen, 
  onClose, 
  trigger, 
  redirectAction 
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [signupMethod, setSignupMethod] = useState<'email' | 'google' | null>(null);
  
  const config = SIGNUP_MODAL_CONFIGS[trigger] || SIGNUP_MODAL_CONFIGS.upload;
  
  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setSignupMethod('email');
    
    try {
      const { user, error } = await supabase.auth.signUp({
        email,
        password
      });
      
      if (error) throw error;
      
      // Store redirect action for post-signup
      if (redirectAction || config.redirectAction) {
        localStorage.setItem('postSignupAction', redirectAction || config.redirectAction);
      }
      
      // Track signup event
      trackEvent('signup_completed', {
        method: 'email',
        trigger,
        upgradeRequired: config.upgradeRequired
      });
      
      onClose();
      showSuccessMessage('🎉 Welcome to Audafact!');
      
    } catch (error) {
      console.error('Signup error:', error);
      showErrorMessage('Signup failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleGoogleSignup = async () => {
    setIsLoading(true);
    setSignupMethod('google');
    
    try {
      const { user, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });
      
      if (error) throw error;
      
      // Store redirect action for post-signup
      if (redirectAction || config.redirectAction) {
        localStorage.setItem('postSignupAction', redirectAction || config.redirectAction);
      }
      
      // Track signup event
      trackEvent('signup_completed', {
        method: 'google',
        trigger,
        upgradeRequired: config.upgradeRequired
      });
      
    } catch (error) {
      console.error('Google signup error:', error);
      showErrorMessage('Google signup failed. Please try again.');
      setIsLoading(false);
    }
  };
  
  const handleClose = () => {
    if (!isLoading) {
      trackEvent('signup_modal_dismissed', { trigger });
      onClose();
    }
  };
  
  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <div className="signup-modal">
        <div className="signup-header">
          <h2>{config.title}</h2>
          <p className="signup-message">{config.message}</p>
        </div>
        
        <div className="benefits-list">
          {config.benefits.map((benefit, index) => (
            <div key={index} className="benefit-item">
              <span className="benefit-icon">✅</span>
              <span className="benefit-text">{benefit}</span>
            </div>
          ))}
        </div>
        
        <div className="signup-forms">
          <form onSubmit={handleEmailSignup} className="email-signup-form">
            <div className="form-group">
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="email-input"
              />
            </div>
            
            <div className="form-group">
              <input
                type="password"
                placeholder="Password (min 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={isLoading}
                className="password-input"
              />
            </div>
            
            <button 
              type="submit" 
              disabled={isLoading || !email || password.length < 6}
              className="signup-button email-signup-button"
            >
              {isLoading && signupMethod === 'email' ? (
                <>
                  <span className="loading-spinner"></span>
                  Creating account...
                </>
              ) : (
                config.ctaText
              )}
            </button>
          </form>
          
          <div className="signup-divider">
            <span>or</span>
          </div>
          
          <button 
            onClick={handleGoogleSignup}
            disabled={isLoading}
            className="signup-button google-signup-button"
          >
            {isLoading && signupMethod === 'google' ? (
              <>
                <span className="loading-spinner"></span>
                Connecting...
              </>
            ) : (
              <>
                <img src="/google-icon.svg" alt="Google" className="google-icon" />
                Continue with Google
              </>
            )}
          </button>
        </div>
        
        <div className="signup-footer">
          <p className="terms-text">
            By signing up, you agree to our{' '}
            <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>
            {' '}and{' '}
            <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
          </p>
          
          {config.upgradeRequired && (
            <p className="upgrade-note">
              ⭐ This feature requires a Pro Creator subscription
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
};
```

### 3.3 Modal Trigger System

```typescript
const useSignupModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentTrigger, setCurrentTrigger] = useState<string>('');
  const [redirectAction, setRedirectAction] = useState<string>('');
  
  const showSignupModal = (trigger: string, action?: string) => {
    setCurrentTrigger(trigger);
    setRedirectAction(action || '');
    setIsOpen(true);
    
    // Track modal shown event
    trackEvent('signup_modal_shown', { 
      trigger, 
      userTier: getCurrentUserTier() 
    });
  };
  
  const closeSignupModal = () => {
    setIsOpen(false);
    setCurrentTrigger('');
    setRedirectAction('');
  };
  
  return {
    isOpen,
    currentTrigger,
    redirectAction,
    showSignupModal,
    closeSignupModal
  };
};

// Global modal trigger function
export const showSignupModal = (trigger: string, action?: string) => {
  // This will be called from feature gates
  // Implementation depends on global state management
  window.dispatchEvent(new CustomEvent('showSignupModal', {
    detail: { trigger, action }
  }));
};
```

---

## 🎨 UI/UX Requirements

### Modal Design System

```css
/* Signup modal styling */
.signup-modal {
  background: white;
  border-radius: 16px;
  padding: 32px;
  max-width: 480px;
  width: 90vw;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  position: relative;
  overflow: hidden;
}

.signup-header {
  text-align: center;
  margin-bottom: 24px;
}

.signup-header h2 {
  font-size: 24px;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 8px 0;
}

.signup-message {
  font-size: 16px;
  color: #6b7280;
  margin: 0;
  line-height: 1.5;
}

.benefits-list {
  background: #f9fafb;
  border-radius: 12px;
  padding: 20px;
  margin: 24px 0;
}

.benefit-item {
  display: flex;
  align-items: center;
  padding: 8px 0;
  font-size: 15px;
  color: #374151;
}

.benefit-icon {
  margin-right: 12px;
  font-size: 16px;
}

.benefit-text {
  flex: 1;
}

.signup-forms {
  margin: 24px 0;
}

.form-group {
  margin-bottom: 16px;
}

.email-input,
.password-input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 0.2s;
}

.email-input:focus,
.password-input:focus {
  outline: none;
  border-color: #3b82f6;
}

.signup-button {
  width: 100%;
  padding: 14px 24px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.email-signup-button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.email-signup-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px -5px rgba(102, 126, 234, 0.4);
}

.email-signup-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.google-signup-button {
  background: white;
  color: #374151;
  border: 2px solid #e5e7eb;
}

.google-signup-button:hover:not(:disabled) {
  background: #f9fafb;
  border-color: #d1d5db;
}

.google-icon {
  width: 20px;
  height: 20px;
}

.signup-divider {
  text-align: center;
  margin: 20px 0;
  position: relative;
}

.signup-divider::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 1px;
  background: #e5e7eb;
}

.signup-divider span {
  background: white;
  padding: 0 16px;
  color: #6b7280;
  font-size: 14px;
}

.signup-footer {
  text-align: center;
  margin-top: 24px;
}

.terms-text {
  font-size: 12px;
  color: #6b7280;
  margin: 0 0 12px 0;
}

.terms-text a {
  color: #3b82f6;
  text-decoration: none;
}

.terms-text a:hover {
  text-decoration: underline;
}

.upgrade-note {
  font-size: 14px;
  color: #f59e0b;
  margin: 0;
  font-weight: 500;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
```

---

## 🔧 Implementation Details

### Post-Signup Action Resumption

```typescript
const handlePostSignupRedirect = () => {
  const redirectAction = localStorage.getItem('postSignupAction');
  
  if (redirectAction) {
    localStorage.removeItem('postSignupAction');
    
    // Track post-signup action
    trackEvent('post_signup_action', { action: redirectAction });
    
    switch (redirectAction) {
      case 'upload':
        setSidePanelMode('upload');
        showSuccessMessage('🎉 Welcome! You can now upload your own tracks.');
        break;
        
      case 'save_session':
        handleSaveSession();
        showSuccessMessage('💾 Session saved! You can now save unlimited sessions.');
        break;
        
      case 'add_library_track':
        setSidePanelMode('library');
        showSuccessMessage('🎵 Browse our full library and add tracks to your studio!');
        break;
        
      case 'edit_cues':
        showSuccessMessage('🎯 You can now customize cue points!');
        break;
        
      case 'edit_loops':
        showSuccessMessage('🔄 You can now set custom loops!');
        break;
        
      case 'record':
        showUpgradeModal('record');
        break;
        
      case 'download':
        showUpgradeModal('download');
        break;
        
      default:
        showSuccessMessage('🎉 Welcome to Audafact! Start creating your mixes.');
    }
  }
};

// Hook for handling post-signup actions
const usePostSignupActions = () => {
  const { user } = useAuth();
  
  useEffect(() => {
    if (user) {
      handlePostSignupRedirect();
    }
  }, [user]);
};
```

### Success/Error Message System

```typescript
const useMessageSystem = () => {
  const [messages, setMessages] = useState<Array<{
    id: string;
    type: 'success' | 'error' | 'info';
    message: string;
    duration?: number;
  }>>([]);
  
  const showMessage = (type: 'success' | 'error' | 'info', message: string, duration = 5000) => {
    const id = Date.now().toString();
    const newMessage = { id, type, message, duration };
    
    setMessages(prev => [...prev, newMessage]);
    
    if (duration > 0) {
      setTimeout(() => {
        removeMessage(id);
      }, duration);
    }
  };
  
  const removeMessage = (id: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== id));
  };
  
  const showSuccessMessage = (message: string) => showMessage('success', message);
  const showErrorMessage = (message: string) => showMessage('error', message);
  const showInfoMessage = (message: string) => showMessage('info', message);
  
  return {
    messages,
    showSuccessMessage,
    showErrorMessage,
    showInfoMessage,
    removeMessage
  };
};
```

---

## 🧪 Testing Requirements

### Unit Tests
```typescript
describe('Signup Flow & Modal Triggers', () => {
  describe('SignupModal Component', () => {
    it('should render with correct trigger configuration', () => {
      const { getByText } = render(
        <SignupModal 
          isOpen={true} 
          onClose={jest.fn()} 
          trigger="upload" 
        />
      );
      
      expect(getByText('🎧 Ready to remix your own sounds?')).toBeInTheDocument();
      expect(getByText('Upload unlimited tracks')).toBeInTheDocument();
    });
    
    it('should handle email signup successfully', async () => {
      const mockSignUp = jest.fn().mockResolvedValue({ user: { id: '123' }, error: null });
      jest.spyOn(supabase.auth, 'signUp').mockImplementation(mockSignUp);
      
      const { getByPlaceholderText, getByText } = render(
        <SignupModal 
          isOpen={true} 
          onClose={jest.fn()} 
          trigger="upload" 
        />
      );
      
      fireEvent.change(getByPlaceholderText('Email address'), {
        target: { value: 'test@example.com' }
      });
      
      fireEvent.change(getByPlaceholderText('Password (min 6 characters)'), {
        target: { value: 'password123' }
      });
      
      fireEvent.click(getByText('Sign up to upload tracks'));
      
      await waitFor(() => {
        expect(mockSignUp).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123'
        });
      });
    });
    
    it('should handle Google signup', async () => {
      const mockSignInWithOAuth = jest.fn().mockResolvedValue({ user: { id: '123' }, error: null });
      jest.spyOn(supabase.auth, 'signInWithOAuth').mockImplementation(mockSignInWithOAuth);
      
      const { getByText } = render(
        <SignupModal 
          isOpen={true} 
          onClose={jest.fn()} 
          trigger="upload" 
        />
      );
      
      fireEvent.click(getByText('Continue with Google'));
      
      await waitFor(() => {
        expect(mockSignInWithOAuth).toHaveBeenCalledWith({
          provider: 'google',
          options: {
            redirectTo: expect.stringContaining('/auth/callback')
          }
        });
      });
    });
  });
  
  describe('Post-Signup Actions', () => {
    it('should resume upload action after signup', () => {
      localStorage.setItem('postSignupAction', 'upload');
      
      const mockSetSidePanelMode = jest.fn();
      const mockShowSuccessMessage = jest.fn();
      
      handlePostSignupRedirect();
      
      expect(mockSetSidePanelMode).toHaveBeenCalledWith('upload');
      expect(mockShowSuccessMessage).toHaveBeenCalledWith(
        '🎉 Welcome! You can now upload your own tracks.'
      );
      expect(localStorage.getItem('postSignupAction')).toBeNull();
    });
  });
});
```

---

## 📊 Analytics Events

### Signup Flow Events
```typescript
interface SignupFlowEvents {
  'signup_modal_shown': { trigger: string; userTier: string };
  'signup_modal_dismissed': { trigger: string; userTier: string };
  'signup_completed': { method: 'email' | 'google'; trigger: string; upgradeRequired: boolean };
  'post_signup_action': { action: string; userTier: string };
  'signup_error': { trigger: string; error: string };
}
```

---

## 🚀 Success Criteria

- [ ] Signup modal displays with contextual messaging based on trigger
- [ ] Email signup flow works with validation and error handling
- [ ] Google OAuth integration functions correctly
- [ ] Post-signup actions resume user intent seamlessly
- [ ] Success/error messages provide clear feedback
- [ ] Analytics events track signup funnel progression
- [ ] Modal dismissals are tracked for optimization
- [ ] Terms and privacy links are accessible
- [ ] Upgrade requirements are clearly communicated

---

## 🔄 Dependencies & Integration

### Input Dependencies
- PRD 2: Feature Gating Architecture (for modal gate integration)
- PRD 1: Demo Mode Foundation (for entry point integration)

### Output Dependencies
- PRD 9: Post-Signup Experience Continuity (for action resumption)
- PRD 6: Analytics & Funnel Tracking (for signup event tracking)

### Integration Points
- `useAuth` hook for authentication state
- `supabase.auth` for signup functionality
- Feature gates for modal triggers
- Analytics service for conversion tracking
- Success/error message system for user feedback 