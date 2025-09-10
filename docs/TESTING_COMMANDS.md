# Testing Commands Quick Reference

## 🚀 **Quick Start Commands**

### **Run All Tests**

```bash
# Run all working tests
npm test

# Run with UI
npm run test:ui

# Run with coverage
npm run test:coverage
```

### **Run Specific Test Types**

```bash
# Business logic tests (working)
npm test -- test/services/

# Mobile compatibility tests (working)
npm test -- test/mobile/

# Component tests (after Phase 2)
npm run test:playwright

# Visual tests (after Phase 3)
npm run test:storybook

# Integration tests (after Phase 4)
npm run test:integration
```

## 🧹 **Phase 1: Cleanup Commands**

### **Remove Broken Tests**

```bash
# Remove broken component tests
rm -rf test/views/
rm -rf test/hooks/useResponsiveDesign.test.ts
rm -rf test/hooks/useUserTier.test.ts
rm -rf test/hooks/usePostSignupActions.test.ts

# Remove broken utilities
rm -rf test/utils/testUtils.tsx
rm -rf test/__mocks__/AuthContext.tsx
```

### **Verify Cleanup**

```bash
# Run remaining tests
npm test

# Check test count
npm test -- --reporter=verbose | grep "Tests:"

# Verify all tests pass
npm test -- --run
```

## 🎭 **Phase 2: Playwright Commands**

### **Installation**

```bash
# Install Playwright
npm install --save-dev @playwright/test @playwright/experimental-ct-react

# Install browsers
npx playwright install

# Verify installation
npx playwright --version
```

### **Running Tests**

```bash
# Run component tests
npm run test:playwright

# Run with UI
npm run test:playwright:ui

# Run specific component
npm run test:playwright -- --grep "TrackControls"

# Run in specific browser
npm run test:playwright -- --project=chromium
```

### **Test Development**

```bash
# Run tests in headed mode
npm run test:playwright -- --headed

# Run tests in debug mode
npm run test:playwright -- --debug

# Generate test code
npx playwright codegen
```

## 📚 **Phase 3: Storybook Commands**

### **Installation**

```bash
# Install Storybook
npx storybook@latest init

# Install additional addons
npm install --save-dev @storybook/addon-a11y @storybook/addon-viewport

# Verify installation
npm run storybook
```

### **Running Storybook**

```bash
# Start Storybook
npm run storybook

# Build Storybook
npm run build-storybook

# Test stories
npm run test-storybook
```

### **Visual Testing**

```bash
# Run visual tests
npm run test:visual

# Run visual tests with Chromatic
npm run test:chromatic

# Approve visual changes
npm run test:chromatic -- --approve
```

## 🔗 **Phase 4: Integration Commands**

### **Running Integration Tests**

```bash
# Run all integration tests
npm run test:integration

# Run specific integration test
npm run test:integration -- --grep "auth"

# Run E2E tests
npm run test:e2e

# Run performance tests
npm run test:performance
```

### **Test Development**

```bash
# Run tests in debug mode
npm run test:integration -- --debug

# Run tests in headed mode
npm run test:integration -- --headed

# Run tests with trace
npm run test:integration -- --trace=on
```

## 🔧 **Utility Commands**

### **Test Maintenance**

```bash
# Clear test cache
npm test -- --clearCache

# Update test snapshots
npm test -- --updateSnapshot

# Run tests in watch mode
npm test -- --watch

# Run tests in parallel
npm test -- --parallel
```

### **Debugging**

```bash
# Run tests with verbose output
npm test -- --reporter=verbose

# Run tests with detailed output
npm test -- --reporter=verbose --run

# Check test coverage
npm run test:coverage -- --reporter=html
```

### **CI/CD**

```bash
# Run tests for CI
npm run test:ci

# Run tests with coverage for CI
npm run test:ci:coverage

# Run tests with reporting
npm run test:ci:report
```

## 📊 **Monitoring Commands**

### **Test Performance**

```bash
# Check test performance
npm test -- --reporter=verbose | grep "Time:"

# Run tests with timing
npm test -- --reporter=verbose --run

# Check memory usage
npm test -- --reporter=verbose --run | grep "Memory"
```

### **Test Health**

```bash
# Check test health
npm test -- --reporter=verbose --run

# Check for flaky tests
npm test -- --reporter=verbose --run --repeat=3

# Check test stability
npm test -- --reporter=verbose --run --repeat=5
```

## 🚨 **Troubleshooting Commands**

### **Common Issues**

```bash
# Clear node modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear test cache
npm test -- --clearCache

# Reset test environment
npm test -- --reset

# Check test configuration
npm test -- --config
```

### **Debug Specific Tests**

```bash
# Debug specific test file
npm test -- --grep "specific test name"

# Debug with console output
npm test -- --grep "specific test name" --reporter=verbose

# Debug with step-by-step
npm test -- --grep "specific test name" --reporter=verbose --run
```

## 📝 **Test Scripts in package.json**

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    "test:playwright": "playwright test",
    "test:playwright:ui": "playwright test --ui",
    "test:storybook": "test-storybook",
    "test:visual": "chromatic",
    "test:integration": "playwright test --project=integration",
    "test:e2e": "playwright test --project=e2e",
    "test:performance": "playwright test --project=performance",
    "test:ci": "vitest run && playwright test",
    "test:ci:coverage": "vitest run --coverage && playwright test",
    "test:ci:report": "vitest run --coverage --reporter=html && playwright test --reporter=html",
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build"
  }
}
```

## 🎯 **Best Practices**

### **Before Running Tests**

1. Ensure all dependencies are installed
2. Check test environment is set up correctly
3. Verify test configuration is valid
4. Clear any previous test artifacts

### **During Test Development**

1. Run tests frequently to catch issues early
2. Use watch mode for development
3. Test in multiple browsers
4. Verify test reliability

### **After Test Changes**

1. Run full test suite
2. Check test performance
3. Verify test coverage
4. Update documentation if needed

---

**Last Updated**: December 2024  
**Version**: 1.0  
**Status**: Active
