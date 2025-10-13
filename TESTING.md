# Testing Guide

This document explains how to run Scalebox SDK tests, especially how to run tests in directory hierarchy order to avoid backend concurrency limitations.

## Test Directory Structure

```
tests/
├── api/                    # API basic tests (no sandbox dependency)
├── code_interpreter/       # Code interpreter tests (lightweight)
├── desktop/               # Desktop application tests (medium complexity)
├── sandbox/               # Sandbox tests (most complex, requires sandbox resources)
└── integration/           # Integration tests (end-to-end)
```

## Running Tests

### 1. Run All Tests (Concurrent, may encounter backend limitations)

```bash
# Run all tests
pnpm test

# Run specific directory tests
pnpm test:api
pnpm test:code-interpreter
pnpm test:desktop
pnpm test:sandbox
pnpm test:integration
```

### 2. Run Tests in Directory Hierarchy Order (Recommended)

To avoid backend concurrency limitations, it is recommended to run tests in the following order:

#### Using npm-run-all (Simple Way)

```bash
# Run all test directories (including integration tests)
pnpm test:sequential

# Skip integration tests
pnpm test:sequential:no-integration
```

#### Using Bash Script (Recommended)

```bash
# Run all test directories (including integration tests)
pnpm test:sequential:script

# Skip integration tests
pnpm test:sequential:script:no-integration

# Or run script directly
./scripts/run-tests-sequential.sh
./scripts/run-tests-sequential.sh --no-integration
```

#### Using Node.js Script (Cross-platform)

```bash
# Run all test directories (including integration tests)
pnpm test:sequential:node

# Skip integration tests
pnpm test:sequential:node:no-integration

# Or run script directly
node scripts/run-tests-sequential.js
node scripts/run-tests-sequential.js --no-integration
```

## Test Execution Order

Tests are executed in the following order to ensure optimal resource usage:

1. **API Tests** (`tests/api/`) - Basic API functionality tests
2. **Code Interpreter Tests** (`tests/code_interpreter/`) - Lightweight code execution tests
3. **Desktop Application Tests** (`tests/desktop/`) - Desktop automation tests
4. **Sandbox Tests** (`tests/sandbox/`) - Sandbox environment tests (most complex)
5. **Integration Tests** (`tests/integration/`) - End-to-end tests

## Environment Variables

### Required Environment Variables

```bash
# Scalebox API key
export SCALEBOX_API_KEY="your-api-key-here"
```

### Optional Environment Variables

```bash
# Enable debug mode
export SCALEBOX_DEBUG=1

# Enable integration tests
export SCALEBOX_INTEGRATION_TEST=1
```

## Test Configuration

Test configuration is defined in `vitest.config.ts`:

- **Test timeout**: 5 minutes (suitable for sandbox operations)
- **Environment**: Node.js
- **Setup file**: `tests/setup.ts`

## Troubleshooting

### Common Issues

1. **Backend Concurrency Limitations**
   - Use sequential test runner: `pnpm test:sequential:node`
   - Avoid running multiple test directories simultaneously

2. **Insufficient Sandbox Resources**
   - Ensure API key is valid
   - Check network connection
   - Use `--no-integration` to skip integration tests

3. **Test Timeout**
   - Check network connection
   - Ensure API key is valid
   - Consider increasing timeout duration

### Debug Mode

```bash
# Run tests with debug mode enabled
SCALEBOX_DEBUG=1 pnpm test:sequential:node
```

## Continuous Integration

In CI/CD environments, it is recommended to use:

```bash
# Production environment tests (skip integration tests)
pnpm test:sequential:node:no-integration

# Complete tests (including integration tests)
pnpm test:sequential:node
```

## Performance Optimization

1. **Parallel Execution**: Tests can run in parallel within the same test directory
2. **Sequential Execution**: Different test directories execute sequentially to avoid resource conflicts
3. **Resource Cleanup**: Automatic resource cleanup after each test directory completes
4. **Delayed Execution**: 2-second delay between test directories to ensure resources are fully released

## Monitoring and Reporting

Test runner provides detailed execution reports:

- ✅ Passed test directories
- ❌ Failed test directories
- ⏱️ Execution time statistics
- 📊 Overall test results

When failures occur, specific failed directories are displayed for quick issue identification.
