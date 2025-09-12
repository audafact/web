# Phase 2: Playwright Component Testing PRD

## 📋 **Product Requirements Document**

**Phase**: 2 - Playwright Component Testing  
**Duration**: 1 week  
**Priority**: High  
**Status**: Ready to Start (after Phase 1)

## 🎯 **Objective**

Replace React Testing Library with Playwright for component testing, providing real browser testing environment and eliminating jsdom compatibility issues.

## 📊 **Current State**

### **After Phase 1**

- **Working Tests**: ~60-70 tests (100% passing)
- **Missing**: Component rendering tests
- **Gap**: No way to test React components in isolation

### **Problem Statement**

- React Testing Library + jsdom is fundamentally incompatible with React 18
- Need component testing solution that works with React 18
- Must test user interactions and visual behavior
- Need real browser environment for accurate testing

## 🎯 **Success Criteria**

### **Primary Goals**

- [ ] 20+ component tests passing
- [ ] Real browser testing environment working
- [ ] No jsdom compatibility issues
- [ ] Component interaction testing functional

### **Quality Metrics**

- [ ] Tests run in real browsers (Chrome, Firefox, Safari)
- [ ] Visual behavior testing working
- [ ] User interaction testing functional
- [ ] Component isolation testing working

## 📝 **Detailed Requirements**

### **1. Playwright Setup**

**Dependencies to Install:**

```json
{
  "devDependencies": {
    "@playwright/test": "^1.44.0",
    "@playwright/experimental-ct-react": "^1.44.0"
  }
}
```

**Configuration Files:**

- `playwright.config.ts` - Main Playwright configuration
- `playwright-ct.config.ts` - Component testing configuration
- `tests/playwright/` - Test directory structure

### **2. Component Test Structure**

**Directory Structure:**

```
tests/playwright/
├── components/
│   ├── TrackControls.spec.ts
│   ├── OnboardingWalkthrough.spec.ts
│   ├── PerformanceDashboard.spec.ts
│   ├── SignupModal.spec.ts
│   └── WaveformDisplay.spec.ts
├── integration/
│   └── user-flows.spec.ts
└── fixtures/
    └── test-data.ts
```

### **3. Component Test Requirements**

**TrackControls Component:**

- [ ] Renders play/pause button correctly
- [ ] Handles volume changes
- [ ] Handles speed changes
- [ ] Handles loop toggle
- [ ] Handles cue point interactions
- [ ] Handles track selection

**OnboardingWalkthrough Component:**

- [ ] Renders step indicators
- [ ] Handles step navigation
- [ ] Handles skip functionality
- [ ] Handles completion flow

**PerformanceDashboard Component:**

- [ ] Renders performance metrics
- [ ] Handles data updates
- [ ] Handles user interactions
- [ ] Handles responsive behavior

**SignupModal Component:**

- [ ] Renders form fields correctly
- [ ] Handles form validation
- [ ] Handles form submission
- [ ] Handles modal open/close

**WaveformDisplay Component:**

- [ ] Renders waveform visualization
- [ ] Handles audio playback controls
- [ ] Handles zoom/pan interactions
- [ ] Handles cue point markers

### **4. Test Types to Implement**

**Rendering Tests:**

- Component renders without errors
- Correct props are applied
- Conditional rendering works
- Error boundaries function

**Interaction Tests:**

- Button clicks work
- Form inputs function
- Keyboard navigation works
- Touch gestures work (mobile)

**Visual Tests:**

- Components look correct
- Responsive behavior works
- Animations function
- Loading states display

**Integration Tests:**

- Components work with context providers
- Event handling works
- State updates correctly
- Side effects execute

## 🛠️ **Implementation Tasks**

### **Task 1: Playwright Installation & Setup**

```bash
# Install Playwright
npm install --save-dev @playwright/test @playwright/experimental-ct-react

# Install browsers
npx playwright install

# Create configuration files
# Set up test directory structure
```

### **Task 2: Component Test Creation**

- Create test files for each component
- Implement basic rendering tests
- Add interaction tests
- Add visual tests

