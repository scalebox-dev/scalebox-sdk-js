#!/bin/bash

# 按目录层级顺序运行测试脚本
# 避免后端并发限制，确保测试稳定运行

set -e  # 遇到错误时退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 测试目录配置
TEST_DIRS="api:tests/api/** code-interpreter:tests/code-interpreter/** desktop:tests/desktop/** sandbox:tests/sandbox/** integration:tests/integration/**"

# 测试结果统计
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
FAILED_DIRS=()

echo -e "${BLUE}🚀 开始按目录层级顺序运行测试...${NC}"
echo "================================================"

# 运行单个测试目录
run_test_dir() {
    local dir_name=$1
    local test_pattern=$2
    
    echo -e "\n${YELLOW}📁 运行测试目录: ${dir_name}${NC}"
    echo "测试模式: ${test_pattern}"
    echo "----------------------------------------"
    
    # 设置环境变量（如果需要）
    local env_vars=""
    if [ "$dir_name" = "integration" ]; then
        env_vars="SCALEBOX_INTEGRATION_TEST=1 "
    fi
    
    # 运行测试
    if eval "${env_vars}vitest run ${test_pattern}"; then
        echo -e "${GREEN}✅ ${dir_name} 测试通过${NC}"
        ((PASSED_TESTS++))
    else
        echo -e "${RED}❌ ${dir_name} 测试失败${NC}"
        ((FAILED_TESTS++))
        FAILED_DIRS+=("$dir_name")
    fi
    
    ((TOTAL_TESTS++))
    
    # 在测试之间添加短暂延迟，避免资源冲突
    if [ "$dir_name" != "integration" ]; then
        echo -e "${BLUE}⏳ 等待 2 秒后继续下一个测试目录...${NC}"
        sleep 2
    fi
}

# 主执行逻辑
main() {
    local start_time=$(date +%s)
    
    # 检查是否跳过集成测试
    local skip_integration=false
    if [ "$1" = "--no-integration" ]; then
        skip_integration=true
        echo -e "${YELLOW}⚠️  跳过集成测试${NC}"
    fi
    
    # 按顺序运行测试目录
    for test_config in $TEST_DIRS; do
        dir_name=$(echo "$test_config" | cut -d: -f1)
        test_pattern=$(echo "$test_config" | cut -d: -f2)
        
        if [ "$skip_integration" = true ] && [ "$dir_name" = "integration" ]; then
            echo -e "${YELLOW}⚠️  跳过集成测试${NC}"
            continue
        fi
        
        run_test_dir "$dir_name" "$test_pattern"
    done
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    # 输出测试结果摘要
    echo -e "\n${BLUE}================================================"
    echo -e "📊 测试执行完成${NC}"
    echo -e "${BLUE}================================================"
    echo -e "总测试目录: ${TOTAL_TESTS}"
    echo -e "${GREEN}通过: ${PASSED_TESTS}${NC}"
    echo -e "${RED}失败: ${FAILED_TESTS}${NC}"
    echo -e "执行时间: ${duration} 秒"
    
    if [ ${#FAILED_DIRS[@]} -gt 0 ]; then
        echo -e "\n${RED}失败的测试目录:${NC}"
        for dir in "${FAILED_DIRS[@]}"; do
            echo -e "${RED}  - ${dir}${NC}"
        done
        exit 1
    else
        echo -e "\n${GREEN}🎉 所有测试都通过了！${NC}"
        exit 0
    fi
}

# 显示帮助信息
show_help() {
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  --no-integration    跳过集成测试"
    echo "  --help, -h         显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0                 运行所有测试（包括集成测试）"
    echo "  $0 --no-integration 跳过集成测试"
}

# 处理命令行参数
case "$1" in
    --help|-h)
        show_help
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac
