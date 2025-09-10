# Visual Regression Testing with Chromatic

This document outlines the visual regression testing setup using Chromatic and Storybook.

## Overview

Visual regression testing automatically captures screenshots of UI components and compares them against baseline images to detect visual changes. This helps catch unintended visual regressions when making code changes.

## Setup

### 1. Chromatic Account

- Sign up for a free Chromatic account at [chromatic.com](https://chromatic.com)
- Create a new project for this repository
- Get your project token from the Chromatic dashboard

### 2. Environment Variables

Add your Chromatic project token to your environment:

```bash
# For local development
export CHROMATIC_PROJECT_TOKEN="your-project-token-here"

# For GitHub Actions
# Add CHROMATIC_PROJECT_TOKEN to your repository secrets
```

### 3. Configuration Files

- **`.chromaticrc.json`**: Chromatic configuration
- **`.github/workflows/visual-regression.yml`**: GitHub Actions workflow
- **`package.json`**: Added `chromatic` script

## Usage

### Running Visual Tests Locally

```bash
# Build Storybook first
npm run build-storybook

# Run Chromatic visual tests
npm run chromatic
```

### Running Visual Tests in CI

Visual regression tests run automatically on:

- Push to `main` or `develop` branches
- Pull requests targeting `main` or `develop` branches

## How It Works

1. **Baseline Creation**: First run creates baseline screenshots
2. **Change Detection**: Subsequent runs compare against baselines
3. **Review Process**: Changes are flagged for review in Chromatic dashboard
4. **Approval**: Approved changes become new baselines

## Test Coverage

Current visual tests cover:

### Components

- **HelpButton**: Interactive help button with tutorial triggers
- **LibraryTrackItem**: Music track display with various states
- **Modal**: Overlay modal with backdrop and close functionality
- **Tooltip**: Comprehensive tooltip with all trigger types and positions
- **ComponentShowcase**: Multi-component display for overview

### Test Scenarios

- Default states
- Interactive states (hover, click, focus)
- Different positions and orientations
- Long content and text wrapping
- Responsive behavior
- Error states

## Best Practices

### 1. Story Organization

- Group related stories logically
- Use descriptive story names
- Include edge cases and error states

### 2. Visual Testing

- Review all visual changes before approving
- Test across different viewport sizes
- Include accessibility considerations

### 3. Maintenance

- Regularly update baselines for intentional changes
- Clean up obsolete stories
- Monitor test performance and reliability

## Troubleshooting

### Common Issues

1. **Build Failures**

   - Ensure Storybook builds successfully locally
   - Check for TypeScript errors
   - Verify all dependencies are installed

2. **Visual Differences**

   - Review changes in Chromatic dashboard
   - Check for timing issues in animations
   - Verify consistent test environment

3. **Token Issues**
   - Verify CHROMATIC_PROJECT_TOKEN is set correctly
   - Check token permissions in Chromatic dashboard

### Debug Commands

```bash
# Test Storybook build locally
npm run build-storybook

# Run Chromatic with verbose output
npx chromatic --debug

# Check Storybook configuration
npm run storybook
```

## Integration with Development Workflow

### Pre-commit

Visual tests run automatically on pull requests, providing immediate feedback on visual changes.

### Code Review

- Review visual changes alongside code changes
- Use Chromatic's diff viewer to inspect changes
- Approve only intentional visual changes

### Release Process

- Ensure all visual tests pass before merging
- Update baselines for intentional design changes
- Document significant visual changes in release notes

## Future Enhancements

- [ ] Add mobile-specific visual tests
- [ ] Integrate with design system tokens
- [ ] Add performance monitoring
- [ ] Expand test coverage to more components
- [ ] Add cross-browser testing