### **Task 3: Test Utilities & Helpers**

- Create test utilities for common operations
- Set up test data fixtures
- Create component wrappers for context providers
- Set up test environment configuration

### **Task 4: CI/CD Integration**

- Update GitHub Actions for Playwright
- Set up test reporting
- Configure test artifacts
- Set up test parallelization

## 📊 **Expected Outcomes**

### **Test Coverage**

- **Component Tests**: 20+ tests
- **Interaction Tests**: 15+ tests
- **Visual Tests**: 10+ tests
- **Integration Tests**: 5+ tests
- **Total**: 50+ tests

### **Browser Coverage**

- **Chrome**: All tests
- **Firefox**: All tests
- **Safari**: All tests
- **Mobile**: Key tests

### **Performance**

- **Test Runtime**: < 2 minutes
- **Parallel Execution**: 4 workers
- **Artifact Generation**: Screenshots, videos, traces

## 🚨 **Risks & Mitigation**

### **Risk 1: Playwright Learning Curve**

- **Mitigation**: Start with simple tests, gradually add complexity
- **Fallback**: Use Playwright documentation and examples

### **Risk 2: Component Context Dependencies**

- **Mitigation**: Create proper test wrappers with context providers
- **Fallback**: Mock context providers for isolated testing

### **Risk 3: Test Flakiness**

- **Mitigation**: Use proper waits and assertions
- **Fallback**: Implement retry logic and better error handling

### **Risk 4: Performance Issues**

- **Mitigation**: Optimize test execution, use parallelization
- **Fallback**: Reduce test scope, focus on critical tests

## ✅ **Acceptance Criteria**

### **Must Have**

- [ ] Playwright installed and configured
- [ ] 20+ component tests passing
- [ ] Tests run in real browsers
- [ ] No jsdom compatibility issues

### **Should Have**

- [ ] Visual testing working
- [ ] User interaction testing functional
- [ ] Test reporting and artifacts
- [ ] CI/CD integration working

### **Could Have**

- [ ] Mobile testing
- [ ] Accessibility testing
- [ ] Performance testing
- [ ] Visual regression testing

## 📅 **Timeline**

### **Day 1-2: Setup**

- [ ] Install Playwright
- [ ] Create configuration files
- [ ] Set up test directory structure
- [ ] Create basic test utilities

### **Day 3-4: Component Tests**

- [ ] Create TrackControls tests
- [ ] Create OnboardingWalkthrough tests
- [ ] Create PerformanceDashboard tests
- [ ] Create SignupModal tests

### **Day 5: Advanced Testing**

- [ ] Create WaveformDisplay tests
- [ ] Add integration tests
- [ ] Add visual tests
- [ ] Add mobile tests

### **Day 6-7: Polish & Integration**

- [ ] CI/CD integration
- [ ] Test reporting
- [ ] Performance optimization
- [ ] Documentation

## 🔍 **Testing Strategy**

### **Test Development Approach**

1. Start with simple rendering tests
2. Add basic interaction tests
3. Add visual behavior tests
4. Add integration tests
5. Add mobile-specific tests

### **Quality Assurance**

- Test in multiple browsers
- Verify test reliability
- Check test performance
- Validate test coverage

## 📚 **Documentation Updates**

### **Files to Create**

- `docs/playwright-setup.md` - Playwright setup guide
- `docs/component-testing-guide.md` - How to write component tests
- `docs/test-utilities.md` - Test utilities documentation

### **Files to Update**

- `README.md` - Add Playwright test instructions
- `TESTING_STRATEGY.md` - Update current state
- `package.json` - Add Playwright scripts

## 🎯 **Success Definition**

**Phase 2 is complete when:**

- Playwright is fully configured and working
- 20+ component tests are passing consistently
- Tests run in real browsers without issues
- Component interaction testing is functional
- Foundation is set for Phase 3 (Storybook)

---

**Next Phase**: [Phase 3: Storybook Visual Testing](./phase3-storybook-prd.md)
