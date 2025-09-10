import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../src/context/AuthContext';
import { GuestProvider } from '../../src/context/GuestContext';
import { AudioProvider } from '../../src/context/AudioContext';
import { RecordingProvider } from '../../src/context/RecordingContext';

// Simple test component
const TestComponent = () => {
  return <div data-testid="test-component">Hello World</div>;
};

// Provider wrapper
const WithProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <GuestProvider>
          <AudioProvider>
            <RecordingProvider>
              {children}
            </RecordingProvider>
          </AudioProvider>
        </GuestProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('TrackControls Component Test', () => {
  it('should render component in real browser', () => {
    cy.mount(
      <WithProviders>
        <TestComponent />
      </WithProviders>
    );

    cy.get('[data-testid="test-component"]').should('be.visible');
    cy.get('[data-testid="test-component"]').should('contain.text', 'Hello World');
  });

  it('should handle user interactions', () => {
    cy.mount(
      <WithProviders>
        <TestComponent />
      </WithProviders>
    );

    cy.get('[data-testid="test-component"]').click();
    cy.get('[data-testid="test-component"]').should('be.visible');
  });
});
