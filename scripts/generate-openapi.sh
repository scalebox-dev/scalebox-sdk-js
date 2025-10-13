#!/usr/bin/env bash

set -euo pipefail

# This script generates TypeScript OpenAPI code from OpenAPI specification
# Generates code from spec/openapi/ to src/api/

echo "🔧 Generating TypeScript OpenAPI code from OpenAPI specification..."

# Generate OpenAPI code using openapi-typescript
echo "🚀 Using openapi-typescript to generate TypeScript OpenAPI code..."

# Generate API schema
npx openapi-typescript \
  spec/openapi/openapi.yaml \
  -x api_key \
  --array-length \
  --alphabetize \
  --output src/api/schema.gen.ts

echo "✅ TypeScript OpenAPI code generated successfully!"
echo "📁 Generated files are in: src/api/"

# Check if files were generated
if [ -f "src/api/schema.gen.ts" ]; then
    echo "📋 Generated files:"
    ls -la src/api/schema.gen.ts
else
    echo "⚠️  No files were generated. Check your OpenAPI specification."
    exit 1
fi
