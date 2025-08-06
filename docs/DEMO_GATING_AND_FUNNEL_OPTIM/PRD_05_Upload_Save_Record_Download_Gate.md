# 🎛️ PRD 5: Upload / Save / Record / Download Gate

## 📋 Overview

**Scope:** Upload button (modal gate), Save session button (disabled/tooltip), Record performance (Free: 1 recording, Pro: unlimited), Download (Pro-only, hidden)

**Dependencies:** PRD 2 (gating hooks), PRD 3 (signup modal)  
**Parallelizable:** Yes  
**Estimated Timeline:** 1-2 weeks

---

## 🎯 Objectives

- Implement strategic gating for core studio actions
- Provide clear upgrade incentives for Pro features
- Maintain user experience while driving conversions
- Enable seamless post-signup action resumption

---

## 🏗️ Technical Requirements

### 5.1 Upload Gate Implementation

#### Upload Button Component
```typescript
interface UploadButtonProps {
  onUpload: (file: File) => void;
  acceptedFormats?: string[];
  maxFileSize?: number;
}

const UploadButton: React.FC<UploadButtonProps> = ({
  onUpload,
  acceptedFormats = ['.wav', '.mp3', '.aiff', '.flac'],
  maxFileSize = 50 * 1024 * 1024 // 50MB
}) => {
  const { tier } = useUserTier();
  const { canAccessFeature } = useAccessControl();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const canUpload = canAccessFeature('upload', tier);
  
  const handleUploadClick = () => {
    if (!canUpload) {
      showSignupModal('upload');
      return;
    }
    
    fileInputRef.current?.click();
  };
  
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Validate file format
    const isValidFormat = acceptedFormats.some(format => 
      file.name.toLowerCase().endsWith(format.replace('.', ''))
    );
    
    if (!isValidFormat) {
      showErrorMessage(`Please select a valid audio file: ${acceptedFormats.join(', ')}`);
      return;
    }
    
    // Validate file size
    if (file.size > maxFileSize) {
      showErrorMessage(`File size must be less than ${Math.round(maxFileSize / 1024 / 1024)}MB`);
      return;
    }
    
    try {
      await onUpload(file);
      
      // Track upload event
      trackEvent('track_uploaded', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        userTier: tier.id
      });
      
    } catch (error) {
      console.error('Upload failed:', error);
      showErrorMessage('Upload failed. Please try again.');
    }
    
    // Reset file input
    event.target.value = '';
  };
  
  return (
    <>
      <FeatureGate feature="upload" gateType="modal">
        <button
          onClick={handleUploadClick}
          className="upload-button"
          title="Upload your own audio files"
        >
          📁 Upload Track
        </button>
      </FeatureGate>
      
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedFormats.join(',')}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
    </>
  );
};
```

### 5.2 Save Session Gate Implementation

#### Save Session Button
```typescript
interface SaveSessionButtonProps {
  onSave: () => Promise<void>;
  sessionName?: string;
  isModified?: boolean;
}

const SaveSessionButton: React.FC<SaveSessionButtonProps> = ({
  onSave,
  sessionName,
  isModified = false
}) => {
  const { tier } = useUserTier();
  const { canAccessFeature, canPerformAction } = useAccessControl();
  const [isSaving, setIsSaving] = useState(false);
  
  const canSave = canAccessFeature('save_session', tier);
  const [canSaveAction, setCanSaveAction] = useState(true);
  
  // Check usage limits
  useEffect(() => {
    const checkSaveLimit = async () => {
      if (tier.id !== 'guest') {
        const canSave = await canPerformAction('save_session');
        setCanSaveAction(canSave);
      }
    };
    
    checkSaveLimit();
  }, [tier.id, canPerformAction]);
  
  const handleSaveClick = async () => {
    if (!canSave || !canSaveAction) {
      if (tier.id === 'guest') {
        showSignupModal('save_session');
      } else {
        showUpgradeModal('save_session');
      }
      return;
    }
    
    setIsSaving(true);
    
    try {
      await onSave();
      
      // Track save event
      trackEvent('session_saved', {
        sessionName,
        userTier: tier.id,
        isModified
      });
      
      showSuccessMessage('💾 Session saved successfully!');
      
    } catch (error) {
      console.error('Save failed:', error);
      showErrorMessage('Failed to save session. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };
  
  const getButtonState = () => {
    if (!canSave) return 'locked';
    if (!canSaveAction) return 'limit-reached';
    if (isSaving) return 'saving';
    return 'ready';
  };
  
  const buttonState = getButtonState();
  
  return (
    <button
      onClick={handleSaveClick}
      disabled={isSaving}
      className={`save-button ${buttonState}`}
      title={
        buttonState === 'locked' ? 'Sign up to save your session' :
        buttonState === 'limit-reached' ? 'Upgrade to save more sessions' :
        'Save current session'
      }
    >
      {buttonState === 'saving' ? (
        <>
          <span className="loading-spinner"></span>
          Saving...
        </>
      ) : buttonState === 'locked' ? (
        '🔒 Save Session'
      ) : buttonState === 'limit-reached' ? (
        '⚠️ Save Session'
      ) : (
        '💾 Save Session'
      )}
    </button>
  );
};
```

