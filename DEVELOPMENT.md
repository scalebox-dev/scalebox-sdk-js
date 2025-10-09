# Development Guide

This document explains how to develop and contribute to the Scalebox JavaScript SDK.

## Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- buf CLI (for gRPC code generation)

## Setup

```bash
# Clone the repository
git clone https://github.com/scalebox-dev/scalebox-sdk-js.git
cd scalebox-sdk-js

# Install dependencies
pnpm install

# Copy environment file
cp env.example .env
```

## Development Workflow

### 1. Code Changes

Make your changes to the source code in `src/` directory.

### 2. gRPC Code Generation

If you modify `.proto` files in `spec/grpc/`, you need to regenerate the gRPC code:

```bash
# Install buf CLI (if not already installed)
npm install -g @bufbuild/buf

# Generate gRPC code
./scripts/generate-grpc.sh
```

This will:
- Generate TypeScript code from Protocol Buffers
- Update `src/generated/api_pb.ts`
- Ensure imports use `.ts` extensions

### 3. Testing

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

### 4. Building

```bash
# Type check
pnpm exec tsc --noEmit

# Build package
pnpm run build

# Verify build output
ls -la dist/
```

## Generated Files

### Why Include Generated Files?

This SDK includes generated gRPC files (`src/generated/api_pb.ts`) in the repository for several reasons:

1. **User Experience**: Users can install and use the SDK immediately without additional setup
2. **Consistency**: All users get the same generated code, avoiding version conflicts
3. **Simplicity**: No need to install buf/protoc or run generation scripts
4. **Official SDK Pattern**: Follows the same pattern as Google gRPC-Node, AWS SDKs, etc.

### When to Regenerate

Regenerate gRPC files when:
- Modifying `.proto` files in `spec/grpc/`
- Updating Protocol Buffer dependencies
- Changing gRPC generation configuration

### Regeneration Process

```bash
# 1. Modify .proto files in spec/grpc/
# 2. Run generation script
./scripts/generate-grpc.sh

# 3. Commit the updated generated files
git add src/generated/
git commit -m "chore: regenerate gRPC code from updated proto files"
```

## Project Structure

```
src/
├── api/              # REST API client
├── code-interpreter/ # Code interpreter functionality
├── desktop/          # Desktop automation
├── generated/        # Generated gRPC files (committed)
├── grpc/            # gRPC client implementation
├── sandbox/         # Sandbox management
└── index.ts         # Main entry point

spec/
├── grpc/            # Protocol Buffer definitions
└── openapi/         # OpenAPI specifications
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Regenerate gRPC files if needed
5. Run tests and build
6. Submit a pull request

## CI/CD

The project uses GitHub Actions for:
- Type checking
- Testing across Node.js versions
- Security auditing
- Building and publishing

See `.github/workflows/ci.yml` for details.

## Troubleshooting

### gRPC Import Errors

If you see "Cannot find module '../generated/api_pb.js'" errors:

1. Check that `src/generated/api_pb.ts` exists
2. Regenerate gRPC files: `./scripts/generate-grpc.sh`
3. Verify `spec/grpc/buf.gen.yaml` has `import_extension=ts`

### Build Failures

```bash
# Clean and rebuild
rm -rf dist/ node_modules/
pnpm install
pnpm run build
```

### Test Failures

```bash
# Run tests with debug info
SCALEBOX_DEBUG=1 pnpm test

# Check environment variables
echo $SCALEBOX_API_KEY
```

## Dependencies

### Core Dependencies
- `@bufbuild/protobuf` - Protocol Buffers
- `@connectrpc/connect` - gRPC client
- `openapi-fetch` - REST API client

### Development Dependencies
- `typescript` - TypeScript compiler
- `tsup` - Build tool
- `vitest` - Testing framework
- `buf` - Protocol Buffer compiler

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
