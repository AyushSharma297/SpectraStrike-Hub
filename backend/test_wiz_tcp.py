#!/usr/bin/env python3
"""
Advanced WiZ light diagnostic tool.
Attempts direct TCP connection to WiZ devices and queries them.
"""

import socket
import json
import logging
import sys

logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("wiz_diagnostics")

def try_connect_wiz(ip, port=38898, timeout=2):
    """Try to connect to a WiZ device via TCP and query it."""
    logger.info(f"\nTesting {ip}:{port}...")
    
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(timeout)
    
    try:
        logger.debug(f"  Attempting TCP connection to {ip}:{port}")
        sock.connect((ip, port))
        logger.info(f"  ✓ Connected to {ip}:{port}")
        
        # Send a getPilot command to query device status
        commands = [
            {"method": "getSystemConfig", "params": {}},
            {"method": "getStatus", "params": {}},
            {"method": "getPilot", "params": {}},
        ]
        
        for cmd in commands:
            try:
                msg = json.dumps(cmd).encode('utf-8')
                sock.sendall(msg)
                logger.debug(f"  Sent: {cmd['method']}")
                
                # Try to receive response
                response_data = b''
                sock.settimeout(0.5)
                while True:
                    try:
                        chunk = sock.recv(1024)
                        if not chunk:
                            break
                        response_data += chunk
                    except socket.timeout:
                        break
                
                if response_data:
                    try:
                        resp = json.loads(response_data.decode('utf-8'))
                        logger.info(f"  ✓ Response: {json.dumps(resp)[:100]}")
                        return True
                    except:
                        logger.debug(f"  Response (non-JSON): {response_data[:50]}")
                        return True
            except Exception as e:
                logger.debug(f"  Command failed: {e}")
        
        return False
        
    except socket.timeout:
        logger.debug(f"  ✗ Timeout connecting to {ip}:{port}")
        return False
    except ConnectionRefusedError:
        logger.debug(f"  ✗ Connection refused by {ip}:{port}")
        return False
    except Exception as e:
        logger.debug(f"  ✗ Error: {e}")
        return False
    finally:
        sock.close()

def scan_subnet_tcp(subnet="192.168.1.", timeout=1):
    """Scan subnet on port 38898 (WiZ TCP control port)."""
    logger.info(f"Scanning {subnet}1-254 on port 38898 (WiZ TCP)...")
    logger.info("This may take a minute...")
    
    found_devices = []
    for i in range(1, 255):
        ip = f"{subnet}{i}"
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(timeout)
            result = sock.connect_ex((ip, 38898))
            sock.close()
            
            if result == 0:
                logger.info(f"  ✓ Port 38898 open on {ip}")
                if try_connect_wiz(ip, 38898):
                    found_devices.append(ip)
        except:
            pass
    
    return found_devices

def main():
    logger.info("=" * 60)
    logger.info("Philips WiZ Light Diagnostic Tool")
    logger.info("=" * 60)
    
    # First, try TCP scan which is more reliable
    logger.info("\nPhase 1: TCP Scan (Port 38898)")
    logger.info("-" * 60)
    
    devices = scan_subnet_tcp()
    
    if devices:
        logger.info("\n" + "=" * 60)
        logger.info(f"SUCCESS! Found {len(devices)} WiZ device(s):")
        logger.info("=" * 60)
        for ip in devices:
            logger.info(f"  - {ip}")
        return 0
    else:
        logger.warning("\n" + "=" * 60)
        logger.warning("No WiZ devices found!")
        logger.warning("=" * 60)
        logger.warning("\nPossible causes:")
        logger.warning("  1. No WiZ lights connected to the network")
        logger.warning("  2. WiZ lights are offline or in setup mode")
        logger.warning("  3. WiZ lights are on a different subnet")
        logger.warning("  4. Firewall or antivirus is blocking connectivity")
        logger.warning("  5. Network uses VLAN separation preventing discovery")
        logger.warning("\nNext steps:")
        logger.warning("  1. Check if you can ping the WiZ light IP directly")
        logger.warning("  2. Check WiZ light is powered on and connected to WiFi")
        logger.warning("  3. Check your network firewall settings")
        return 1

if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        logger.info("\nInterrupted by user")
        sys.exit(1)