### 5.3 Record Performance Gate Implementation

#### Record Button Component
```typescript
interface RecordButtonProps {
  onRecord: () => Promise<void>;
  onStop: () => Promise<void>;
  isRecording: boolean;
}

const RecordButton: React.FC<RecordButtonProps> = ({
  onRecord,
  onStop,
  isRecording
}) => {
  const { tier } = useUserTier();
  const { canAccessFeature } = useAccessControl();
  
  const canRecord = canAccessFeature('record', tier);
  
  const handleRecordClick = async () => {
    if (!canRecord) {
      showUpgradeModal('record');
      return;
    }
    
    try {
      if (isRecording) {
        await onStop();
        
        // Track recording stop event
        trackEvent('recording_stopped', {
          userTier: tier.id
        });
        
      } else {
        await onRecord();
        
        // Track recording start event
        trackEvent('recording_started', {
          userTier: tier.id
        });
      }
      
    } catch (error) {
      console.error('Recording failed:', error);
      showErrorMessage('Recording failed. Please try again.');
    }
  };
  
  return (
    <FeatureGate feature="record" gateType="modal">
      <button
        onClick={handleRecordClick}
        className={`record-button ${isRecording ? 'recording' : ''}`}
        title={
          canRecord ? 
            (isRecording ? 'Stop recording' : 'Start recording') :
            'Upgrade to Pro Creator to record performances'
        }
      >
        {isRecording ? '⏹️ Stop Recording' : '🎙️ Record Performance'}
      </button>
    </FeatureGate>
  );
};
```

### 5.4 Download Gate Implementation

#### Download Button Component
```typescript
interface DownloadButtonProps {
  onDownload: () => Promise<void>;
  fileName?: string;
  format?: 'wav' | 'mp3';
  isAvailable?: boolean;
}

const DownloadButton: React.FC<DownloadButtonProps> = ({
  onDownload,
  fileName,
  format = 'wav',
  isAvailable = true
}) => {
  const { tier } = useUserTier();
  const { canAccessFeature } = useAccessControl();
  const [isDownloading, setIsDownloading] = useState(false);
  
  const canDownload = canAccessFeature('download', tier);
  
  // Hide download button completely for non-pro users
  if (!canDownload) {
    return null;
  }
  
  const handleDownloadClick = async () => {
    if (!isAvailable) {
      showErrorMessage('No recording available to download.');
      return;
    }
    
    setIsDownloading(true);
    
    try {
      await onDownload();
      
      // Track download event
      trackEvent('recording_downloaded', {
        fileName,
        format,
        userTier: tier.id
      });
      
      showSuccessMessage('💿 Download started!');
      
    } catch (error) {
      console.error('Download failed:', error);
      showErrorMessage('Download failed. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };
  
  return (
    <button
      onClick={handleDownloadClick}
      disabled={isDownloading || !isAvailable}
      className="download-button"
      title={`Download as ${format.toUpperCase()}`}
    >
      {isDownloading ? (
        <>
          <span className="loading-spinner"></span>
          Downloading...
        </>
      ) : (
        `💿 Download ${format.toUpperCase()}`
      )}
    </button>
  );
};
```

---

## 🎨 UI/UX Requirements

### Button Styling System

