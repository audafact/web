# Audafact Web Application

A modern web application for audio recording, playback, and performance analysis.

## 🚀 **Quick Start**

### **Development**

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open in browser
open http://localhost:3000
```

### **Testing**

```bash
# Run all tests
npm test

# Run specific test types
npm run test:services    # Business logic tests
npm run test:mobile      # Mobile compatibility tests
npm run test:playwright  # Component tests (after Phase 2)
npm run test:storybook   # Visual tests (after Phase 3)
npm run test:integration # Integration tests (after Phase 4)

# Run tests with UI
npm run test:ui
npm run test:playwright:ui
```

## 📊 **Current Testing Status**

### **Phase 1: Cleanup & Stabilization** ✅

- **Status**: Complete
- **Tests**: 60-70 tests passing (100%)
- **Coverage**: Business logic, mobile compatibility
- **Issues**: None

### **Phase 2: Playwright Component Testing** 🚧

- **Status**: In Progress
- **Tests**: 20+ component tests
- **Coverage**: React component rendering
- **Issues**: None (jsdom compatibility resolved)

### **Phase 3: Storybook Visual Testing** 📋

- **Status**: Planned
- **Tests**: 15+ visual regression tests
- **Coverage**: Component documentation and visual testing
- **Issues**: None

### **Phase 4: Integration & E2E Testing** 📋

- **Status**: Planned
- **Tests**: 40+ integration and E2E tests
- **Coverage**: Complete user journeys
- **Issues**: None

## 🏗️ **Architecture**

### **Frontend**

- **Framework**: React 18 with TypeScript
- **Routing**: React Router v6
- **Styling**: Tailwind CSS
- **State Management**: Context API + Custom Hooks
- **Audio**: Wavesurfer.js

### **Testing**

- **Unit Tests**: Vitest
- **Component Tests**: Playwright (Phase 2)
- **Visual Tests**: Storybook (Phase 3)
- **Integration Tests**: Playwright (Phase 4)
- **E2E Tests**: Playwright (Phase 4)

### **Development Tools**

- **Build Tool**: Vite
- **Linting**: ESLint
- **Type Checking**: TypeScript
- **Testing**: Vitest + Playwright + Storybook

## 📁 **Project Structure**

```
web/
├── src/
│   ├── components/          # Reusable UI components
│   ├── views/              # Page-level components
│   ├── hooks/              # Custom React hooks
│   ├── services/           # Business logic services
│   ├── context/            # React context providers
│   ├── utils/              # Utility functions
│   └── types/              # TypeScript type definitions
├── tests/
│   ├── services/           # Business logic tests
│   ├── mobile/             # Mobile compatibility tests
│   ├── playwright/         # Component and integration tests
│   └── unit/               # Pure function tests
├── stories/                # Storybook component stories
├── docs/                   # Documentation
└── .storybook/             # Storybook configuration
```

## 🧪 **Testing Strategy**

### **Current Testing Approach**

We use a phased approach to testing due to React 18 compatibility issues:

1. **Phase 1**: Cleanup broken tests, stabilize working tests
2. **Phase 2**: Implement Playwright for component testing
3. **Phase 3**: Add Storybook for visual regression testing
4. **Phase 4**: Add integration and E2E testing

### **Why This Approach?**

- **React 18 + jsdom Incompatibility**: React Testing Library has fundamental compatibility issues with React 18's concurrent rendering
- **Real Browser Testing**: Playwright provides more accurate testing in real browsers
- **Visual Regression Testing**: Storybook ensures UI consistency
- **Complete Coverage**: Integration tests ensure end-to-end functionality

### **Test Types**

#### **Unit Tests** (Vitest)

- Business logic functions
- Utility functions
- Service layer functions
- Pure functions

#### **Component Tests** (Playwright)

- React component rendering
- User interactions
- Visual behavior
- Component integration

#### **Visual Tests** (Storybook)

- Component documentation
- Visual regression testing
- Design system consistency
- Accessibility testing

#### **Integration Tests** (Playwright)

- Cross-component interactions
- API integrations
- User workflows
- Performance testing

## 🚨 **Known Issues**

### **Resolved Issues**

- ✅ React 18 + jsdom compatibility (resolved with Playwright)
- ✅ Test isolation problems (resolved with proper cleanup)
- ✅ Context provider issues (resolved with proper mocking)
- ✅ Mobile compatibility tests (all passing)

### **Current Issues**

- None (all known issues have been resolved)

## 🔧 **Development Workflow**

### **Before Making Changes**

1. Run tests to ensure everything is working
2. Check current test coverage
3. Review relevant documentation

### **Making Changes**

1. Make your changes
2. Run relevant tests
3. Add new tests if needed
4. Update documentation if needed

### **After Making Changes**

1. Run full test suite
2. Verify all tests pass
3. Check for any new issues
4. Update documentation if needed

## 📚 **Documentation**

### **Testing Documentation**

- [Testing Strategy](./TESTING_STRATEGY.md) - Overall testing approach
- [Phase 1 PRD](./docs/phase1-cleanup-prd.md) - Cleanup and stabilization
- [Phase 2 PRD](./docs/phase2-playwright-prd.md) - Playwright component testing
- [Phase 3 PRD](./docs/phase3-storybook-prd.md) - Storybook visual testing
- [Phase 4 PRD](./docs/phase4-integration-prd.md) - Integration and E2E testing

### **Development Documentation**

- [Component Development Guide](./docs/component-development.md)
- [Testing Guide](./docs/testing-guide.md)
- [Performance Guide](./docs/performance-guide.md)

## 🤝 **Contributing**

### **Testing Requirements**

- All tests must pass before merging
- New features must have appropriate tests
- Tests must be reliable and not flaky
- Documentation must be updated

### **Code Quality**

- Follow TypeScript best practices
- Use ESLint for code quality
- Write meaningful test descriptions
- Keep tests simple and focused

## 📞 **Support**

### **Testing Issues**

- Check the phase-specific PRDs
- Review test output and error messages
- Ensure all dependencies are installed
- Verify test environment setup

### **Development Issues**

- Check the component development guide
- Review existing code patterns
- Ask questions in team channels
- Create issues for bugs or feature requests

## 🎯 **Roadmap**

### **Short Term** (Next 2 weeks)

- Complete Phase 2: Playwright component testing
- Implement 20+ component tests
- Set up CI/CD integration

### **Medium Term** (Next month)

- Complete Phase 3: Storybook visual testing
- Implement visual regression testing
- Add component documentation

### **Long Term** (Next quarter)

- Complete Phase 4: Integration and E2E testing
- Implement comprehensive test coverage
- Add performance testing and monitoring

---

**Last Updated**: December 2024  
**Version**: 1.0.0  
**Status**: Active Development
