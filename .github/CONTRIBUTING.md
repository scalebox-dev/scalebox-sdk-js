# Contributing to Scalebox SDK

Thank you for your interest in contributing to the Scalebox SDK! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Issue Guidelines](#issue-guidelines)
- [Pull Request Guidelines](#pull-request-guidelines)

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold this code.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/scalebox-sdk-js.git`
3. Create a new branch: `git checkout -b feature/your-feature-name`
4. Make your changes
5. Test your changes
6. Submit a pull request

## Development Setup

### Prerequisites

- Node.js 18+ 
- pnpm (recommended) or npm
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/scalebox-dev/scalebox-sdk-js.git
cd scalebox-sdk-js

# Install dependencies
pnpm install

# Copy environment file
cp env.example .env
```

### Environment Variables

Create a `.env` file with your API credentials:

```bash
# Required
SCALEBOX_API_KEY=your_api_key_here

# Optional
SCALEBOX_API_URL=https://api.scalebox.dev
SCALEBOX_DEBUG=false
```

## Making Changes

### Code Style

- Follow TypeScript best practices
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Follow the existing code style and patterns

### File Structure

```
src/
├── api/              # REST API client
├── code-interpreter/ # Code interpreter functionality
├── desktop/          # Desktop automation
├── grpc/            # gRPC client
├── sandbox/         # Sandbox management
└── index.ts         # Main entry point
```

### Adding New Features

1. Create feature branch: `git checkout -b feature/your-feature`
2. Implement your feature
3. Add tests
4. Update documentation
5. Submit pull request

## Testing

### Running Tests

```bash
# Run all tests
pnpm test

# Run specific test suites
pnpm test:api
pnpm test:code-interpreter
pnpm test:desktop
pnpm test:sandbox

# Run tests sequentially (recommended for CI)
pnpm test:sequential:node:no-integration
```

### Test Structure

- **Unit Tests**: Test individual functions and classes
- **Integration Tests**: Test API interactions
- **End-to-End Tests**: Test complete workflows

### Writing Tests

```typescript
import { describe, it, expect } from 'vitest'
import { Sandbox } from '../src'

describe('Sandbox', () => {
  it('should create a sandbox', async () => {
    const sandbox = await Sandbox.create('code-interpreter')
    expect(sandbox).toBeDefined()
    await sandbox.kill()
  })
})
```

## Submitting Changes

### Commit Messages

Use clear, descriptive commit messages:

```bash
# Good
git commit -m "feat: add support for custom timeouts"
git commit -m "fix: resolve memory leak in sandbox cleanup"
git commit -m "docs: update API documentation"

# Bad
git commit -m "fix stuff"
git commit -m "update"
```

### Pull Request Process

1. **Fork and Clone**: Fork the repository and clone your fork
2. **Create Branch**: Create a feature branch from `main`
3. **Make Changes**: Implement your changes
4. **Add Tests**: Add tests for new functionality
5. **Update Docs**: Update documentation if needed
6. **Test Locally**: Run tests locally
7. **Submit PR**: Create a pull request

### Pull Request Template

Use the provided PR template and fill out all sections:

- Description of changes
- Type of change
- Testing performed
- Checklist completion

## Issue Guidelines

### Bug Reports

When reporting bugs, please include:

- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Environment details
- Code example (if applicable)

### Feature Requests

When requesting features, please include:

- Use case description
- Proposed solution
- Alternative solutions considered
- Code example of desired API

## Pull Request Guidelines

### Before Submitting

- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No breaking changes (unless intentional)
- [ ] All tests pass locally

### Review Process

1. **Automated Checks**: CI/CD pipeline must pass
2. **Code Review**: At least one maintainer review required
3. **Testing**: All tests must pass
4. **Documentation**: Documentation must be updated
5. **Approval**: Maintainer approval required

## Development Workflow

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring

### Release Process

1. **Version Bump**: Update version in `package.json`
2. **Changelog**: Update `CHANGELOG.md`
3. **Tag**: Create git tag for release
4. **Publish**: Automatically published via CI/CD

## Getting Help

- **Documentation**: Check the README and docs
- **Issues**: Search existing issues first
- **Discussions**: Use GitHub Discussions for questions
- **Email**: Contact us at support@scalebox.dev

## Recognition

Contributors will be recognized in:

- CONTRIBUTORS.md file
- Release notes
- Project documentation

Thank you for contributing to Scalebox SDK!