```css
/* Base button styles */
.upload-button,
.save-button,
.record-button,
.download-button {
  padding: 12px 20px;
  border: 2px solid;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 140px;
  justify-content: center;
}

/* Upload button */
.upload-button {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border-color: #10b981;
  color: white;
}

.upload-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px -5px rgba(16, 185, 129, 0.4);
}

.upload-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* Save button states */
.save-button.ready {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border-color: #3b82f6;
  color: white;
}

.save-button.ready:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px -5px rgba(59, 130, 246, 0.4);
}

.save-button.locked {
  background: #f3f4f6;
  border-color: #d1d5db;
  color: #9ca3af;
  cursor: pointer;
}

.save-button.locked:hover {
  background: #e5e7eb;
  border-color: #9ca3af;
}

.save-button.limit-reached {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  border-color: #f59e0b;
  color: white;
}

.save-button.limit-reached:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px -5px rgba(245, 158, 11, 0.4);
}

.save-button.saving {
  background: #6b7280;
  border-color: #6b7280;
  color: white;
  cursor: not-allowed;
}

/* Record button */
.record-button {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  border-color: #ef4444;
  color: white;
}

.record-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px -5px rgba(239, 68, 68, 0.4);
}

.record-button.recording {
  background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
  border-color: #dc2626;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.7);
  }
  50% {
    box-shadow: 0 0 0 10px rgba(220, 38, 38, 0);
  }
}

/* Download button */
.download-button {
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  border-color: #8b5cf6;
  color: white;
}

.download-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px -5px rgba(139, 92, 246, 0.4);
}

.download-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* Loading spinner */
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

/* Button group layout */
.button-group {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.button-group.vertical {
  flex-direction: column;
  align-items: stretch;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .upload-button,
  .save-button,
  .record-button,
  .download-button {
    min-width: 120px;
    padding: 10px 16px;
    font-size: 13px;
  }
  
  .button-group {
    gap: 8px;
  }
}
```

---

## 🔧 Implementation Details

### Upgrade Modal Integration

```typescript
const showUpgradeModal = (feature: string) => {
  const upgradeConfigs = {
    save_session: {
      title: "💾 Save More Sessions",
      message: "You've reached your session limit. Upgrade to save unlimited sessions.",
      benefits: [
        "Unlimited session saves",
        "Cloud sync across devices",
        "Version history",
        "Share sessions with others"
      ],
      ctaText: "Upgrade to Pro Creator",
      price: "$9.99/month"
    },
    record: {
      title: "🎙 Record Your Performances",
      message: "Capture and export your live mixing sessions in high quality.",
      benefits: [
        "Unlimited recordings",
        "Multiple export formats",
        "Professional quality",
        "Commercial use rights"
      ],
      ctaText: "Upgrade to Pro Creator",
      price: "$9.99/month"
    },
    download: {
      title: "💿 Download Your Work",
      message: "Export your recordings in high quality without watermarks.",
      benefits: [
        "High-quality exports",
        "Multiple formats (WAV, MP3)",
        "No watermarks",
        "Commercial licensing"
      ],
      ctaText: "Upgrade to Pro Creator",
      price: "$9.99/month"
    }
  };
  
  const config = upgradeConfigs[feature];
  
  // Show upgrade modal with specific configuration
  setUpgradeModalConfig(config);
  setUpgradeModalOpen(true);
  
  // Track upgrade modal shown event
  trackEvent('upgrade_modal_shown', {
    feature,
    userTier: getCurrentUserTier()
  });
};
```

### Usage Limit Tracking

```typescript
const useUsageLimits = () => {
  const { tier } = useUserTier();
  const [usageCounts, setUsageCounts] = useState({
    uploads: 0,
    sessions: 0,
    recordings: 0
  });
  
  const checkUsageLimit = (action: string): boolean => {
    const limits = tier.limits;
    
    switch (action) {
      case 'upload':
        return usageCounts.uploads < limits.maxUploads;
      case 'save_session':
        return usageCounts.sessions < limits.maxSessions;
      case 'record':
        return usageCounts.recordings < limits.maxRecordings;
      default:
        return true;
    }
  };
  
  const incrementUsage = (action: string) => {
    setUsageCounts(prev => ({
      ...prev,
      [action + 's']: prev[action + 's'] + 1
    }));
  };
  
  const getUsagePercentage = (action: string): number => {
    const limits = tier.limits;
    const current = usageCounts[action + 's'];
    const max = limits[`max${action.charAt(0).toUpperCase() + action.slice(1)}s`];
    
    if (max === Infinity) return 0;
    return Math.round((current / max) * 100);
  };
  
  return {
    usageCounts,
    checkUsageLimit,
    incrementUsage,
    getUsagePercentage
  };
};
```

