# Security Policy

## Supported Versions

We release patches for security vulnerabilities in the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please follow these steps:

1. **Do not** create a public GitHub issue
2. Email us at security@scalebox.dev with the following information:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

3. We will respond within 48 hours
4. We will work with you to resolve the issue
5. We will coordinate the disclosure timeline

## Security Best Practices

When using this SDK, please follow these security best practices:

### API Key Management
- Never commit API keys to version control
- Use environment variables for API keys
- Rotate API keys regularly
- Use the least privilege principle

### Environment Variables
```bash
# Good: Use environment variables
export SCALEBOX_API_KEY=your_api_key_here

# Bad: Hardcode in source code
const apiKey = "sk-1234567890abcdef"
```

### Code Execution
- Be cautious when executing untrusted code
- Validate all inputs before execution
- Use appropriate timeouts
- Monitor resource usage

### Network Security
- Use HTTPS for all API communications
- Validate SSL certificates
- Be aware of network security policies

## Security Features

This SDK includes several security features:

- **Input Validation**: All inputs are validated before processing
- **Timeout Protection**: Built-in timeouts prevent runaway processes
- **Resource Limits**: Automatic resource management
- **Secure Communication**: All API calls use HTTPS
- **Token Management**: Secure handling of authentication tokens

## Vulnerability Disclosure

We follow responsible disclosure practices:

1. **Initial Response**: Within 48 hours
2. **Status Updates**: Weekly during investigation
3. **Resolution**: As quickly as possible
4. **Public Disclosure**: Coordinated with the reporter

## Contact

For security-related questions or to report vulnerabilities:

- Email: security@scalebox.dev
- Response time: Within 48 hours
- Encryption: We accept PGP encrypted emails

## Security Updates

Security updates are released as:
- **Critical**: Immediate release
- **High**: Within 7 days
- **Medium**: Within 30 days
- **Low**: Next regular release

Subscribe to our security mailing list for updates.
