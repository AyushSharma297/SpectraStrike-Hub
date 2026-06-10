import socket
import asyncio
import urllib.request
import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("scanner")

def get_all_local_subnets():
    """Identifies all standard private IPv4 subnets (RFC 1918) active on this machine."""
    subnets = set()
    try:
        hostname = socket.gethostname()
        # Resolve all IPs for the hostname
        for info in socket.getaddrinfo(hostname, None):
            ip = info[4][0]
            # Verify if standard IPv4 private range
            # Filters out VPNs like Radmin (26.x.x.x) or Hamachi (25.x.x.x)
            parts = ip.split('.')
            if len(parts) == 4:
                try:
                    p0 = int(parts[0])
                    p1 = int(parts[1])
                    is_private = (
                        p0 == 192 and p1 == 168 or
                        p0 == 10 or
                        (p0 == 172 and 16 <= p1 <= 31)
                    )
                    if is_private:
                        subnets.add(f"{parts[0]}.{parts[1]}.{parts[2]}.")
                except ValueError:
                    pass
    except Exception as e:
        logger.warning(f"Error querying network interfaces via getaddrinfo: {e}")
        
    # Standard connection fallback
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        parts = ip.split('.')
        subnets.add(f"{parts[0]}.{parts[1]}.{parts[2]}.")
    except Exception:
        pass
        
    if not subnets:
        subnets.add("192.168.1.") # Default fallback
        
    logger.info(f"Discovered private subnets to scan: {list(subnets)}")
    return list(subnets)

async def check_wled_ip(ip, timeout=0.4):
    """Checks if a given IP has WLED running on port 80."""
    try:
        conn = asyncio.open_connection(ip, 80)
        reader, writer = await asyncio.wait_for(conn, timeout=timeout)
        writer.close()
        await writer.wait_closed()
        
        loop = asyncio.get_event_loop()
        def fetch_json():
            url = f"http://{ip}/json/info"
            req = urllib.request.Request(url, method="GET")
            with urllib.request.urlopen(req, timeout=0.6) as response:
                if response.status == 200:
                    return json.loads(response.read().decode())
            return None

        data = await loop.run_in_executor(None, fetch_json)
        if data:
            return {
                "id": f"wled_{ip.replace('.', '_')}",
                "ip": ip,
                "type": "wled",
                "name": data.get("name", f"WLED ({ip})"),
                "led_count": data.get("leds", {}).get("count", 30),
                "version": data.get("ver", "Unknown"),
                "is_mock": False
            }
    except Exception:
        pass
    return None

async def scan_wled_subnet(subnet, timeout=0.4):
    """Scans port 80 of the entire /24 subnet for WLED devices."""
    logger.info(f"Scanning subnet {subnet}0/24 for WLED...")
    tasks = []
    for i in range(1, 255):
        ip = f"{subnet}{i}"
        tasks.append(check_wled_ip(ip, timeout))
    
    results = await asyncio.gather(*tasks)
    wled_devices = [r for r in results if r is not None]
    return wled_devices

