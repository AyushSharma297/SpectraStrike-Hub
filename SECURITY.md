# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in SpectraStrike Hub, please **do not** open a public GitHub issue. Instead, please report it responsibly:

### Reporting Process

1. **Email**: Send a detailed report to [ayushsh762@gmail.com](mailto:ayushsh762@gmail.com) with:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if you have one)

2. **Response**: We will acknowledge receipt within 24 hours and provide an estimated timeline for a fix.

3. **Embargo Period**: We ask that you keep the vulnerability confidential until a patch is released. Typically:
   - Critical vulnerabilities: Fixed within 7 days
   - High-severity vulnerabilities: Fixed within 14 days
   - Medium-severity vulnerabilities: Fixed within 30 days

4. **Disclosure**: Once a fix is released, we will:
   - Release a patch version (PATCH or MINOR version bump)
   - Publish a security advisory
   - Credit you (unless you prefer anonymity)
   - Update this document with mitigations if applicable

## Security Considerations

### What We Focus On

- **Dependency vulnerabilities**: Keeping packages up-to-date
- **Authentication & access control**: Device discovery and network security
- **Data validation**: Malformed input handling
- **Encryption**: Secure communication with connected devices
- **Injection attacks**: Command/protocol injection prevention

### Known Limitations

1. **Local Network Only**: SpectraStrike Hub is designed for local network use. It should **not** be exposed directly to the internet without proper security controls (firewall, VPN, etc.)

2. **Network Assumptions**: The hub assumes a trusted local network and does not implement authentication between the hub and connected devices.

3. **Data Persistence**: Configuration is stored in `hub_data.json` without encryption. Protect this file appropriately on your system.

### Best Practices for Users

1. **Firewall Rules**: Keep SpectraStrike Hub isolated to your local network (LAN)
2. **System Security**: Run the application with minimal necessary privileges
3. **Updates**: Keep Python, Node.js, and all dependencies current
4. **Credentials**: If you add remote device access in the future, use strong credentials
5. **Network Isolation**: For sensitive deployments, use a separate WiFi network or VLAN

## Security Updates

We release security patches as:
- **Critical**: Immediate patch release (e.g., 1.0.1)
- **High**: Within 1-2 weeks
- **Medium**: Within monthly releases

Subscribe to [GitHub releases](https://github.com/AyushSharma297/SpectraStrike-Hub/releases) to stay informed.

## Dependency Management

We use:
- `pip audit` for Python dependencies
- `npm audit` for Node.js dependencies
- Regular dependency updates via automated tools

All reported vulnerabilities are addressed before release.

## Scope

### In Scope

- Code vulnerabilities in this repository
- Dependency vulnerabilities that affect this project
- Network protocol implementations (WiZ, WLED, OpenRGB)
- Authentication/authorization flaws

### Out of Scope

- Vulnerabilities in upstream projects (report directly to their maintainers)
- Social engineering or phishing (contact GitHub directly)
- Third-party service vulnerabilities (not under our control)

## Legal

By reporting a vulnerability, you agree that:
- You will not publicly disclose the vulnerability before a fix is released
- You will provide complete, accurate information
- You will not exploit the vulnerability beyond what is necessary to demonstrate it
- You will follow responsible disclosure practices

Thank you for helping keep SpectraStrike Hub secure! 🔒
