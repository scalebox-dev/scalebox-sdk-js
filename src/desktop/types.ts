/**
 * Desktop 相关类型定义
 * 基于 E2B 的设计模式，支持桌面自动化功能
 */

export interface CursorPosition {
  x: number
  y: number
}

export interface ScreenSize {
  width: number
  height: number
}

export interface WindowInfo {
  id: string
  title: string
  x: number
  y: number
  width: number
  height: number
  visible: boolean
}

export interface DesktopOpts {
  /**
   * 模板ID
   * @default 'desktop'
   */
  templateId?: string
  
  /**
   * 超时时间（毫秒）
   * @default 300000
   */
  timeout?: number
  
  /**
   * 元数据
   * @default {}
   */
  metadata?: Record<string, string>
  
  /**
   * API 密钥
   */
  apiKey?: string
  
  /**
   * API URL
   */
  apiUrl?: string
  
  /**
   * 请求超时时间（毫秒）
   * @default 30000
   */
  requestTimeoutMs?: number
  
  /**
   * 调试模式
   * @default false
   */
  debug?: boolean

  /**
   * 屏幕分辨率 [宽度, 高度]
   * @default [1024, 768]
   */
  resolution?: [number, number]

  /**
   * 显示器DPI
   * @default 96
   */
  dpi?: number

  /**
   * Display设置
   * @default ":0"
   */
  display?: string

  /**
   * 环境变量
   * @default {}
   */
  envs?: Record<string, string>
}

export interface MouseButton {
  left: 'left'
  right: 'right'
  middle: 'middle'
}

export type MouseButtonType = 'left' | 'right' | 'middle'

export interface KeyboardKey {
  key: string
  modifiers?: string[]
}

export interface DesktopAutomation {
  /**
   * 鼠标操作
   */
  mouse: {
    move: (x: number, y: number) => Promise<void>
    click: (x?: number, y?: number) => Promise<void>
    doubleClick: (x?: number, y?: number) => Promise<void>
    rightClick: (x?: number, y?: number) => Promise<void>
    middleClick: (x?: number, y?: number) => Promise<void>
    press: (button: MouseButtonType) => Promise<void>
    release: (button: MouseButtonType) => Promise<void>
    drag: (from: [number, number], to: [number, number]) => Promise<void>
    scroll: (direction: 'up' | 'down', amount?: number) => Promise<void>
    getPosition: () => Promise<CursorPosition>
  }
  
  /**
   * 键盘操作
   */
  keyboard: {
    type: (text: string, chunkSize?: number, delayMs?: number) => Promise<void>
    press: (key: string, modifiers?: string[]) => Promise<void>
    release: (key: string, modifiers?: string[]) => Promise<void>
    hotkey: (keys: string[]) => Promise<void>
    wait: (ms: number) => Promise<void>
  }
  
  /**
   * 窗口管理
   */
  windows: {
    getCurrentWindowId: () => Promise<string>
    getWindowTitle: (windowId: string) => Promise<string>
    getApplicationWindows: (application: string) => Promise<string[]>
    getAllWindows: () => Promise<WindowInfo[]>
    focusWindow: (windowId: string) => Promise<void>
    closeWindow: (windowId: string) => Promise<void>
    minimizeWindow: (windowId: string) => Promise<void>
    maximizeWindow: (windowId: string) => Promise<void>
    resizeWindow: (windowId: string, width: number, height: number) => Promise<void>
    moveWindow: (windowId: string, x: number, y: number) => Promise<void>
  }
  
  /**
   * 屏幕操作
   */
  screen: {
    getSize: () => Promise<ScreenSize>
    capture: (x?: number, y?: number, width?: number, height?: number) => Promise<string>
    findImage: (imagePath: string, confidence?: number) => Promise<CursorPosition | null>
    findText: (text: string) => Promise<CursorPosition | null>
  }
  
  /**
   * 应用程序管理
   */
  applications: {
    launch: (application: string, uri?: string) => Promise<void>
    open: (fileOrUrl: string) => Promise<void>
    getRunningApplications: () => Promise<string[]>
    isApplicationRunning: (application: string) => Promise<boolean>
    closeApplication: (application: string) => Promise<void>
  }
}

export interface VNCServer {
  /**
   * VNC 服务器配置
   */
  port: number
  password?: string
  readonly: boolean
  
  /**
   * 启动 VNC 服务器
   */
  start(): Promise<void>
  
  /**
   * 停止 VNC 服务器
   */
  stop(): Promise<void>
  
  /**
   * 获取 VNC 连接 URL
   */
  getConnectionUrl(): string
}

export interface DesktopStream {
  /**
   * 桌面流配置
   */
  quality: 'low' | 'medium' | 'high'
  fps: number
  
  /**
   * 开始流
   */
  start(): Promise<void>
  
  /**
   * 停止流
   */
  stop(): Promise<void>
  
  /**
   * 获取流 URL
   */
  getStreamUrl(): string
}