---

## 🧪 Testing Requirements

### Unit Tests
```typescript
describe('Upload / Save / Record / Download Gate', () => {
  describe('UploadButton Component', () => {
    it('should show signup modal for guest users', () => {
      const { getByText } = render(
        <UploadButton onUpload={jest.fn()} />
      );
      
      fireEvent.click(getByText('📁 Upload Track'));
      expect(getByText('Sign up to upload tracks')).toBeInTheDocument();
    });
    
    it('should handle file upload for authenticated users', async () => {
      const mockUpload = jest.fn();
      const { getByText } = render(
        <UploadButton onUpload={mockUpload} />
      );
      
      // Mock file input
      const file = new File(['audio content'], 'test.wav', { type: 'audio/wav' });
      
      // Simulate file selection
      const fileInput = document.querySelector('input[type="file"]');
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(mockUpload).toHaveBeenCalledWith(file);
      });
    });
  });
  
  describe('SaveSessionButton Component', () => {
    it('should show upgrade modal when limit reached', () => {
      const { getByText } = render(
        <SaveSessionButton onSave={jest.fn()} />
      );
      
      // Mock limit reached state
      fireEvent.click(getByText('💾 Save Session'));
      expect(getByText('Upgrade to save more sessions')).toBeInTheDocument();
    });
  });
  
  describe('RecordButton Component', () => {
    it('should be hidden for non-pro users', () => {
      const { queryByText } = render(
        <RecordButton 
          onRecord={jest.fn()} 
          onStop={jest.fn()} 
          isRecording={false} 
        />
      );
      
      expect(queryByText('🎙️ Record Performance')).not.toBeInTheDocument();
    });
  });
  
  describe('DownloadButton Component', () => {
    it('should be completely hidden for non-pro users', () => {
      const { container } = render(
        <DownloadButton onDownload={jest.fn()} />
      );
      
      expect(container.querySelector('.download-button')).not.toBeInTheDocument();
    });
  });
});
```

---

## 📊 Analytics Events

### Gate Interaction Events
```typescript
interface GateInteractionEvents {
  'upload_button_clicked': { userTier: string; canUpload: boolean };
  'save_button_clicked': { userTier: string; canSave: boolean; limitReached: boolean };
  'record_button_clicked': { userTier: string; canRecord: boolean };
  'download_button_clicked': { userTier: string; canDownload: boolean };
  'upgrade_modal_shown': { feature: string; userTier: string };
  'usage_limit_reached': { action: string; userTier: string; limit: number };
  'track_uploaded': { fileName: string; fileSize: number; fileType: string; userTier: string };
  'session_saved': { sessionName?: string; userTier: string; isModified: boolean };
  'recording_started': { userTier: string };
  'recording_stopped': { userTier: string };
  'recording_downloaded': { fileName?: string; format: string; userTier: string };
}
```

---

## 🚀 Success Criteria

- [ ] Upload button triggers signup modal for guest users
- [ ] Save session button shows appropriate states (locked/limit-reached)
- [ ] Record button is hidden for non-pro users
- [ ] Download button is completely hidden for non-pro users
- [ ] Usage limits are enforced for free users
- [ ] Upgrade modals show relevant benefits and pricing
- [ ] File validation works correctly for uploads
- [ ] Analytics events track all gate interactions
- [ ] Post-signup actions resume user intent
- [ ] UI provides clear feedback for all states

---

## 🔄 Dependencies & Integration

### Input Dependencies
- PRD 2: Feature Gating Architecture (for gating hooks)
- PRD 3: Signup Flow & Modal Triggers (for signup modal)

### Output Dependencies
- PRD 6: Analytics & Funnel Tracking (for gate event tracking)
- PRD 9: Post-Signup Experience Continuity (for action resumption)

### Integration Points
- `useUserTier` hook for access control
- `useAccessControl` hook for feature permissions
- `showSignupModal` for guest user conversion
- `showUpgradeModal` for free user upgrades
- File upload and storage services
- Session management system
- Recording and export functionality
- Analytics service for conversion tracking 