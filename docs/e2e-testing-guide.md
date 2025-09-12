# End-to-End Testing Guide

## Overview

This guide covers the end-to-end testing strategy for Audafact, focusing on complete user journeys and real-world scenarios.

## Test Structure

### Directory Organization

```
tests/playwright/
├── e2e/
│   ├── complete-user-journey.spec.ts
│   ├── onboarding-flow.spec.ts
│   ├── recording-workflow.spec.ts
│   └── performance-workflow.spec.ts
└── integration/
    └── test-utils.ts
```

## Test Categories

### 1. Complete User Journey Tests

Tests the entire user experience from start to finish:

**Key Scenarios:**

- New user signup to first recording
- Existing user login to recording session
- User journey with errors and recovery
- User journey with network interruptions
- User journey with session timeout
- User journey with offline mode

**Test File:** `complete-user-journey.spec.ts`

### 2. Onboarding Flow Tests

Tests the complete onboarding experience:

**Key Scenarios:**

- Full onboarding flow completion
- Onboarding step skipping
- Onboarding error handling
- Onboarding progress tracking
- Onboarding navigation
- Onboarding tips and hints
- Onboarding for existing users

**Test File:** `onboarding-flow.spec.ts`

### 3. Recording Workflow Tests

Tests the complete recording workflow:

**Key Scenarios:**

- Recording creation to playback
- Recording with cue points
- Recording export and sharing
- Recording collaboration
- Recording error recovery

**Test File:** `recording-workflow.spec.ts`

### 4. Performance Workflow Tests

Tests performance-related workflows:

**Key Scenarios:**

- Dashboard performance monitoring
- Analytics data visualization
- Performance optimization
- Resource usage tracking

**Test File:** `performance-workflow.spec.ts`

## Test Scenarios

### Complete User Journey

```typescript
test("should complete full user journey from signup to recording", async ({
  page,
}) => {
  // Step 1: Sign up
  await page.goto("/auth");
  await page.click('[data-testid="signup-tab"]');
  await page.fill('[data-testid="email-input"]', "newuser@example.com");
  await page.fill('[data-testid="password-input"]', "password123");
  await page.check('[data-testid="terms-checkbox"]');
  await page.click('[data-testid="signup-button"]');

  // Step 2: Complete onboarding
  await testUtils.expectElementVisible('[data-testid="onboarding-welcome"]');
  await page.click('[data-testid="onboarding-next"]');
  // ... continue through onboarding steps

  // Step 3: Create first recording
  await page.goto("/studio");
  await page.click('[data-testid="new-recording-button"]');
  await page.fill('[data-testid="recording-name-input"]', "My First Recording");
  await page.click('[data-testid="create-recording-button"]');

  // Step 4: Record audio
  await page.click('[data-testid="record-button"]');
  await testUtils.expectElementVisible('[data-testid="recording-active"]');
  await page.waitForTimeout(2000);
  await page.click('[data-testid="stop-button"]');

  // Step 5: Play back recording
  await page.click('[data-testid="play-button"]');
  await testUtils.expectElementVisible('[data-testid="audio-playing"]');
  await page.waitForTimeout(1000);
  await page.click('[data-testid="pause-button"]');

  // Step 6: Add cue points
  await page.click('[data-testid="waveform"]', { position: { x: 150, y: 50 } });
  await page.click('[data-testid="add-cue-button"]');
  await page.fill('[data-testid="cue-label-input"]', "Verse 1");
  await page.click('[data-testid="save-cue-button"]');

  // Step 7: View performance dashboard
  await page.click('[data-testid="dashboard-link"]');
  await testUtils.expectElementVisible('[data-testid="dashboard-loaded"]');

  // Step 8: Update user preferences
  await page.click('[data-testid="preferences-tab"]');
  await page.selectOption('[data-testid="theme-select"]', "dark");
  await page.click('[data-testid="save-preferences"]');

  // Step 9: Log out
  await page.click('[data-testid="user-menu"]');
  await page.click('[data-testid="logout-button"]');
  await page.click('[data-testid="confirm-logout"]');

  // Verify logout success
  await expect(page).toHaveURL("/auth");
});
```

### Error Handling Scenarios

```typescript
test("should handle user journey with errors gracefully", async ({ page }) => {
  // Mock signup with email verification required
  await testUtils.mockApiResponse("**/auth/signup", {
    success: true,
    message: "Please check your email to verify your account",
    requiresVerification: true,
  });

  // Step 1: Sign up
  await page.goto("/auth");
  await page.click('[data-testid="signup-tab"]');
  await page.fill('[data-testid="email-input"]', "newuser@example.com");
  await page.fill('[data-testid="password-input"]', "password123");
  await page.check('[data-testid="terms-checkbox"]');
  await page.click('[data-testid="signup-button"]');

  // Verify verification message
  await testUtils.expectElementVisible('[data-testid="verification-message"]');
  await testUtils.expectElementText(
    '[data-testid="verification-message"]',
    "Please check your email to verify your account"
  );

  // Mock verification success
  await testUtils.mockApiResponse("**/auth/verify", {
    success: true,
    user: { id: "verified-user-id", email: "newuser@example.com" },
    token: "mock-jwt-token",
  });

  // Step 2: Verify email
  await page.goto("/auth/verify?token=mock-verification-token");
  await testUtils.expectElementVisible('[data-testid="verification-success"]');

  // Step 3: Continue to app
  await page.click('[data-testid="continue-to-app"]');
  await testUtils.expectElementVisible('[data-testid="user-menu"]');
});
```

