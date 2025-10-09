#!/bin/bash

# API 验证脚本
# 验证修正后的 API 接口是否正常工作

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo "=========================================="
echo "🔧 Scalebox SDK API 验证"
echo "=========================================="

# 检查环境配置
print_status "检查环境配置..."

if [ -z "$SCALEBOX_API_KEY" ]; then
    print_error "SCALEBOX_API_KEY 环境变量未设置"
    print_status "请设置环境变量: export SCALEBOX_API_KEY=your_api_key"
    exit 1
fi

print_success "API Key 已配置"
print_status "API URL: ${SCALEBOX_API_URL:-https://api.scalebox.dev}"
print_status "Domain: ${SCALEBOX_DOMAIN:-scalebox.dev}"

# 编译检查
print_status "运行 TypeScript 编译检查..."
if npm run build; then
    print_success "编译检查通过"
else
    print_error "编译检查失败"
    exit 1
fi

# 运行 Sandbox 生命周期测试
print_status "运行 Sandbox 生命周期测试..."

if npm test tests/sandbox/lifecycle.test.ts -- --reporter=verbose; then
    print_success "Sandbox 生命周期测试通过! 🎉"
else
    print_error "Sandbox 生命周期测试失败"
    exit 1
fi

# 运行参数转换测试
print_status "运行参数转换逻辑测试..."

if npm test tests/api/conversion.test.ts -- --reporter=verbose; then
    print_success "参数转换测试通过! 🎉"
else
    print_error "参数转换测试失败"
    exit 1
fi

echo "=========================================="
print_success "所有验证完成!"
echo "=========================================="

print_status "下一步建议:"
echo "1. 运行完整测试套件: npm test"
echo "2. 测试真实 API 调用"
echo "3. 验证文件系统操作（待实现）"
