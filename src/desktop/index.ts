/**
 * Desktop 模块
 * 支持桌面自动化功能
 * 提供鼠标、键盘、窗口管理、屏幕操作等功能
 */

import { Sandbox } from '../sandbox'
import { ConnectionConfig } from '../connectionConfig'
import { ApiClient } from '../api'
import { 
  DesktopOpts,
  DesktopAutomation,
  CursorPosition,
  ScreenSize,
  WindowInfo,
  MouseButtonType,
  VNCServer,
  DesktopStream
} from './types'
import { ScaleboxError } from '../errors'
import { randomBytes } from 'crypto'

// 鼠标按钮映射
const MOUSE_BUTTONS = {
  left: 1,
  right: 3,
  middle: 2
} as const

// 键盘按键映射
const KEYS: { [key: string]: string } = {
  alt: 'Alt_L',
  alt_left: 'Alt_L',
  alt_right: 'Alt_R',
  backspace: 'BackSpace',
  break: 'Pause',
  caps_lock: 'Caps_Lock',
  cmd: 'Super_L',
  command: 'Super_L',
  control: 'Control_L',
  control_left: 'Control_L',
  control_right: 'Control_R',
  ctrl: 'Control_L',
  del: 'Delete',
  delete: 'Delete',
  down: 'Down',
  end: 'End',
  enter: 'Return',
  esc: 'Escape',
  escape: 'Escape',
  f1: 'F1',
  f2: 'F2',
  f3: 'F3',
  f4: 'F4',
  f5: 'F5',
  f6: 'F6',
  f7: 'F7',
  f8: 'F8',
  f9: 'F9',
  f10: 'F10',
  f11: 'F11',
  f12: 'F12',
  home: 'Home',
  insert: 'Insert',
  left: 'Left',
  menu: 'Menu',
  meta: 'Meta_L',
  num_lock: 'Num_Lock',
  page_down: 'Page_Down',
  page_up: 'Page_Up',
  pause: 'Pause',
  print: 'Print',
  right: 'Right',
  scroll_lock: 'Scroll_Lock',
  shift: 'Shift_L',
  shift_left: 'Shift_L',
  shift_right: 'Shift_R',
  space: 'space',
  super: 'Super_L',
  super_left: 'Super_L',
  super_right: 'Super_R',
  tab: 'Tab',
  up: 'Up',
  win: 'Super_L',
  windows: 'Super_L'
}

/**
 * 键位映射函数
 */
function mapKey(key: string): string {
  const lowerKey = key.toLowerCase()
  return KEYS[lowerKey] || lowerKey
}

/**
 * VNC 服务器管理类
 */
class VNCServerImpl implements VNCServer {
  private desktop: Desktop
  private novncHandle?: any
  private _vncPort = 5900
  private _port = 6080
  private _novncAuthEnabled = false
  private _novncPassword?: string
  private _url = ""

  public port: number
  public password?: string
  public readonly: boolean

  constructor(desktop: Desktop) {
    this.desktop = desktop
    this.port = this._port
    this.readonly = false
  }

  /**
   * 等待端口启动
   */
  private async waitForPort(port: number): Promise<boolean> {
    return this.desktop.waitAndVerify(
      `netstat -tuln | grep ":${port} "`,
      (result) => result.stdout.trim() !== ""
    )
  }

  /**
   * 检查VNC是否正在运行
   */
  private async checkVncRunning(): Promise<boolean> {
    try {
      await this.desktop.executeCommand('pgrep -x x11vnc')
      return true
    } catch {
      return false
    }
  }

  /**
   * 生成随机密码
   */
  private static generatePassword(length: number = 16): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  /**
   * 获取连接URL
   */
  getConnectionUrl(autoConnect = true, viewOnly = false, resize = "scale", authKey?: string): string {
    const params: string[] = []
    if (autoConnect) params.push("autoconnect=true")
    if (viewOnly) params.push("view_only=true")
    if (resize) params.push(`resize=${resize}`)
    if (authKey) params.push(`password=${authKey}`)
    
    return params.length > 0 ? `${this._url}?${params.join('&')}` : this._url
  }

