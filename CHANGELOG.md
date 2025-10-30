# [3.2.0](https://github.com/scalebox-dev/scalebox-sdk-js/compare/v3.1.2...v3.2.0) (2025-10-30)


### Features

* **code-interpreter:** enable chart data transmission and fix media field promotion ([066235d](https://github.com/scalebox-dev/scalebox-sdk-js/commit/066235d71d43d1ac22d5c41e9bed8336ae232960))

## [3.1.2](https://github.com/scalebox-dev/scalebox-sdk-js/compare/v3.1.1...v3.1.2) (2025-10-29)


### Bug Fixes

* **process:** convert BigInt to number for pid fields ([878afea](https://github.com/scalebox-dev/scalebox-sdk-js/commit/878afead68c585728d6a6887bedffdd94a52459f))

## [3.1.1](https://github.com/scalebox-dev/scalebox-sdk-js/compare/v3.1.0...v3.1.1) (2025-10-29)


### Bug Fixes

* **filesystem:** convert BigInt to number for JSON serialization ([e1a76a8](https://github.com/scalebox-dev/scalebox-sdk-js/commit/e1a76a811e08fbfd5d6f6722865804db02716d87))

# [3.1.0](https://github.com/scalebox-dev/scalebox-sdk-js/compare/v3.0.0...v3.1.0) (2025-10-29)


### Features

* **sandbox:** improve isRunning with direct health check ([4e06e5d](https://github.com/scalebox-dev/scalebox-sdk-js/commit/4e06e5d0e51c7fbfebdde6ce22285369e00604d2))

# [3.0.0](https://github.com/scalebox-dev/scalebox-sdk-js/compare/v2.3.1...v3.0.0) (2025-10-27)


### Bug Fixes

* **sandbox:** 修复 connect() 重置 timeout 的关键 bug ([eda5340](https://github.com/scalebox-dev/scalebox-sdk-js/commit/eda5340349d91ffe3ceceea3bc7ce20c78edc639))
* 添加 DEFAULT_SANDBOX_TIMEOUT_MS 导入 ([f45f2b2](https://github.com/scalebox-dev/scalebox-sdk-js/commit/f45f2b2617af191c642be9f890c50b8cb5c4983a))


### BREAKING CHANGES

* **sandbox:** resumeSandbox() 现在需要传入 timeoutMs 参数

## [2.3.1](https://github.com/scalebox-dev/scalebox-sdk-js/compare/v2.3.0...v2.3.1) (2025-10-24)


### Bug Fixes

* populate top-level media fields (png/svg/html) in ExecutionResult ([ccc5803](https://github.com/scalebox-dev/scalebox-sdk-js/commit/ccc5803fc0fb8c79d72f097038ee19eacad8d49f))

# [2.3.0](https://github.com/scalebox-dev/scalebox-sdk-js/compare/v2.2.0...v2.3.0) (2025-10-23)


### Bug Fixes

* implement Sandbox.connect() with proper parameter spreading ([9b861df](https://github.com/scalebox-dev/scalebox-sdk-js/commit/9b861df366469554dadf9f9152817fa348636c48))


### Features

* **tests:** add comprehensive sandbox connect test suite ([b27d50b](https://github.com/scalebox-dev/scalebox-sdk-js/commit/b27d50b7227168af3e3ca7c761b849c848a0455c))

# [2.2.0](https://github.com/scalebox-dev/scalebox-sdk-js/compare/v2.1.0...v2.2.0) (2025-10-22)


### Bug Fixes

* **tests:** update sandbox tests for new API conventions ([a1686df](https://github.com/scalebox-dev/scalebox-sdk-js/commit/a1686dfb99dd27169048863d0f09409408c3ea24))


### Features

* **sandbox:** add runCode convenience method and improve API types ([c853542](https://github.com/scalebox-dev/scalebox-sdk-js/commit/c853542881a1676785f5f9073a3426f36b6e2cb9))

# [2.1.0](https://github.com/scalebox-dev/scalebox-sdk-js/compare/v2.0.2...v2.1.0) (2025-10-22)


### Bug Fixes

* **desktop:** resolve all desktop test failures and improve stability ([8a4c451](https://github.com/scalebox-dev/scalebox-sdk-js/commit/8a4c4516cb7371c11c6516b8d3af48b4476c7c4b))
* **scripts:** correct code-interpreter test path ([c7a9b19](https://github.com/scalebox-dev/scalebox-sdk-js/commit/c7a9b196170f07a45a9ad200768fb4d651c29450))


### Features

* **desktop:** export new VNC Server types ([c819335](https://github.com/scalebox-dev/scalebox-sdk-js/commit/c819335e8764e2b4d80783215733b496586c60bd))

## [2.0.2](https://github.com/scalebox-dev/scalebox-sdk-js/compare/v2.0.1...v2.0.2) (2025-10-21)


### Bug Fixes

* **deps:** upgrade vite to 7.1.11 to fix security vulnerability ([0c31111](https://github.com/scalebox-dev/scalebox-sdk-js/commit/0c31111fd37b7a842597dd5a9216156d668420ed))

## [2.0.1](https://github.com/scalebox-dev/scalebox-sdk-js/compare/v2.0.0...v2.0.1) (2025-10-13)


### Bug Fixes

* implement timeout and keepalive for commands and pty ([6f98150](https://github.com/scalebox-dev/scalebox-sdk-js/commit/6f98150687b66db83c215dab158181612d269023))

# [2.0.0](https://github.com/scalebox-dev/scalebox-sdk-js/compare/v1.0.0...v2.0.0) (2025-10-10)


### Bug Fixes

* Commands and PTY modules now use gRPC instead of HTTP API ([72c83ed](https://github.com/scalebox-dev/scalebox-sdk-js/commit/72c83ed87d87ce2260faeabbb03f1ea86f181ebb))
* resolve merge conflict and update version to 1.0.1 ([0b82c82](https://github.com/scalebox-dev/scalebox-sdk-js/commit/0b82c82fc6a9d4db38b385bd95431703ac39c69f))


### BREAKING CHANGES

* Commands and PTY modules now use gRPC instead of HTTP API

# 1.0.0 (2025-10-09)


### Bug Fixes

* correct pnpm installation order in CI workflow ([15ec2aa](https://github.com/scalebox-dev/scalebox-sdk-js/commit/15ec2aaf60118f6882bbcc1b3f701360bcac86fb))
* remove pnpm cache and add lockfile verification ([42377a3](https://github.com/scalebox-dev/scalebox-sdk-js/commit/42377a30121d668cfbd35b9f037b9069cc2ed5fc))
* resolve gRPC import and build issues ([f87ccf9](https://github.com/scalebox-dev/scalebox-sdk-js/commit/f87ccf9c6bf89bad1166129771833e3328359e18))
* resolve semantic-release configuration issues ([48c0923](https://github.com/scalebox-dev/scalebox-sdk-js/commit/48c0923ef4a9afd2c6dff72614c3d8c88c7b187a))
* update CI cache configuration to use pnpm ([3eb115e](https://github.com/scalebox-dev/scalebox-sdk-js/commit/3eb115ed8ca490a2f853a21fbe2441a6ca66bba2))
* update pnpm version to match lockfile version ([4a8e588](https://github.com/scalebox-dev/scalebox-sdk-js/commit/4a8e588772c4f457130778bc8463c80eb4f67125))
* update test script and fix timeout test ([baa03e7](https://github.com/scalebox-dev/scalebox-sdk-js/commit/baa03e720ad53b2008ac1f9381b9aaf5271b0730))


### Features

* enhance CI with version checking and auto-release ([7aef9d0](https://github.com/scalebox-dev/scalebox-sdk-js/commit/7aef9d04e25f3563062ff55672f4769da4261e97))
* implement automated semantic release workflow ([5cbfa2d](https://github.com/scalebox-dev/scalebox-sdk-js/commit/5cbfa2d087b9076412a9332bd5366c93d350a3d4))
* include generated gRPC files in repository ([fa95d44](https://github.com/scalebox-dev/scalebox-sdk-js/commit/fa95d44b557b67b391fb3b76e2ade6ec946ef192))
* initial release preparation ([8cc6483](https://github.com/scalebox-dev/scalebox-sdk-js/commit/8cc6483ac3e2914ae5c65a466e5ccdb446c40bfe))
* optimize testing infrastructure for CI/CD ([ed7b2bd](https://github.com/scalebox-dev/scalebox-sdk-js/commit/ed7b2bd381f1ff5fc2ed09077806bb939bb36b71))
* prepare for initial npm publication ([98ec332](https://github.com/scalebox-dev/scalebox-sdk-js/commit/98ec3320b7622d91d28b96925d505ccf9f17b78b))

# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Fixed
- **[CRITICAL]** Fixed timeout reset bug in `Sandbox.connect()` method
  - Previously, calling `Sandbox.connect(sandboxId)` without `timeoutMs` parameter would reset the sandbox timeout to the default 5 minutes
  - This caused customer-reported issue where a 30-minute sandbox was reset to 5 minutes after reconnection
  - Now, `connect()` only updates timeout when `timeoutMs` is explicitly provided, preserving the existing timeout otherwise
  - **Pause/Resume Safety**: When resuming a paused sandbox, a new timeout is automatically set to prevent immediate timeout after long pause periods
  - Added comprehensive test suite (`timeout-preservation.test.ts`) to verify the fix
  - **Breaking Change**: If you relied on `connect()` resetting timeout to 5 minutes, you must now explicitly pass `{ timeoutMs: 300000 }`

### Changed
- **Enhanced** `resumeSandbox()` method to accept `timeoutMs` parameter
  - When resuming a paused sandbox, a new timeout is set (default 5 minutes) to ensure the sandbox has adequate running time
  - This prevents the issue where a sandbox paused for a long time would immediately timeout after resuming
  - Similar to E2B's behavior, but with better handling of normal reconnection scenarios

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.2] - 2025-01-10

### Added
- Initial release of Scalebox JavaScript SDK
- Multi-language support (Python, R, JavaScript, TypeScript, Java, Bash)
- Synchronous and asynchronous execution modes
- Persistent context management
- Rich result formats (text, html, markdown, svg, png, jpeg, pdf, latex, json, etc.)
- Comprehensive test suite
- TypeScript definitions
- Professional documentation with badges

### Changed
- **BREAKING**: Commands and PTY modules now use gRPC instead of HTTP API
- Commands and PTY operations now properly handle event streams
- Improved error handling and debugging for process management

### Fixed
- Fixed Commands module to use correct gRPC protocol for process management
- Fixed PTY module to use correct gRPC protocol for terminal operations
- Fixed event stream handling with proper nested event structure
- Fixed process lifecycle management (start, data, end events)
- Fixed stdout/stderr real-time callbacks
- Fixed PTY data streaming and input handling

### Security
- Security audit passed
- No hardcoded API keys or secrets
- Secure dependency management

---

## [Unreleased]

## [0.0.1] - 2025-10-09

### Added
- Initial release
- Core SDK functionality
- Multi-language kernel support
- Comprehensive testing infrastructure
- CI/CD pipeline with automated publishing
- Professional documentation and badges
- Version management scripts
- GitHub Actions workflow
- npm package publication

### Security
- All dependencies updated to latest secure versions
- No vulnerabilities detected
- Secure API key handling through environment variables