async def scan_wiz_broadcast(subnets=None, timeout=3.0):
    """Sends UDP broadcast and unicast packets to discover WiZ lights.
    
    Uses a thread-based blocking recv loop instead of loop.add_reader(),
    which is not supported on Windows ProactorEventLoop (used by uvicorn).
    """
    if subnets is None:
        subnets = get_all_local_subnets()
        
    logger.info("Sending WiZ UDP discovery packets (broadcast + unicast)...")
    
    devices = []
    discovered_ips = set()
    
    def _blocking_scan():
        """Runs blocking UDP discovery in a thread so asyncio is not blocked."""
        # Create two sockets: one for sending, one for receiving broadcasts
        send_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        send_sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        send_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        
        # Receive socket: bind to the broadcast port to listen for responses
        recv_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        recv_sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        recv_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        recv_sock.settimeout(0.5)  # Short timeout per recv attempt
        
        # Try to bind to port 38899 on all interfaces to receive responses
        try:
            recv_sock.bind(("0.0.0.0", 38899))
            logger.debug("Bound to port 38899 for WiZ discovery responses")
        except OSError as e:
            # Port might be in use, bind to any available port instead
            logger.debug(f"Could not bind to port 38899 (may be in use): {e}, using any port instead")
            try:
                recv_sock.bind(("0.0.0.0", 0))
            except Exception as e2:
                logger.warning(f"Could not bind WiZ discovery receive socket: {e2}")
        
        # Try multiple WiZ discovery methods to maximize detection
        discovery_methods = [
            b'{"method":"getSystemConfig","params":{}}',
            b'{"method":"getStatus","params":{}}',
            b'{"method":"getPilot","params":{}}',
            b'{"method":"getAvailableMode","params":{}}',
        ]
        
        try:
            # 1. Global Broadcast
            for msg in discovery_methods:
                try:
                    send_sock.sendto(msg, ('255.255.255.255', 38899))
                    logger.debug(f"Sent WiZ discovery to 255.255.255.255:38899")
                except Exception as e:
                    logger.debug(f"Failed to send broadcast: {e}")
                    
            # 2. Subnet-Specific Broadcast & Unicast Scans
            for subnet in subnets:
                # Subnet broadcast (e.g. 192.168.1.255)
                for msg in discovery_methods:
                    try:
                        send_sock.sendto(msg, (f"{subnet}255", 38899))
                        logger.debug(f"Sent WiZ discovery to {subnet}255:38899")
                    except Exception as e:
                        logger.debug(f"Failed to send to {subnet}255: {e}")
                    
                # Unicast scan (sends direct UDP to every IP in the /24 range)
                # This is extremely effective when router AP/client isolation blocks broadcasts.
                for i in range(1, 255):
                    for msg in discovery_methods:
                        try:
                            send_sock.sendto(msg, (f"{subnet}{i}", 38899))
                        except Exception:
                            pass  # Silently skip individual unicast failures
            
            # 3. Collect responses for the duration of `timeout`
            import time
            end_time = time.monotonic() + timeout
            
            while time.monotonic() < end_time:
                try:
                    data, addr = recv_sock.recvfrom(2048)
                    ip = addr[0]

                    # De-dupe by IP; we still allow updates if parsing succeeds.
                    if ip in discovered_ips:
                        continue

                    raw_text = data[:512].decode('utf-8', errors='replace')
                    logger.debug(f"WiZ response from {ip}: {raw_text[:100]}")

                    discovered = False
                    mac = None
                    model = None
                    is_valid_wiz_response = False

                    try:
                        res = json.loads(data.decode('utf-8', errors='ignore'))
                        is_valid_wiz_response = True

                        # Common response shapes vary by firmware.
                        # 1) {"result": {"mac": "...", "modelType": "..."}}
                        if isinstance(res, dict) and isinstance(res.get("result"), dict):
                            mac = res["result"].get("mac")
                            model = res["result"].get("modelType") or res["result"].get("model")

                        # 2) {"mac": "..."}
                        if mac is None and isinstance(res, dict):
                            mac = res.get("mac")
                            model = model or res.get("modelType") or res.get("model")
                            
                        # 3) Any dict response with "method" or "result" is likely WiZ
                        if isinstance(res, dict) and ("method" in res or "result" in res or "id" in res):
                            is_valid_wiz_response = True

                    except Exception:
                        # Not JSON - but might still be a WiZ device responding
                        res = None
                        # Check if response contains expected patterns
                        if b"method" in data or b"result" in data or len(data) > 10:
                            is_valid_wiz_response = True

                    # Accept discovery if we got a valid WiZ response (JSON or non-JSON pattern match)
                    if is_valid_wiz_response:
                        discovered_ips.add(ip)
                        devices.append({
                            "id": f"wiz_{ip.replace('.', '_')}",
                            "ip": ip,
                            "mac": mac,
                            "type": "wiz",
                            "name": f"WiZ Light ({ip})",
                            "model": model or "Unknown WiZ",
                            "is_mock": False
                        })
                        logger.info(
                            f"Discovered WiZ light at {ip}" + (f" (MAC: {mac})" if mac else "")
                        )
                        discovered = True

                    if not discovered:
                        logger.debug(f"WiZ discovery response from {ip} (unrecognized): {raw_text[:100]}")
                except socket.timeout:
                    # No data received in this window; keep trying until end_time
                    continue
                except OSError:
                    break
        except Exception as e:
            logger.error(f"WiZ broadcast/unicast discovery failed: {e}")
        finally:
            send_sock.close()
            recv_sock.close()
    
    # Run the blocking scan in a thread executor
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, _blocking_scan)
    
    logger.info(f"WiZ scan complete. Found {len(devices)} WiZ device(s).")
    return devices

async def scan_openrgb(timeout=0.5):
    """Checks if OpenRGB server is running on localhost (127.0.0.1:6742)."""
    try:
        conn = asyncio.open_connection("127.0.0.1", 6742)
        reader, writer = await asyncio.wait_for(conn, timeout=timeout)
        writer.close()
        await writer.wait_closed()
        return [{
            "id": "openrgb_pc",
            "ip": "127.0.0.1",
            "type": "openrgb",
            "name": "PC Internal Lights (OpenRGB)",
            "is_mock": False
        }]
    except Exception:
        return []

async def scan_windows_dynamic_lighting():
    """Checks if winsdk is installed and retrieves Windows Dynamic Lighting controllers."""
    try:
        from winsdk.windows.devices.lights import LampArray
        from winsdk.windows.devices.enumeration import DeviceInformation
        selector = LampArray.get_device_selector()
        devices = await DeviceInformation.find_all_async(selector)
        if len(devices) > 0:
            return [{
                "id": "windows_dynamic_lighting",
                "ip": "127.0.0.1",
                "type": "wdl",
                "name": "Windows Dynamic Lighting (PC)",
                "is_mock": False
            }]
    except Exception:
        pass
    return []

async def scan_all():
    """Performs discovery scan over all detected private network subnets."""
    subnets = get_all_local_subnets()
    
    # We will gather WLED scans from all subnets
    wled_tasks = [scan_wled_subnet(subnet) for subnet in subnets]
    wiz_task = scan_wiz_broadcast()
    openrgb_task = scan_openrgb()
    wdl_task = scan_windows_dynamic_lighting()
    
    wled_results = await asyncio.gather(*wled_tasks)
    wleds = []
    for r in wled_results:
        wleds.extend(r)
        
    wizes, orgb, wdls = await asyncio.gather(wiz_task, openrgb_task, wdl_task)
    
    # De-duplicate WLEDs by IP just in case
    seen_ips = set()
    unique_wleds = []
    for w in wleds:
        if w["ip"] not in seen_ips:
            seen_ips.add(w["ip"])
            unique_wleds.append(w)
            
    return unique_wleds + wizes + orgb + wdls