  /**
   * 获取认证密钥
   */
  getAuthKey(): string {
    if (!this._novncPassword) {
      throw new Error('Unable to retrieve stream auth key, check if require_auth is enabled')
    }
    return this._novncPassword
  }

  /**
   * 启动VNC服务器
   */
  async start(vncPort?: number, port?: number, requireAuth = false, windowId?: string): Promise<void> {
    // 检查是否已经运行
    if (await this.checkVncRunning()) {
      throw new Error('Stream is already running')
    }

    // 更新配置
    this._vncPort = vncPort || this._vncPort
    this._port = port || this._port
    this._novncAuthEnabled = requireAuth
    this._novncPassword = requireAuth ? VNCServerImpl.generatePassword() : undefined
    this.port = this._port
    this.password = this._novncPassword

    // 设置VNC命令
    let pwdFlag = "-nopw"
    if (this._novncAuthEnabled && this._novncPassword) {
      await this.desktop.executeCommand("mkdir -p ~/.vnc")
      await this.desktop.executeCommand(`x11vnc -storepasswd ${this._novncPassword} ~/.vnc/passwd`)
      pwdFlag = "-usepw"
    }

    const windowIdFlag = windowId ? `-id ${windowId}` : ""
    const vncCommand = `DISPLAY=${this.desktop.display} x11vnc -bg -display ${this.desktop.display} -forever -wait 50 -shared -rfbport ${this._vncPort} ${pwdFlag} 2>/tmp/x11vnc_stderr.log ${windowIdFlag}`
    const novncCommand = `cd /opt/noVNC/utils && ./novnc_proxy --vnc localhost:${this._vncPort} --listen ${this._port} --web /opt/noVNC > /tmp/novnc.log 2>&1 &`

    await this.desktop.executeCommand(vncCommand)
    // Note: In real implementation, we'd need to handle background processes properly
    await this.desktop.executeCommand(novncCommand)
    
    if (!(await this.waitForPort(this._port))) {
      throw new Error("Could not start noVNC server")
    }
  }

  /**
   * 停止VNC服务器
   */
  async stop(): Promise<void> {
    if (await this.checkVncRunning()) {
      await this.desktop.executeCommand('pkill x11vnc')
    }

    if (this.novncHandle) {
      // In real implementation, we'd need to kill the background process
      this.novncHandle = undefined
    }
  }
}

/**
 * Desktop - 桌面自动化
 * 支持完整的桌面自动化功能
 */
export class Desktop {
  private sandbox: Sandbox
  private api: ApiClient
  private config: ConnectionConfig
  private vncServerInstance?: VNCServerImpl
  private _display: string = ':0'
  private lastXfce4Pid?: number

  constructor(
    sandbox: Sandbox, 
    config: ConnectionConfig, 
    api: ApiClient,
    options?: {
      resolution?: [number, number]
      dpi?: number
      display?: string
      sandboxId?: string
    }
  ) {
    this.sandbox = sandbox
    this.api = api
    this.config = config
    this._display = options?.display || ':0'

    // 如果不是连接到现有sandbox，则初始化桌面环境
    if (!options?.sandboxId) {
      this.initDesktopEnvironment(options?.resolution, options?.dpi)
    }
    
    // 初始化VNC服务器
    this.vncServerInstance = new VNCServerImpl(this)
  }

  /**
   * 获取display属性
   */
  get display(): string {
    return this._display
  }

