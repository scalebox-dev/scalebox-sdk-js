/**
 * 工具函数
 * 基于 scalebox-sdk-py 的实际业务场景
 */

/**
 * 睡眠函数
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 检查是否在浏览器环境
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.document !== 'undefined'
}

/**
 * 检查是否在 Node.js 环境
 */
export function isNode(): boolean {
  return typeof process !== 'undefined' && Boolean(process.versions?.node)
}

/**
 * 获取当前运行时环境
 */
export function getRuntime(): 'browser' | 'node' | 'deno' | 'bun' | 'unknown' {
  if (isBrowser()) return 'browser'
  if (isNode()) return 'node'
  // @ts-ignore - Deno and Bun are global objects
  if (typeof Deno !== 'undefined') return 'deno'
  // @ts-ignore - Bun is a global object
  if (typeof Bun !== 'undefined') return 'bun'
  return 'unknown'
}

/**
 * 生成唯一ID
 */
export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 格式化时间
 */
export function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`
  return `${(ms / 60000).toFixed(2)}m`
}