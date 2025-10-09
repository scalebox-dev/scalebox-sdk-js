#!/usr/bin/env bash

set -euo pipefail

# This script generates TypeScript gRPC code from Protocol Buffers
# Based on E2B's excellent design pattern
# Generates code from spec/grpc/ to src/grpc/

echo "🔧 Generating TypeScript gRPC code from Protocol Buffers..."

# Check if buf is installed
if ! command -v buf &> /dev/null; then
    echo "❌ buf is not installed. Please install it first:"
    echo "   npm install -g @bufbuild/buf"
    echo "   or visit: https://docs.buf.build/installation"
    exit 1
fi

# Generate gRPC code using buf with E2B-style configuration
echo "🚀 Using buf to generate TypeScript gRPC code..."
cd spec/grpc
buf generate

echo "✅ TypeScript gRPC code generated successfully!"
echo "📁 Generated files are in: src/grpc/"

# Check if files were generated
if [ -d "../../src/grpc" ] && [ "$(ls -A ../../src/grpc)" ]; then
    echo "📋 Generated files:"
    ls -la ../../src/grpc/
else
    echo "⚠️  No files were generated. Check your proto files and buf configuration."
    exit 1
fi