  /**
   * 初始化桌面环境
   */
  private async initDesktopEnvironment(resolution?: [number, number], dpi?: number): Promise<void> {
    try {
      const [width, height] = resolution || [1024, 768]
      const displayDpi = dpi || 96

      // 启动Xvfb
      const xvfbCommand = `Xvfb ${this._display} -ac -screen 0 ${width}x${height}x24 -retro -dpi ${displayDpi} -nolisten tcp -nolisten unix &`
      await this.executeCommand(xvfbCommand)
      
      // 等待Xvfb启动
      if (!(await this.waitAndVerify(
        `xdpyinfo -display ${this._display}`,
        (result) => result.exitCode === 0
      ))) {
        throw new Error("Could not start Xvfb")
      }

      // 启动XFCE4桌面环境
      await this.startXfce4()
    } catch (error) {
      console.warn('Desktop environment initialization failed:', error)
    }
  }

  /**
   * 启动XFCE4桌面会话
   */
  private async startXfce4(): Promise<void> {
    try {
      if (this.lastXfce4Pid) {
        // 检查之前的会话是否还在运行
        const checkResult = await this.executeCommand(`ps aux | grep ${this.lastXfce4Pid} | grep -v grep | head -n 1`)
        if (checkResult.stdout.includes('[xfce4-session] <defunct>')) {
          this.lastXfce4Pid = undefined
        }
      }

      if (!this.lastXfce4Pid) {
        const result = await this.executeCommand(`DISPLAY=${this._display} startxfce4 &`)
        // Note: In real implementation, we'd capture the actual PID
        this.lastXfce4Pid = Date.now() // Mock PID
      }
    } catch (error) {
      console.warn('Failed to start XFCE4:', error)
    }
  }

  /**
   * 等待验证机制
   */
  async waitAndVerify(
    command: string,
    onResult: (result: { stdout: string; stderr: string; exitCode: number }) => boolean,
    timeout: number = 10,
    interval: number = 0.5
  ): Promise<boolean> {
    const startTime = Date.now()
    while ((Date.now() - startTime) / 1000 < timeout) {
      try {
        const result = await this.executeCommand(command)
        if (onResult(result)) {
          return true
        }
      } catch (error) {
        // 继续重试
      }
      await new Promise(resolve => setTimeout(resolve, interval * 1000))
    }
    return false
  }

