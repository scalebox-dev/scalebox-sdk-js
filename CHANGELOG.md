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