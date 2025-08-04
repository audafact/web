import React, { useEffect } from 'react';
import SignupModal from './SignupModal';
import { useSignupModal } from '../hooks/useSignupModal';
import { useMessageSystem } from '../hooks/useMessageSystem';
import { MessageDisplay } from './MessageDisplay';
import { usePostSignupActions } from '../hooks/usePostSignupActions';

export const GlobalModalManager: React.FC = () => {
  const { 
    modalState, 
    showSignupModal, 
    closeSignupModal 
  } = useSignupModal();
  
  const { messages, showSuccessMessage, removeMessage } = useMessageSystem();
  
  // Handle post-signup actions
  usePostSignupActions();
  
  useEffect(() => {
    const handleShowSignupModal = (event: CustomEvent) => {
      const { trigger, action } = event.detail;
      showSignupModal(trigger, action);
    };
    
    const handlePostSignupAction = (event: CustomEvent) => {
      const { action } = event.detail;
      
      // Handle different post-signup actions
      switch (action) {
        case 'upload':
          showSuccessMessage('🎉 Welcome! You can now upload your own tracks.');
          break;
          
        case 'save_session':
          showSuccessMessage('💾 Session saved! You can now save unlimited sessions.');
          break;
          
        case 'add_library_track':
          showSuccessMessage('🎵 Browse our full library and add tracks to your studio!');
          break;
          
        case 'edit_cues':
          showSuccessMessage('🎯 You can now customize cue points!');
          break;
          
        case 'edit_loops':
          showSuccessMessage('🔄 You can now set custom loops!');
          break;
          
        case 'record':
          showSuccessMessage('🎙️ Upgrade to Pro Creator to record your performances!');
          break;
          
        case 'download':
          showSuccessMessage('💿 Upgrade to Pro Creator to download your work!');
          break;
          
        default:
          showSuccessMessage('🎉 Welcome to Audafact! Start creating your mixes.');
      }
    };
    
    // Listen for global modal events
    window.addEventListener('showSignupModal', handleShowSignupModal as EventListener);
    window.addEventListener('postSignupAction', handlePostSignupAction as EventListener);
    
    return () => {
      window.removeEventListener('showSignupModal', handleShowSignupModal as EventListener);
      window.removeEventListener('postSignupAction', handlePostSignupAction as EventListener);
    };
  }, [showSignupModal, showSuccessMessage]);
  
  return (
    <>
      {/* Signup Modal */}
      <SignupModal
        isOpen={modalState.isOpen}
        onClose={closeSignupModal}
        trigger={modalState.trigger}
        action={modalState.action}
      />
      
      {/* Message Display */}
      <MessageDisplay 
        messages={messages} 
        onRemove={removeMessage} 
      />
    </>
  );
}; 