  /**
   * 截图功能
   */
  async screenshot(format: 'bytes' | 'stream' = 'bytes'): Promise<Buffer | ReadableStream> {
    try {
      const screenshotPath = `/tmp/screenshot-${Date.now()}.png`
      
      await this.executeCommand(`DISPLAY=${this._display} scrot --pointer ${screenshotPath}`)
      
      // 读取文件
      const readResult = await this.executeCommand(`cat ${screenshotPath} | base64`)
      const imageBuffer = Buffer.from(readResult.stdout.trim(), 'base64')
      
      // 清理临时文件
      await this.executeCommand(`rm -f ${screenshotPath}`)
      
      if (format === 'stream') {
        // 创建可读流
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(imageBuffer)
            controller.close()
          }
        })
        return stream
      }
      
      return imageBuffer
    } catch (error) {
      throw new ScaleboxError(`Failed to take screenshot: ${error}`)
    }
  }

  /**
   * 获取VNC服务器实例
   */
  get stream(): VNCServer {
    if (!this.vncServerInstance) {
      this.vncServerInstance = new VNCServerImpl(this)
    }
    return this.vncServerInstance
  }

  /**
   * 创建新的桌面环境
   */
  static async create(opts: DesktopOpts = {}): Promise<Desktop> {
    const config = new ConnectionConfig(opts)
    
    // 设置环境变量，包括DISPLAY
    const envs = {
      ...opts.envs,
      DISPLAY: opts.display || ':0'
    }
    
    const sandboxOpts = {
      ...opts,
      envs
    }
    
    const sandbox = await Sandbox.create(opts.templateId || 'desktop', sandboxOpts)
    const api = new ApiClient(config)
    return new Desktop(sandbox, config, api, {
      resolution: opts.resolution,
      dpi: opts.dpi,
      display: opts.display
    })
  }

  /**
   * 连接到现有桌面环境
   */
  static async connect(sandboxId: string, opts: DesktopOpts = {}): Promise<Desktop> {
    const config = new ConnectionConfig(opts)
    const sandbox = await Sandbox.connect(sandboxId, opts)
    const api = new ApiClient(config)
    return new Desktop(sandbox, config, api, { sandboxId })
  }

  /**
   * 获取桌面自动化接口
   */
  get automation(): DesktopAutomation {
    return {
      mouse: {
        move: (x: number, y: number) => this.moveMouse(x, y),
        click: (x?: number, y?: number) => this.leftClick(x, y),
        doubleClick: (x?: number, y?: number) => this.doubleClick(x, y),
        rightClick: (x?: number, y?: number) => this.rightClick(x, y),
        middleClick: (x?: number, y?: number) => this.middleClick(x, y),
        press: (button: MouseButtonType) => this.mousePress(button),
        release: (button: MouseButtonType) => this.mouseRelease(button),
        drag: (from: [number, number], to: [number, number]) => this.drag(from, to),
        scroll: (direction: 'up' | 'down', amount?: number) => this.scroll(direction, amount),
        getPosition: () => this.getCursorPosition()
      },
      keyboard: {
        type: (text: string, chunkSize?: number, delayMs?: number) => this.typeText(text, chunkSize, delayMs),
        press: (key: string, modifiers?: string[]) => this.keyPress(key, modifiers),
        release: (key: string, modifiers?: string[]) => this.keyRelease(key, modifiers),
        hotkey: (keys: string[]) => this.hotkey(keys),
        wait: (ms: number) => this.wait(ms)
      },
      windows: {
        getCurrentWindowId: () => this.getCurrentWindowId(),
        getWindowTitle: (windowId: string) => this.getWindowTitle(windowId),
        getApplicationWindows: (application: string) => this.getApplicationWindows(application),
        getAllWindows: () => this.getAllWindows(),
        focusWindow: (windowId: string) => this.focusWindow(windowId),
        closeWindow: (windowId: string) => this.closeWindow(windowId),
        minimizeWindow: (windowId: string) => this.minimizeWindow(windowId),
        maximizeWindow: (windowId: string) => this.maximizeWindow(windowId),
        resizeWindow: (windowId: string, width: number, height: number) => this.resizeWindow(windowId, width, height),
        moveWindow: (windowId: string, x: number, y: number) => this.moveWindow(windowId, x, y)
      },
      screen: {
        getSize: () => this.getScreenSize(),
        capture: (x?: number, y?: number, width?: number, height?: number) => this.captureScreen(x, y, width, height),
        findImage: (imagePath: string, confidence?: number) => this.findImage(imagePath, confidence),
        findText: (text: string) => this.findText(text)
      },
      applications: {
        launch: (application: string, uri?: string) => this.launch(application, uri),
        open: (fileOrUrl: string) => this.open(fileOrUrl),
        getRunningApplications: () => this.getRunningApplications(),
        isApplicationRunning: (application: string) => this.isApplicationRunning(application),
        closeApplication: (application: string) => this.closeApplication(application)
      }
    }
  }

  /**
   * 鼠标操作
   */
  async moveMouse(x: number, y: number): Promise<void> {
    try {
      await this.executeCommand(`DISPLAY=${this._display} xdotool mousemove --sync ${x} ${y}`)
    } catch (error) {
      throw new ScaleboxError(`Failed to move mouse: ${error}`)
    }
  }

  async leftClick(x?: number, y?: number): Promise<void> {
    try {
      if (x !== undefined && y !== undefined) {
        await this.moveMouse(x, y)
      }
      await this.executeCommand(`DISPLAY=${this._display} xdotool click ${MOUSE_BUTTONS.left}`)
    } catch (error) {
      throw new ScaleboxError(`Failed to left click: ${error}`)
    }
  }

  async rightClick(x?: number, y?: number): Promise<void> {
    try {
      if (x !== undefined && y !== undefined) {
        await this.moveMouse(x, y)
      }
      await this.executeCommand(`DISPLAY=${this._display} xdotool click ${MOUSE_BUTTONS.right}`)
    } catch (error) {
      throw new ScaleboxError(`Failed to right click: ${error}`)
    }
  }

  async doubleClick(x?: number, y?: number): Promise<void> {
    try {
      if (x !== undefined && y !== undefined) {
        await this.moveMouse(x, y)
      }
      await this.executeCommand(`DISPLAY=${this._display} xdotool click --repeat 2 ${MOUSE_BUTTONS.left}`)
    } catch (error) {
      throw new ScaleboxError(`Failed to double click: ${error}`)
    }
  }

  async middleClick(x?: number, y?: number): Promise<void> {
    try {
      if (x !== undefined && y !== undefined) {
        await this.moveMouse(x, y)
      }
      await this.executeCommand(`DISPLAY=${this._display} xdotool click ${MOUSE_BUTTONS.middle}`)
    } catch (error) {
      throw new ScaleboxError(`Failed to middle click: ${error}`)
    }
  }

  async mousePress(button: MouseButtonType = 'left'): Promise<void> {
    try {
      await this.executeCommand(`DISPLAY=${this._display} xdotool mousedown ${MOUSE_BUTTONS[button]}`)
    } catch (error) {
      throw new ScaleboxError(`Failed to press mouse button: ${error}`)
    }
  }

  async mouseRelease(button: MouseButtonType = 'left'): Promise<void> {
    try {
      await this.executeCommand(`DISPLAY=${this._display} xdotool mouseup ${MOUSE_BUTTONS[button]}`)
    } catch (error) {
      throw new ScaleboxError(`Failed to release mouse button: ${error}`)
    }
  }

  async drag(from: [number, number], to: [number, number]): Promise<void> {
    try {
      await this.moveMouse(from[0], from[1])
      await this.mousePress()
      await this.moveMouse(to[0], to[1])
      await this.mouseRelease()
    } catch (error) {
      throw new ScaleboxError(`Failed to drag: ${error}`)
    }
  }

  async scroll(direction: 'up' | 'down' = 'down', amount: number = 1): Promise<void> {
    try {
      const button = direction === 'up' ? '4' : '5'
      await this.executeCommand(`DISPLAY=${this._display} xdotool click --repeat ${amount} ${button}`)
    } catch (error) {
      throw new ScaleboxError(`Failed to scroll: ${error}`)
    }
  }

  async getCursorPosition(): Promise<CursorPosition> {
    try {
      const result = await this.executeCommand(`DISPLAY=${this._display} xdotool getmouselocation`)
      
      // 解析输出，格式类似 "x:100 y:200 screen:0 window:123"
      const match = result.stdout.match(/x:(\d+)\s+y:(\d+)/)
      if (!match) {
        throw new Error(`Failed to parse cursor position from output: ${result.stdout}`)
      }
      
      const x = parseInt(match[1])
      const y = parseInt(match[2])
      
      if (isNaN(x) || isNaN(y)) {
        throw new Error(`Invalid cursor position values: x=${x}, y=${y}`)
      }
      
      return { x, y }
    } catch (error) {
      throw new ScaleboxError(`Failed to get cursor position: ${error}`)
    }
  }

  /**
   * 键盘操作
   */
  async typeText(text: string, chunkSize: number = 25, delayMs: number = 75): Promise<void> {
    try {
      // 将文本分块输入，模拟真实打字
      const chunks = []
      for (let i = 0; i < text.length; i += chunkSize) {
        chunks.push(text.slice(i, i + chunkSize))
      }
      
      for (const chunk of chunks) {
        // 使用shell转义来处理特殊字符
        const escapedChunk = chunk.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, "\\'")
        await this.executeCommand(`DISPLAY=${this._display} xdotool type --delay ${delayMs} "${escapedChunk}"`)
      }
    } catch (error) {
      throw new ScaleboxError(`Failed to type text: ${error}`)
    }
  }

  async keyPress(key: string, modifiers?: string[]): Promise<void> {
    try {
      const mappedKey = mapKey(key)
      const mods = modifiers ? modifiers.map(mapKey).join('+') + '+' : ''
      await this.executeCommand(`DISPLAY=${this._display} xdotool keydown ${mods}${mappedKey}`)
    } catch (error) {
      throw new ScaleboxError(`Failed to press key: ${error}`)
    }
  }

  async keyRelease(key: string, modifiers?: string[]): Promise<void> {
    try {
      const mappedKey = mapKey(key)
      const mods = modifiers ? modifiers.map(mapKey).join('+') + '+' : ''
      await this.executeCommand(`DISPLAY=${this._display} xdotool keyup ${mods}${mappedKey}`)
    } catch (error) {
      throw new ScaleboxError(`Failed to release key: ${error}`)
    }
  }

  async hotkey(keys: string[]): Promise<void> {
    try {
      const mappedKeys = keys.map(mapKey)
      const keyCombo = mappedKeys.join('+')
      await this.executeCommand(`DISPLAY=${this._display} xdotool key ${keyCombo}`)
    } catch (error) {
      throw new ScaleboxError(`Failed to execute hotkey: ${error}`)
    }
  }

  async wait(ms: number): Promise<void> {
    try {
      await this.executeCommand(`sleep ${ms / 1000}`)
    } catch (error) {
      throw new ScaleboxError(`Failed to wait: ${error}`)
    }
  }

  /**
   * 窗口管理
   */
  async getCurrentWindowId(): Promise<string> {
    try {
      const result = await this.executeCommand(`DISPLAY=${this._display} xdotool getwindowfocus`)
      return result.stdout.trim()
    } catch (error) {
      throw new ScaleboxError(`Failed to get current window ID: ${error}`)
    }
  }

  async getWindowTitle(windowId: string): Promise<string> {
    try {
      const result = await this.executeCommand(`DISPLAY=${this._display} xdotool getwindowname ${windowId}`)
      return result.stdout.trim()
    } catch (error) {
      throw new ScaleboxError(`Failed to get window title: ${error}`)
    }
  }

  async getApplicationWindows(application: string): Promise<string[]> {
    try {
      const result = await this.executeCommand(`DISPLAY=${this._display} xdotool search --onlyvisible --class ${application}`)
      return result.stdout.trim().split('\n').filter(id => id.length > 0)
    } catch (error) {
      throw new ScaleboxError(`Failed to get application windows: ${error}`)
    }
  }

  async getAllWindows(): Promise<WindowInfo[]> {
    try {
      const result = await this.executeCommand(`DISPLAY=${this._display} xdotool search --onlyvisible --name ".*"`)
      const windowIds = result.stdout.trim().split('\n').filter(id => id.length > 0)
      
      const windows: WindowInfo[] = []
      for (const windowId of windowIds) {
        try {
          const title = await this.getWindowTitle(windowId)
          windows.push({
            id: windowId,
            title: title,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            visible: true
          })
        } catch (error) {
          // 忽略无法获取标题的窗口
          console.warn(`Failed to get title for window ${windowId}:`, error)
        }
      }
      return windows
    } catch (error) {
      throw new ScaleboxError(`Failed to get all windows: ${error}`)
    }
  }

  async focusWindow(windowId: string): Promise<void> {
    try {
      await this.executeCommand(`DISPLAY=${this._display} xdotool windowactivate ${windowId}`)
    } catch (error) {
      throw new ScaleboxError(`Failed to focus window: ${error}`)
    }
  }

  async closeWindow(windowId: string): Promise<void> {
    try {
      await this.executeCommand(`DISPLAY=${this._display} xdotool windowclose ${windowId}`)
    } catch (error) {
      throw new ScaleboxError(`Failed to close window: ${error}`)
    }
  }

  async minimizeWindow(windowId: string): Promise<void> {
    try {
      await this.executeCommand(`DISPLAY=${this._display} xdotool windowminimize ${windowId}`)
    } catch (error) {
      throw new ScaleboxError(`Failed to minimize window: ${error}`)
    }
  }

  async maximizeWindow(windowId: string): Promise<void> {
    try {
      await this.executeCommand(`DISPLAY=${this._display} xdotool windowmaximize ${windowId}`)
    } catch (error) {
      throw new ScaleboxError(`Failed to maximize window: ${error}`)
    }
  }

  async resizeWindow(windowId: string, width: number, height: number): Promise<void> {
    try {
      await this.executeCommand(`DISPLAY=${this._display} xdotool windowsize ${windowId} ${width} ${height}`)
    } catch (error) {
      throw new ScaleboxError(`Failed to resize window: ${error}`)
    }
  }

  async moveWindow(windowId: string, x: number, y: number): Promise<void> {
    try {
      await this.executeCommand(`DISPLAY=${this._display} xdotool windowmove ${windowId} ${x} ${y}`)
    } catch (error) {
      throw new ScaleboxError(`Failed to move window: ${error}`)
    }
  }

  /**
   * 屏幕操作
   */
  async getScreenSize(): Promise<ScreenSize> {
    try {
      const result = await this.executeCommand(`DISPLAY=${this._display} xrandr`)
      
      // 查找包含分辨率信息的行，格式类似 "1024x768"
      const match = result.stdout.match(/(\d+x\d+)/)
      if (!match) {
        throw new Error(`Failed to parse screen size from output: ${result.stdout}`)
      }
      
      try {
        const [width, height] = match[1].split('x').map(Number)
        if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
          throw new Error(`Invalid screen size format: ${match[1]}`)
        }
        return { width, height }
      } catch (parseError) {
        throw new Error(`Invalid screen size format: ${match[1]}`)
      }
    } catch (error) {
      throw new ScaleboxError(`Failed to get screen size: ${error}`)
    }
  }

  async captureScreen(x?: number, y?: number, width?: number, height?: number): Promise<string> {
    try {
      const geometry = x !== undefined && y !== undefined && width !== undefined && height !== undefined
        ? `-geometry ${width}x${height}+${x}+${y}`
        : ''
      const result = await this.executeCommand(`import ${geometry} - window root /tmp/screenshot.png`)
      return '/tmp/screenshot.png'
    } catch (error) {
      throw new ScaleboxError(`Failed to capture screen: ${error}`)
    }
  }

  async findImage(imagePath: string, confidence: number = 0.8): Promise<CursorPosition | null> {
    try {
      // 先截图
      await this.executeCommand('import -window root /tmp/screenshot.png')
      
      // 使用 OpenCV 进行图像匹配
      const pythonScript = `
import cv2
import numpy as np
import sys
import os

try:
    # 检查文件是否存在
    if not os.path.exists('/tmp/screenshot.png'):
        print('null')
        sys.exit(0)
    
    if not os.path.exists('${imagePath}'):
        print('null')
        sys.exit(0)
    
    # 读取屏幕截图
    screenshot = cv2.imread('/tmp/screenshot.png')
    template = cv2.imread('${imagePath}')
    
    if screenshot is None or template is None:
        print('null')
        sys.exit(0)
    
    # 模板匹配
    result = cv2.matchTemplate(screenshot, template, cv2.TM_CCOEFF_NORMED)
    min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(result)
    
    if max_val >= ${confidence}:
        # 返回模板中心点坐标
        center_x = max_loc[0] + template.shape[1] // 2
        center_y = max_loc[1] + template.shape[0] // 2
        print(f'{center_x},{center_y}')
    else:
        print('null')
        
except Exception as e:
    print('null')
`
      
      const result = await this.executeCommand(`python3 -c "${pythonScript}"`)
      
      if (result.stdout.trim() === 'null') {
        return null
      }
      
      const [x, y] = result.stdout.trim().split(',').map(Number)
      return { x, y }
    } catch (error) {
      throw new ScaleboxError(`Failed to find image: ${error}`)
    }
  }

  async findText(text: string): Promise<CursorPosition | null> {
    try {
      // 先截图
      await this.executeCommand('import -window root /tmp/screenshot.png')
      
      // 使用 Tesseract OCR 识别文本
      const pythonScript = `
import pytesseract
from PIL import Image
import re
import sys
import os

try:
    # 检查文件是否存在
    if not os.path.exists('/tmp/screenshot.png'):
        print('null')
        sys.exit(0)
    
    # 读取截图
    image = Image.open('/tmp/screenshot.png')
    
    # OCR 识别
    data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
    
    # 查找目标文本
    target_text = '${text}'
    for i, conf in enumerate(data['conf']):
        if int(conf) > 30:  # 置信度阈值
            word = data['text'][i].strip()
            if target_text.lower() in word.lower():
                x = data['left'][i] + data['width'][i] // 2
                y = data['top'][i] + data['height'][i] // 2
                print(f'{x},{y}')
                sys.exit(0)
    
    print('null')
    
except Exception as e:
    print('null')
`
      
      const result = await this.executeCommand(`python3 -c "${pythonScript}"`)
      
      if (result.stdout.trim() === 'null') {
        return null
      }
      
      const [x, y] = result.stdout.trim().split(',').map(Number)
      return { x, y }
    } catch (error) {
      throw new ScaleboxError(`Failed to find text: ${error}`)
    }
  }

  /**
   * 应用程序管理
   */
  async launch(application: string, uri?: string): Promise<void> {
    try {
      const command = uri 
        ? `DISPLAY=${this._display} gtk-launch ${application} "${uri}"` 
        : `DISPLAY=${this._display} gtk-launch ${application}`
      await this.executeCommand(command)
    } catch (error) {
      throw new ScaleboxError(`Failed to launch application: ${error}`)
    }
  }

  async open(fileOrUrl: string): Promise<void> {
    try {
      await this.executeCommand(`DISPLAY=${this._display} xdg-open "${fileOrUrl}"`)
    } catch (error) {
      throw new ScaleboxError(`Failed to open file or URL: ${error}`)
    }
  }

  async getRunningApplications(): Promise<string[]> {
    try {
      const result = await this.executeCommand('ps -eo comm= | sort | uniq')
      return result.stdout.trim().split('\n').filter(app => app.length > 0)
    } catch (error) {
      throw new ScaleboxError(`Failed to get running applications: ${error}`)
    }
  }

  async isApplicationRunning(application: string): Promise<boolean> {
    try {
      const result = await this.executeCommand(`pgrep -f "${application}"`)
      return result.stdout.trim().length > 0
    } catch (error) {
      return false
    }
  }

  async closeApplication(application: string): Promise<void> {
    try {
      await this.executeCommand(`pkill -f "${application}"`)
    } catch (error) {
      throw new ScaleboxError(`Failed to close application: ${error}`)
    }
  }

  /**
   * 获取沙箱ID
   */
  getSandboxId(): string | undefined {
    return this.sandbox.sandboxId
  }

  /**
   * 获取沙箱信息
   */
  async getInfo() {
    return await this.sandbox.getInfo()
  }

  /**
   * 关闭桌面环境
   */
  async close(): Promise<void> {
    await this.sandbox.kill()
  }

  /**
   * 执行命令的辅助方法 - 公共方法，供VNC服务器调用
   */
  async executeCommand(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    try {
      // 通过沙箱执行命令
      const result = await this.sandbox.commands.run(command)
      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode
      }
    } catch (error) {
      throw new ScaleboxError(`Failed to execute command: ${error}`)
    }
  }
}
