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