### Network Interruption Scenarios

```typescript
test("should handle user journey with network interruptions", async ({
  page,
}) => {
  await testUtils.login();

  // Mock network error for recording creation
  await page.route("**/recordings", (route) => {
    route.abort("Failed");
  });

  // Step 1: Try to create recording
  await page.goto("/studio");
  await page.click('[data-testid="new-recording-button"]');
  await page.fill('[data-testid="recording-name-input"]', "Test Recording");
  await page.click('[data-testid="create-recording-button"]');

  // Verify error handling
  await testUtils.expectElementVisible('[data-testid="error-message"]');
  await testUtils.expectElementText(
    '[data-testid="error-message"]',
    "Network error. Please try again."
  );

  // Step 2: Retry after network is back
  await page.unroute("**/recordings");
  await testUtils.mockApiResponse("**/recordings", {
    success: true,
    recording: { id: "recording-123", name: "Test Recording" },
  });

  await page.click('[data-testid="retry-button"]');
  await testUtils.expectElementVisible('[data-testid="recording-created"]');
});
```

## Running E2E Tests

### Run All E2E Tests

```bash
npm run test:e2e
```

### Run Specific Test File

```bash
npx playwright test tests/playwright/e2e/complete-user-journey.spec.ts
```

### Run Tests in Debug Mode

```bash
npx playwright test --debug tests/playwright/e2e/
```

## Test Data Management

### User Journey Data

```typescript
// Complete user journey test data
const userJourneyData = {
  signup: {
    email: "newuser@example.com",
    password: "password123",
    name: "New User",
  },
  onboarding: {
    preferences: {
      sampleRate: 44100,
      bitDepth: 16,
      autoSave: true,
    },
  },
  recording: {
    name: "My First Recording",
    description: "Test recording for E2E testing",
    duration: 120,
  },
  cuePoints: [
    { time: 30, label: "Verse 1" },
    { time: 60, label: "Chorus" },
    { time: 90, label: "Verse 2" },
  ],
};
```

### Error Scenario Data

```typescript
// Error handling test data
const errorScenarios = {
  networkError: {
    message: "Network error. Please try again.",
    retryable: true,
  },
  sessionTimeout: {
    message: "Your session has expired. Please log in again.",
    redirectTo: "/auth",
  },
  validationError: {
    message: "Please check your input and try again.",
    fields: ["email", "password"],
  },
};
```

## Best Practices

### 1. Test Organization

- Group related scenarios in the same file
- Use descriptive test names that explain the scenario
- Follow the Given-When-Then pattern

### 2. Test Data

- Use realistic test data
- Keep test data consistent across tests
- Clean up test data after each test

### 3. Assertions

- Verify each step of the user journey
- Test both success and failure paths
- Check for proper error handling

### 4. Performance

- Keep tests focused on user journeys
- Use appropriate waits and timeouts
- Avoid unnecessary delays

### 5. Maintenance

- Update tests when user journeys change
- Remove obsolete test scenarios
- Keep test utilities up to date

## Debugging E2E Tests

### Running Tests in Debug Mode

```bash
npx playwright test --debug tests/playwright/e2e/complete-user-journey.spec.ts
```

### Viewing Test Results

```bash
npm run test:report
```

### Screenshots and Videos

- Screenshots are taken at each step
- Videos are recorded for the entire journey
- Traces are available for detailed debugging

## Continuous Integration

### GitHub Actions

E2E tests run automatically on:

- Pull requests
- Main branch pushes
- Release tags

### Test Reports

- HTML reports with step-by-step screenshots
- JSON reports for CI integration
- JUnit reports for test result parsing

## Troubleshooting

### Common Issues

1. **Test Timeouts**

   - Increase timeout values for long journeys
   - Check for slow operations
   - Verify network conditions

2. **Element Not Found**

   - Check selector accuracy
   - Verify element visibility
   - Add appropriate waits

3. **Test Flakiness**

   - Use stable selectors
   - Add proper waits
   - Check for race conditions

4. **Performance Issues**
   - Optimize test data
   - Reduce test complexity
   - Use parallel execution

### Getting Help

- Check test logs for error details
- Use Playwright Inspector for debugging
- Review test documentation
- Ask team members for assistance
