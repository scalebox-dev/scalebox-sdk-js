#!/usr/bin/env bash

set -euo pipefail

echo "🔧 Generating TypeScript gRPC code in both directories..."

# Generate in src/grpc for backward compatibility
echo "📁 Generating in src/grpc (for backward compatibility)..."
cd spec/grpc

cat > buf.gen.grpc.yaml << 'EOF'
version: v2
managed:
  enabled: true
plugins:
  - local: protoc-gen-es
    out: ../../src/grpc
    opt:
      - target=ts
      - import_extension=js
      - js_import_style=module
EOF

buf generate --template buf.gen.grpc.yaml

# Also generate Connect RPC in src/generated
echo "📁 Generating Connect RPC in src/generated..."
buf generate --template buf.gen.yaml

# Clean up temporary file
rm buf.gen.grpc.yaml

echo "✅ Code generated in both src/grpc and src/generated!"
