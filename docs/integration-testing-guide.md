# Integration Testing Guide

## Overview

This guide covers the integration testing strategy for Audafact, focusing on testing cross-component interactions and complete feature workflows.

## Test Structure

### Directory Organization

```
tests/playwright/
├── integration/
│   ├── auth/
│   │   ├── login-flow.spec.ts
│   │   ├── signup-flow.spec.ts
│   │   └── logout-flow.spec.ts
│   ├── recording/
│   │   ├── create-recording.spec.ts
│   │   ├── edit-recording.spec.ts
│   │   └── delete-recording.spec.ts
│   ├── playback/
│   │   ├── audio-playback.spec.ts
│   │   ├── waveform-interaction.spec.ts
│   │   └── cue-points.spec.ts
│   ├── dashboard/
│   │   ├── performance-metrics.spec.ts
│   │   ├── data-visualization.spec.ts
│   │   └── user-preferences.spec.ts
│   └── mobile/
│       ├── mobile-navigation.spec.ts
│       ├── touch-interactions.spec.ts
│       └── responsive-layout.spec.ts
└── test-utils.ts
```

## Test Categories

### 1. Authentication Integration Tests

Tests the complete authentication flow including:

- User login with valid/invalid credentials
- User signup with validation
- Session management and persistence
- Error handling and edge cases

**Key Test Files:**

- `auth/login-flow.spec.ts`
- `auth/signup-flow.spec.ts`
- `auth/logout-flow.spec.ts`

### 2. Recording Integration Tests

Tests the complete recording workflow including:

- Recording creation and management
- Audio capture and processing
- File upload and storage
- Metadata handling

**Key Test Files:**

- `recording/create-recording.spec.ts`
- `recording/edit-recording.spec.ts`
- `recording/delete-recording.spec.ts`

### 3. Playback Integration Tests

Tests the audio playback functionality including:

- Audio playback controls
- Waveform interaction
- Cue point management
- Performance optimization

**Key Test Files:**

- `playback/audio-playback.spec.ts`
- `playback/waveform-interaction.spec.ts`
- `playback/cue-points.spec.ts`

### 4. Dashboard Integration Tests

Tests the dashboard and analytics functionality including:

- Performance metrics display
- Data visualization
- User preferences management
- Real-time updates

**Key Test Files:**

- `dashboard/performance-metrics.spec.ts`
- `dashboard/data-visualization.spec.ts`
- `dashboard/user-preferences.spec.ts`

### 5. Mobile Integration Tests

Tests mobile-specific functionality including:

- Touch interactions
- Responsive design
- Mobile navigation
- Performance on mobile devices

**Key Test Files:**

- `mobile/mobile-navigation.spec.ts`
- `mobile/touch-interactions.spec.ts`
- `mobile/responsive-layout.spec.ts`

## Test Utilities

### TestUtils Class

The `TestUtils` class provides common testing utilities:

```typescript
class TestUtils {
  // Authentication helpers
  async login(email: string, password: string);
  async signup(email: string, password: string);
  async logout();

  // Recording helpers
  async createRecording(name: string);
  async startRecording();
  async stopRecording();

  // Playback helpers
  async playAudio();
  async pauseAudio();
  async addCuePoint(time: number);

  // Navigation helpers
  async navigateToDashboard();

  // Assertion helpers
  async expectElementVisible(selector: string);
  async expectElementText(selector: string, text: string);
  async expectElementEnabled(selector: string);
  async expectElementDisabled(selector: string);

  // API helpers
  async mockApiResponse(urlPattern: string, responseData: any);
  async waitForApiResponse(urlPattern: string);

  // Performance helpers
  async getPerformanceMetrics();
  async getMemoryUsage();

  // Mobile helpers
  async setMobileViewport();
  async setTabletViewport();
  async setDesktopViewport();
}
```

## Running Integration Tests

### Run All Integration Tests

```bash
npm run test:integration
```

### Run Specific Test Category

```bash
# Authentication tests
npx playwright test tests/playwright/integration/auth/

# Recording tests
npx playwright test tests/playwright/integration/recording/

# Playback tests
npx playwright test tests/playwright/integration/playback/

# Dashboard tests
npx playwright test tests/playwright/integration/dashboard/

# Mobile tests
npx playwright test tests/playwright/integration/mobile/
```

### Run Specific Test File

```bash
npx playwright test tests/playwright/integration/auth/login-flow.spec.ts
```

## Test Data Management

### Mock Data Strategy

Integration tests use mocked API responses to ensure:

- Consistent test results
- Fast test execution
- Isolation from external dependencies

### Test Data Examples

```typescript
// User data
const mockUser = {
  id: "test-user-id",
  email: "test@example.com",
  name: "Test User",
};

// Recording data
const mockRecording = {
  id: "recording-123",
  name: "Test Recording",
  audioUrl: "https://example.com/audio.mp3",
  duration: 120,
  status: "active",
};

// Performance metrics
const mockMetrics = {
  totalRecordings: 15,
  totalDuration: 3600,
  performanceScore: 85,
};
```

## Best Practices

### 1. Test Organization

- Group related tests in the same file
- Use descriptive test names
- Follow the Arrange-Act-Assert pattern

### 2. Test Data

- Use consistent mock data
- Keep test data minimal but realistic
- Clean up test data after each test

### 3. Assertions

- Use specific assertions
- Test both positive and negative cases
- Verify error handling

### 4. Performance

- Keep tests focused and fast
- Use appropriate waits
- Avoid unnecessary delays

### 5. Maintenance

- Update tests when features change
- Remove obsolete tests
- Keep test utilities up to date

## Debugging Integration Tests

### Running Tests in Debug Mode

```bash
npx playwright test --debug
```

### Viewing Test Results

```bash
npm run test:report
```

### Screenshots and Videos

- Screenshots are taken on test failures
- Videos are recorded for failed tests
- Traces are available for debugging

## Continuous Integration

### GitHub Actions

Integration tests run automatically on:

- Pull requests
- Main branch pushes
- Release tags

### Test Reports

- HTML reports are generated
- JSON reports for CI integration
- JUnit reports for test result parsing

## Troubleshooting

### Common Issues

1. **Test Timeouts**

   - Increase timeout values
   - Check for slow operations
   - Verify network conditions

2. **Element Not Found**

   - Check selector accuracy
   - Verify element visibility
   - Add appropriate waits

3. **API Mocking Issues**

   - Verify URL patterns
   - Check response format
   - Ensure proper setup

4. **Performance Issues**
   - Optimize test data
   - Reduce test complexity
   - Use parallel execution

### Getting Help

- Check test logs for error details
- Use Playwright Inspector for debugging
- Review test documentation
- Ask team members for assistance
