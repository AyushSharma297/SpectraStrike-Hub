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

async def scan_wiz_broadcast(subnets=None, timeout=1.5):
    """Sends UDP broadcast and unicast packets to discover WiZ lights."""
    if subnets is None:
        subnets = get_all_local_subnets()
        
    logger.info("Sending WiZ UDP discovery packets (broadcast + unicast)...")
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    sock.setblocking(False)
    
    msg = b'{"method":"getSystemConfig","params":{}}'
    devices = []
    discovered_ips = set()
    
    try:
        # 1. Global Broadcast
        try:
            sock.sendto(msg, ('255.255.255.255', 38899))
        except Exception:
            pass
            
        # 2. Subnet-Specific Broadcast & Unicast Scans
        for subnet in subnets:
            # Subnet broadcast (e.g. 192.168.1.255)
            try:
                sock.sendto(msg, (f"{subnet}255", 38899))
            except Exception:
                pass
                
            # Unicast scan (sends direct UDP to every IP in the /24 range)
            # This is extremely effective when router AP/client isolation blocks broadcasts.
            for i in range(1, 255):
                try:
                    sock.sendto(msg, (f"{subnet}{i}", 38899))
                except Exception:
                    pass
                    
        loop = asyncio.get_running_loop()
        end_time = loop.time() + timeout
        
        while loop.time() < end_time:
            time_left = end_time - loop.time()
            if time_left <= 0:
                break
            try:
                fut = loop.create_future()
                def read_callback():
                    if fut.done():
                        return
                    try:
                        data, addr = sock.recvfrom(1024)
                        fut.set_result((data, addr))
                    except Exception as e:
                        fut.set_exception(e)
                
                loop.add_reader(sock.fileno(), read_callback)
                try:
                    data, addr = await asyncio.wait_for(fut, timeout=time_left)
                    ip = addr[0]
                    if ip not in discovered_ips:
                        res = json.loads(data.decode('utf-8'))
                        if "result" in res and "mac" in res["result"]:
                            discovered_ips.add(ip)
                            devices.append({
                                "id": f"wiz_{ip.replace('.', '_')}",
                                "ip": ip,
                                "mac": res["result"]["mac"],
                                "type": "wiz",
                                "name": f"WiZ Light ({ip})",
                                "model": res["result"].get("modelType", "Unknown WiZ"),
                                "is_mock": False
                            })
                finally:
                    loop.remove_reader(sock.fileno())
            except asyncio.TimeoutError:
                break
            except Exception:
                await asyncio.sleep(0.05)
    except Exception as e:
        logger.error(f"WiZ broadcast/unicast discovery failed: {e}")
    finally:
        sock.close()
        
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


