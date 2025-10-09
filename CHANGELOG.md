# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release of Scalebox JavaScript SDK
- Support for multi-language code execution (Python, R, Node.js, TypeScript, Java, Bash)
- Synchronous and asynchronous sandbox execution
- Persistent context management across executions
- Callback subscriptions for stdout, stderr, results, and errors
- Rich result formats (text, html, markdown, svg, png, jpeg, pdf, latex, json, javascript, chart, data)
- E2B API compatibility for seamless migration
- Desktop automation capabilities
- File system operations
- Command execution with background support
- Pseudo-terminal (PTY) support
- Comprehensive test suite with real environment testing
- TypeScript support with full type definitions
- gRPC and REST API clients
- Code interpreter with context management

### Features
- **Multi-language Support**: Python, R, Node.js, Deno/TypeScript, Java/IJAVA, Bash
- **Sandbox Management**: Create, connect, list, pause, resume, and kill sandboxes
- **File Operations**: Read, write, list, move, remove files and directories
- **Process Management**: Run commands synchronously or in background
- **Context Persistence**: Maintain variables and state across executions
- **Real-time Callbacks**: Subscribe to stdout, stderr, results, and errors
- **Rich Results**: Support for multiple output formats
- **Desktop Automation**: GUI application testing and automation
- **Network Operations**: File upload/download capabilities

### Security
- Secure API key management
- Environment variable support
- Input validation and sanitization
- Timeout protection
- Resource limits

### Documentation
- Comprehensive README with examples
- API documentation
- Migration guide from E2B
- Testing documentation
- Authentication guide
- Security best practices

## [1.0.0] - 2024-01-XX

### Added
- Initial release
- Core SDK functionality
- Multi-language support
- E2B compatibility
- Comprehensive documentation
- Test suite

### Security
- API key protection
- Secure communication
- Input validation

### Documentation
- Complete API documentation
- Usage examples
- Migration guide
- Security guidelines
