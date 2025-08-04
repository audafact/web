import React from 'react';
import { showSignupModal } from '../hooks/useSignupModal';

export const SignupModalDemo: React.FC = () => {
  const triggers = [
    'upload',
    'save_session', 
    'add_library_track',
    'edit_cues',
    'edit_loops',
    'record',
    'download'
  ];

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-center">
        Signup Modal Demo
      </h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {triggers.map((trigger) => (
          <button
            key={trigger}
            onClick={() => showSignupModal(trigger)}
            className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow text-left"
          >
            <h3 className="font-semibold text-lg mb-2 capitalize">
              {trigger.replace('_', ' ')}
            </h3>
            <p className="text-gray-600 text-sm">
              Click to show signup modal for {trigger.replace('_', ' ')} feature
            </p>
          </button>
        ))}
      </div>
      
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">How it works:</h3>
        <ul className="text-blue-800 text-sm space-y-1">
          <li>• Each button triggers a different signup modal with contextual messaging</li>
          <li>• The modal shows benefits specific to the triggered feature</li>
          <li>• After signup, users are redirected to complete their intended action</li>
          <li>• Analytics events are tracked for conversion optimization</li>
        </ul>
      </div>
    </div>
  );
}; 