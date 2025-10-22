/**
 * Desktop 相关类型定义
 * 支持桌面自动化功能
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

/**
 * VNC 服务器状态
 */
export type VNCServerStatus = 'idle' | 'starting' | 'running' | 'stopping' | 'error'

/**
 * VNC 缩放模式
 * - off: 不缩放
 * - scale: 缩放以适应窗口
 * - remote: 远程调整分辨率
 */
export type VNCResizeMode = 'off' | 'scale' | 'remote'

/**
 * VNC 服务器启动配置
 */
export interface VNCServerStartOptions {
  /**
   * VNC 端口号（可选，默认 5900）
   */
  vncPort?: number
  
  /**
   * noVNC web 端口号（可选，默认 6080）
   */
  port?: number
  
  /**
   * 是否需要认证（可选，默认 false）
   */
  requireAuth?: boolean
  
  /**
   * 窗口 ID（可选，用于仅共享特定窗口）
   */
  windowId?: string
}

/**
 * VNC 连接 URL 配置
 */
export interface VNCConnectionUrlOptions {
  /**
   * 是否自动连接（默认 true）
   */
  autoConnect?: boolean
  
  /**
   * 是否只读模式（默认 false）
   */
  viewOnly?: boolean
  
  /**
   * 缩放模式（默认 "scale"）
   */
  resize?: VNCResizeMode
  
  /**
   * 认证密钥（可选，如果不提供且启用认证，将自动使用服务器密码）
   */
  authKey?: string
}

/**
 * VNC 服务器接口
 * 遵循业界最佳实践：
 * 1. 配置与状态分离
 * 2. 使用配置对象而非多参数
 * 3. 提供状态查询能力
 * 4. 类型安全的枚举
 */
export interface VNCServer {
  /**
   * VNC 服务器当前状态（只读）
   */
  readonly status: VNCServerStatus
  
  /**
   * noVNC web 端口号（只读）
   */
  readonly port: number
  
  /**
   * 认证密码（只读，仅在启用认证时可用）
   */
  readonly password?: string
  
  /**
   * 是否为只读模式（只读）
   */
  readonly readonly: boolean
  
  /**
   * 启动 VNC 服务器
   * @param options 启动配置选项
   * @throws 如果服务器已在运行则抛出错误
   * @example
   * ```typescript
   * await vncServer.start({
   *   vncPort: 5901,
   *   port: 6081,
   *   requireAuth: true
   * })
   * ```
   */
  start(options?: VNCServerStartOptions): Promise<void>
  
  /**
   * 停止 VNC 服务器
   * @throws 如果服务器未运行则抛出错误
   */
  stop(): Promise<void>
  
  /**
   * 重启 VNC 服务器
   * @param options 可选的新配置
   */
  restart(options?: VNCServerStartOptions): Promise<void>
  
  /**
   * 检查服务器是否正在运行
   */
  isRunning(): boolean
  
  /**
   * 获取 VNC 连接 URL
   * @param options URL 配置选项
   * @returns 完整的 noVNC 连接 URL
   * @example
   * ```typescript
   * const url = vncServer.getConnectionUrl({
   *   autoConnect: true,
   *   viewOnly: false,
   *   resize: 'scale'
   * })
   * ```
   */
  getConnectionUrl(options?: VNCConnectionUrlOptions): string
  
  /**
   * 获取认证密钥
   * @returns 认证密钥字符串
   * @throws 如果认证未启用则抛出错误
   */
  getAuthKey(): string
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
