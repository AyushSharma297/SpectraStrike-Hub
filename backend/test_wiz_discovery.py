#!/usr/bin/env python3
"""
Standalone WiZ discovery test script.
Run this to debug WiZ light detection issues.

Usage:
    python test_wiz_discovery.py
"""

import socket
import json
import logging
import time
import sys

logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("wiz_discovery_test")

def get_local_subnet():
    """Get the primary local subnet."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        parts = ip.split('.')
        return f"{parts[0]}.{parts[1]}.{parts[2]}."
    except Exception as e:
        logger.warning(f"Could not determine subnet: {e}")
        return "192.168.1."

def test_wiz_discovery(timeout=5.0):
    """Test WiZ discovery with detailed logging."""
    logger.info("=" * 60)
    logger.info("Starting WiZ Light Discovery Test")
    logger.info("=" * 60)
    
    subnet = get_local_subnet()
    logger.info(f"Using subnet: {subnet}0/24")
    
    # Create send and receive sockets
    send_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    send_sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    send_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    
    recv_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    recv_sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    recv_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    recv_sock.settimeout(0.5)
    
    discovered_devices = []
    
    try:
        # Try to bind to port 38899
        try:
            recv_sock.bind(("0.0.0.0", 38899))
            logger.info("✓ Successfully bound to port 38899")
        except OSError as e:
            logger.warning(f"⚠ Could not bind to port 38899: {e}")
            logger.info("  Trying to bind to any available port...")
            recv_sock.bind(("0.0.0.0", 0))
            bound_port = recv_sock.getsockname()[1]
            logger.info(f"✓ Bound to port {bound_port}")
        
        # Multiple WiZ discovery methods
        discovery_methods = [
            (b'{"method":"getSystemConfig","params":{}}', "getSystemConfig"),
            (b'{"method":"getStatus","params":{}}', "getStatus"),
            (b'{"method":"getPilot","params":{}}', "getPilot"),
            (b'{"method":"getAvailableMode","params":{}}', "getAvailableMode"),
        ]
        
        logger.info("\nSending discovery packets...")
        logger.info("-" * 60)
        
        # Send discovery packets
        packets_sent = 0
        
        # Global broadcast
        for msg, method_name in discovery_methods:
            try:
                send_sock.sendto(msg, ('255.255.255.255', 38899))
                logger.debug(f"  Sent {method_name} to 255.255.255.255:38899")
                packets_sent += 1
            except Exception as e:
                logger.debug(f"  Failed to send {method_name} to broadcast: {e}")
        
        # Subnet broadcast
        for msg, method_name in discovery_methods:
            try:
                send_sock.sendto(msg, (f"{subnet}255", 38899))
                logger.debug(f"  Sent {method_name} to {subnet}255:38899")
                packets_sent += 1
            except Exception as e:
                logger.debug(f"  Failed to send to {subnet}255: {e}")
        
        # Unicast to all IPs in subnet
        logger.info(f"Sending unicast packets to {subnet}1-254...")
        unicast_count = 0
        for i in range(1, 255):
            for msg, method_name in discovery_methods:
                try:
                    send_sock.sendto(msg, (f"{subnet}{i}", 38899))
                    unicast_count += 1
                except Exception:
                    pass
        packets_sent += unicast_count
        logger.info(f"  Sent {unicast_count} unicast packets")
        
        logger.info(f"\nTotal packets sent: {packets_sent}")
        logger.info("Listening for responses...")
        logger.info("-" * 60)
        
        # Collect responses
        start_time = time.monotonic()
        end_time = start_time + timeout
        responses_received = 0
        
        while time.monotonic() < end_time:
            try:
                data, addr = recv_sock.recvfrom(2048)
                ip = addr[0]
                responses_received += 1
                
                # Try to parse as JSON
                try:
                    res = json.loads(data.decode('utf-8', errors='ignore'))
                    logger.info(f"\n✓ Response from {ip}:")
                    logger.info(f"  Data: {json.dumps(res, indent=2)[:200]}")
                    
                    # Extract info
                    mac = None
                    model = None
                    if isinstance(res, dict) and isinstance(res.get("result"), dict):
                        mac = res["result"].get("mac")
                        model = res["result"].get("modelType") or res["result"].get("model")
                    if mac is None and isinstance(res, dict):
                        mac = res.get("mac")
                        model = model or res.get("modelType") or res.get("model")
                    
                    discovered_devices.append({
                        "ip": ip,
                        "mac": mac,
                        "model": model
                    })
                except Exception as e:
                    raw = data[:100].decode('utf-8', errors='replace')
                    logger.info(f"\n? Response from {ip} (non-JSON):")
                    logger.info(f"  Raw: {raw}")
                    discovered_devices.append({
                        "ip": ip,
                        "mac": None,
                        "model": None
                    })
            except socket.timeout:
                continue
            except Exception as e:
                logger.warning(f"Error receiving: {e}")
                break
        
        logger.info("\n" + "=" * 60)
        logger.info(f"RESULTS: Found {len(discovered_devices)} device(s)")
        logger.info("=" * 60)
        
        if discovered_devices:
            for i, dev in enumerate(discovered_devices, 1):
                logger.info(f"\nDevice {i}:")
                logger.info(f"  IP: {dev['ip']}")
                if dev['mac']:
                    logger.info(f"  MAC: {dev['mac']}")
                if dev['model']:
                    logger.info(f"  Model: {dev['model']}")
        else:
            logger.warning("\n⚠ No WiZ devices discovered!")
            logger.warning("\nPossible causes:")
            logger.warning("  1. WiZ lights are not on the network")
            logger.warning("  2. WiZ lights are on a different subnet")
            logger.warning("  3. Firewall is blocking UDP port 38899")
            logger.warning("  4. Router has AP isolation enabled")
            logger.warning("  5. WiZ lights are offline or in setup mode")
        
        return discovered_devices
        
    finally:
        send_sock.close()
        recv_sock.close()
        logger.info(f"\n✓ Sockets closed. Total responses: {responses_received}")

if __name__ == "__main__":
    try:
        devices = test_wiz_discovery(timeout=10.0)
        sys.exit(0 if devices else 1)
    except KeyboardInterrupt:
        logger.info("\nTest interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Test failed: {e}", exc_info=True)
        sys.exit(1)
