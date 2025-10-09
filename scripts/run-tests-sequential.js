#!/usr/bin/env node

/**
 * 按目录层级顺序运行测试脚本
 * 避免后端并发限制，确保测试稳定运行
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// 颜色输出
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

// 测试目录配置
const testDirs = [
  { name: 'api', pattern: 'tests/api/**', env: {} },
  { name: 'code-interpreter', pattern: 'tests/code_interpreter/**', env: {} },
  { name: 'desktop', pattern: 'tests/desktop/**', env: {} },
  { name: 'sandbox', pattern: 'tests/sandbox/**', env: {} },
  { name: 'integration', pattern: 'tests/integration/**', env: { SCALEBOX_INTEGRATION_TEST: '1' } }
];

// 测试结果统计
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failedDirs = [];

/**
 * 运行单个测试目录
 */
async function runTestDir(testDir, skipIntegration = false) {
  if (skipIntegration && testDir.name === 'integration') {
    console.log(`${colors.yellow}⚠️  跳过集成测试${colors.reset}`);
    return true;
  }

  console.log(`\n${colors.yellow}📁 运行测试目录: ${testDir.name}${colors.reset}`);
  console.log(`测试模式: ${testDir.pattern}`);
  console.log('----------------------------------------');

  return new Promise((resolve) => {
    const env = { ...process.env, ...testDir.env };
    const vitest = spawn('npx', ['vitest', 'run', testDir.pattern], {
      cwd: projectRoot,
      env,
      stdio: 'inherit'
    });

    vitest.on('close', (code) => {
      if (code === 0) {
        console.log(`${colors.green}✅ ${testDir.name} 测试通过${colors.reset}`);
        passedTests++;
      } else {
        console.log(`${colors.red}❌ ${testDir.name} 测试失败${colors.reset}`);
        failedTests++;
        failedDirs.push(testDir.name);
      }
      totalTests++;
      resolve(code === 0);
    });

    vitest.on('error', (error) => {
      console.error(`${colors.red}❌ 运行 ${testDir.name} 测试时出错: ${error.message}${colors.reset}`);
      failedTests++;
      failedDirs.push(testDir.name);
      totalTests++;
      resolve(false);
    });
  });
}

/**
 * 等待指定时间
 */
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 主执行函数
 */
async function main() {
  const args = process.argv.slice(2);
  const skipIntegration = args.includes('--no-integration');
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log('用法: node run-tests-sequential.js [选项]');
    console.log('');
    console.log('选项:');
    console.log('  --no-integration    跳过集成测试');
    console.log('  --help, -h         显示此帮助信息');
    console.log('');
    console.log('示例:');
    console.log('  node run-tests-sequential.js                 运行所有测试（包括集成测试）');
    console.log('  node run-tests-sequential.js --no-integration 跳过集成测试');
    process.exit(0);
  }

  const startTime = Date.now();
  
  console.log(`${colors.blue}🚀 开始按目录层级顺序运行测试...${colors.reset}`);
  console.log('================================================');

  // 按顺序运行测试目录
  for (const testDir of testDirs) {
    await runTestDir(testDir, skipIntegration);
    
    // 在测试之间添加短暂延迟，避免资源冲突
    if (testDir.name !== 'integration') {
      console.log(`${colors.blue}⏳ 等待 2 秒后继续下一个测试目录...${colors.reset}`);
      await wait(2000);
    }
  }

  const endTime = Date.now();
  const duration = Math.round((endTime - startTime) / 1000);

  // 输出测试结果摘要
  console.log(`\n${colors.blue}================================================`);
  console.log(`📊 测试执行完成${colors.reset}`);
  console.log(`${colors.blue}================================================`);
  console.log(`总测试目录: ${totalTests}`);
  console.log(`${colors.green}通过: ${passedTests}${colors.reset}`);
  console.log(`${colors.red}失败: ${failedTests}${colors.reset}`);
  console.log(`执行时间: ${duration} 秒`);

  if (failedDirs.length > 0) {
    console.log(`\n${colors.red}失败的测试目录:${colors.reset}`);
    for (const dir of failedDirs) {
      console.log(`${colors.red}  - ${dir}${colors.reset}`);
    }
    process.exit(1);
  } else {
    console.log(`\n${colors.green}🎉 所有测试都通过了！${colors.reset}`);
    process.exit(0);
  }
}

// 运行主函数
main().catch(error => {
  console.error(`${colors.red}❌ 执行测试时发生错误: ${error.message}${colors.reset}`);
  process.exit(1);
});
