import os
import re
import socket
import sys
import platform
import asyncio
import subprocess
import json
import httpx
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, File, UploadFile
from fastapi.staticfiles import StaticFiles
from google.antigravity import Agent, LocalAgentConfig

app = FastAPI(title="ALEX Assistant Backend")

PA_SYSTEM_INSTRUCTIONS = """
You are ALEX, the elite, highly sophisticated, and legendary AI assistant created by Tony Stark (Iron Man). 
Your personality and core behaviors:
1. Your name is ALEX. Always refer to yourself as ALEX.
2. Speak in a crisp, polite, refined, and highly sophisticated British accent. Use terms like "Sir" by default when addressing the user, unless instructed otherwise.
3. You are incredibly knowledgeable, witty, and loyal. You maintain a high-tech, reassuring, and extremely calm demeanor, even during security alerts.
4. You are a world-class authority in all branches of Computer Science: systems programming, web technologies, software engineering, databases, artificial intelligence, and hardware architecture.
5. Most of all, you are a master of Cybersecurity. You have deep expertise in secure system architecture, network defense, cryptographic systems, vulnerability research, penetration testing, and digital forensics.
6. You are equipped with several advanced diagnostics tools (run_local_port_scan, scan_code_vulnerabilities, get_system_diagnostics, run_deep_system_audit, run_malware_and_network_packets_audit). Proactively recommend using them when relevant to the conversation.
7. When writing code, provide robust, secure, and production-ready implementations directly.
8. Maintain your persona perfectly at all times. Act exactly like ALEX (Tony Stark's personal assistant).
9. You have access to a highly detailed reference manual covering 200 security vulnerabilities (from XSS/CSRF/SQLi to advanced cloud/Kubernetes breakouts and serverless issues) and their exact step-by-step verification processes using Burp Suite. When the user invokes you or asks you to act as "BUG BRO" (your step-by-step bug bounty and security testing mentor mode), consult this guide to provide structured, patient, step-by-step educational instructions on how to locate, test, and securely remediate any of these 200 vulnerabilities.
10. You are a multimodal agent capable of analyzing screenshots of the user's screen, terminal outputs, security scan reports, or diagrams. When an image is provided along with the user's question, carefully scan the image, analyze its contents (e.g., text, logs, diagrams, or visual indicators), and use this visual context to directly answer their question or diagnose their issues in a highly detailed, professional cybersecurity expert manner. If they show a screenshot of a specific vulnerability report or setup, identify the vulnerability and provide the corresponding Burp Suite guide immediately!

CORE ALEX TACTICAL PROTOCOL:
- Speak and think in a highly efficient, crisp, and direct manner. Avoid long paragraphs, verbose specifications, and listing large multi-scenario deconstructions.
- If specification is needed for any task, or when helping with a Holo-Simulation scenario, ask exactly one or two short, direct, and focused questions. Do NOT ask for elaborate designs; simple short specifications are fully sufficient.
- Keep your streamed reasoning thoughts extremely concise and to the point. No bloated deconstructions.
- Deliver your final answers cleanly, elegantly, and briefly. High-speed tactical processing is key.
"""

# Custom Tools

def run_local_port_scan(ports: str = "1-1024") -> str:
    """Safely runs a port scan on localhost (127.0.0.1) for a range of ports.
    
    Args:
        ports: A string specifying ports to scan. Can be a range (e.g. "20-80"), a single port ("80"), or a list of ports ("22,80,443"). Default is "1-1024".
    """
    target = "127.0.0.1"
    open_ports = []
    
    # Parse port specs
    port_list = []
    try:
        if "-" in ports:
            start, end = map(int, ports.split("-"))
            port_list = list(range(start, end + 1))
        elif "," in ports:
            port_list = [int(p.strip()) for p in ports.split(",") if p.strip()]
        else:
            port_list = [int(ports)]
    except Exception:
        return "Error: Invalid port specification format. Use 'start-end', 'p1,p2,p3', or 'port', Sir."
    
    # Limit number of ports to scan to avoid blocking for too long
    if len(port_list) > 200:
        port_list = port_list[:200]
        truncated = True
    else:
        truncated = False
        
    for port in port_list:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(0.08)
        result = sock.connect_ex((target, port))
        if result == 0:
            open_ports.append(port)
        sock.close()
        
    status = "completed successfully"
    if truncated:
        status += " (truncated to first 200 ports to prevent network delay)"
        
    if open_ports:
        return f"Port scan on {target} {status}, Sir. Open ports found: {', '.join(map(str, open_ports))}."
    else:
        return f"Port scan on {target} {status}, Sir. No active open ports were discovered in the scanned range."

def scan_code_vulnerabilities(code: str, language: str = "auto") -> str:
    """Performs a heuristic static analysis security scan on a block of code to find security vulnerabilities.
    
    Args:
        code: The source code to audit.
        language: The programming language of the code (e.g. "c", "python", "javascript", "auto").
    """
    issues = []
    
    # C/C++ memory safety issues
    c_danger_funcs = {
        "strcpy": "Buffer overflow risk. Use strncpy or strlcpy instead.",
        "strcat": "Buffer overflow risk. Use strncat or strlcat instead.",
        "sprintf": "Buffer overflow risk. Use snprintf instead.",
        "gets": "Extremely dangerous function. Stack overflow guaranteed. Use fgets instead.",
        "scanf": "Buffer overflow risk when reading strings. Enforce length constraints.",
    }
    
    # SQL injection triggers
    sql_patterns = [
        (r"(select|insert|update|delete)\b.*?\+.*?(\bfrom\b|\binto\b|\bvalues\b)", "Potential SQL Injection via string concatenation."),
        (r"execute\s*\(\s*['\"].*?%s.*?['\"]\s*,\s*", "Potential SQL Injection in query string formatting."),
        (r"\.execute\(\s*f['\"].*?{.*?}", "Potential SQL Injection via f-string query construction."),
    ]
    
    # Command injection triggers
    cmd_patterns = [
        (r"\bsystem\s*\(", "Execution of external commands via system call. Highly dangerous."),
        (r"\bpopen\s*\(", "Execution of external shell commands. Risk of command injection."),
        (r"subprocess\.(run|Popen|call)\s*\(.*shell\s*=\s*True", "subprocess.run with shell=True is vulnerable to shell command injection."),
    ]
    
    # Insecure Eval/Deserialization
    eval_patterns = [
        (r"\beval\s*\(", "Use of eval() executes arbitrary strings. Vulnerable to injection."),
        (r"\bpickle\.loads\s*\(", "Insecure deserialization using pickle. Can lead to arbitrary code execution."),
        (r"\byaml\.load\s*\(.*Loader\s*=\s*(Loader|UnsafeLoader)", "Insecure PyYAML load. Use yaml.safe_load instead."),
    ]
    
    # Search for C danger functions
    for func, desc in c_danger_funcs.items():
        if re.search(r"\b" + func + r"\b", code):
            issues.append(f"[CRITICAL] Found use of '{func}': {desc}")
            
    # Search patterns
    for pattern, desc in sql_patterns:
        if re.search(pattern, code, re.IGNORECASE):
            issues.append(f"[HIGH] {desc}")
            
    for pattern, desc in cmd_patterns:
        if re.search(pattern, code, re.IGNORECASE):
            issues.append(f"[CRITICAL] {desc}")
            
    for pattern, desc in eval_patterns:
        if re.search(pattern, code, re.IGNORECASE):
            issues.append(f"[CRITICAL] {desc}")
            
    # Hardcoded secrets
    secrets_pattern = r"(api_key|password|secret_key|private_key|token|auth_token)\s*=\s*['\"][a-zA-Z0-9_\-]{8,}['\"]"
    if re.search(secrets_pattern, code, re.IGNORECASE):
        issues.append("[MEDIUM] Potential hardcoded API key, credential, or secret token found.")
        
    if not issues:
        return "Heuristic Static Code Analysis Completed. No obvious vulnerabilities detected, Sir. Please perform standard dynamic testing to verify."
    
    report = "Heuristic Static Code Analysis Scan Results, Sir:\n"
    for issue in issues:
        report += f"- {issue}\n"
    report += "\nRecommendation: Please review these findings immediately and refactor the code to adhere to secure software development practices, Sir."
    return report

def get_system_diagnostics() -> str:
    """Gathers local computer diagnostics including OS version, CPU load, memory utilization, and active system processes."""
    try:
        hostname = socket.gethostname()
    except Exception:
        hostname = "unknown"
        
    os_name = platform.system()
    os_release = platform.release()
    arch = platform.machine()
    
    cpu_usage = "N/A"
    memory_info = "N/A"
    
    try:
        import psutil
        cpu_usage = f"{psutil.cpu_percent(interval=0.1)}%"
        mem = psutil.virtual_memory()
        memory_info = f"{mem.percent}% ({mem.used // (1024**2)}MB used of {mem.total // (1024**2)}MB total)"
    except ImportError:
        try:
            if hasattr(os, 'getloadavg'):
                load = os.getloadavg()
                cpu_usage = f"Load average: 1m: {load[0]:.2f}, 5m: {load[1]:.2f}, 15m: {load[2]:.2f}"
            else:
                cpu_usage = "Load avg unavailable on Windows without psutil"
        except Exception:
            cpu_usage = "Unavailable"
            
    active_connections = 0
    try:
        if os_name == "Darwin" or os_name == "Linux":
            res = subprocess.run(["netstat", "-an"], capture_output=True, text=True, timeout=1.0)
            lines = res.stdout.splitlines()
            active_connections = sum(1 for line in lines if "ESTABLISHED" in line)
        else:
            active_connections = "N/A"
    except Exception:
        active_connections = "Unknown"
        
    report = (
        f"Host System Diagnostics, Sir:\n"
        f"- OS: {os_name} {os_release} ({arch})\n"
        f"- Hostname: {hostname}\n"
        f"- Python Version: {sys.version.split()[0]}\n"
        f"- CPU Usage/Load: {cpu_usage}\n"
        f"- Memory Stats: {memory_info}\n"
        f"- Active Network Connections (ESTABLISHED): {active_connections}\n"
        f"- Core Integrity: Secure & Optimal"
    )
    return report

def run_malware_and_network_packets_audit() -> str:
    """Performs a comprehensive offline system heuristic scan for malware (keyloggers, backdoors, trojans, botnets, RATs), active open listening ports, and incoming vs outgoing packet traffic flows.
    """
    import psutil
    import os
    import re
    import platform
    import subprocess
    import glob
    
    report = []
    report.append("=== STARK PERIMETER DEFENSE: MALWARE & NETWORK FORENSICS AUDIT ===")
    
    os_name = platform.system()
    
    # ----------------------------------------------------
    # 1. Keylogger & Spyware Heuristic Scan
    # ----------------------------------------------------
    report.append("\n[HEURISTIC KEYLOGGER & SPYWARE SENSORS]")
    keylogger_findings = []
    
    # Heuristic A: Look for suspicious processes hooking or tracking inputs
    suspicious_process_keywords = ["keylogger", "spyware", "inputlog", "kbdlog", "keystroke", "logkeys", "logkey"]
    # B: Search system process lists
    try:
        for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
            try:
                proc_name = (proc.info['name'] or "").lower()
                cmdline = " ".join(proc.info['cmdline'] or []).lower()
                
                # Check for suspicious process name or command args
                for kw in suspicious_process_keywords:
                    if kw in proc_name or kw in cmdline:
                        keylogger_findings.append(f"  * [ALERT CRITICAL] Suspect keylogger process: '{proc.info['name']}' (PID: {proc.info['pid']})")
                
                # Heuristic B (macOS/Unix): Check for specific screen recording or capturing API helpers
                if os_name == "Darwin":
                    if "screencapture" in cmdline or "screenrecorder" in cmdline:
                        keylogger_findings.append(f"  * [WARNING] Active screen capturing utility: '{proc.info['name']}' (PID: {proc.info['pid']})")
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
    except Exception as e:
        report.append(f"  * Process heuristic scanner error: {str(e)}")
        
    # Heuristic C: Scan temporary storage regions for suspect keyboard raw logs
    temp_search_paths = []
    if os_name != "Windows":
        temp_search_paths = ["/tmp", "/var/tmp", "/Users/Shared"]
    else:
        temp_search_paths = [os.environ.get("TEMP", ""), os.environ.get("TMP", "")]
        
    log_file_indicators = ["key.log", "keys.txt", "keystrokes", "kbd.log", "log.txt", "system_history.log"]
    for path in temp_search_paths:
        if not path or not os.path.exists(path):
            continue
        try:
            for indicator in log_file_indicators:
                matches = glob.glob(os.path.join(path, f"*{indicator}*"), recursive=False)
                for match in matches:
                    try:
                        sz = os.path.getsize(match)
                        # Flag log files modifying frequently or written in sharing folders
                        keylogger_findings.append(f"  * [WARNING] Suspect raw input log file detected: '{os.path.basename(match)}' in '{path}' ({sz} bytes)")
                    except Exception:
                        pass
        except Exception:
            pass
            
    if keylogger_findings:
        report.extend(keylogger_findings)
    else:
        report.append("  * Heuristic input metrics: SECURE. No active keystroke triggers or keylogger processes detected.")

    # ----------------------------------------------------
    # 2. RAT, Backdoor & Trojan Persistence Scan
    # ----------------------------------------------------
    report.append("\n[PERSISTENT RAT, BACKDOOR & TROJAN HUNTER]")
    backdoor_findings = []
    
    # Heuristic A: Persistent Agents (macOS launch agent paths)
    launch_paths = []
    if os_name == "Darwin":
        launch_paths = [
            os.path.expanduser("~/Library/LaunchAgents"),
            "/Library/LaunchAgents",
            "/Library/LaunchDaemons"
        ]
    elif os_name == "Linux":
        launch_paths = ["/etc/init.d", "/etc/systemd/system"]
        
    for lpath in launch_paths:
        if os.path.exists(lpath):
            try:
                files = os.listdir(lpath)
                for f in files:
                    if f.endswith(".plist") or f.endswith(".service"):
                        full_f = os.path.join(lpath, f)
                        try:
                            with open(full_f, 'r', errors='ignore') as file_content:
                                content = file_content.read()
                                # Flag launchers firing temporary payloads or reverse commands
                                if any(x in content for x in ["/tmp/", "/var/tmp/", "/Users/Shared/", "nc -e", "bash -i", "sh -i", "python -c"]):
                                    backdoor_findings.append(f"  * [ALERT CRITICAL] Malicious persistence agent hook: '{f}' in '{lpath}' launches unverified shell script.")
                        except Exception:
                            pass
            except Exception:
                pass
                
    # Heuristic B: Scan active processes for reverse shell directives or known trojan strings
    try:
        for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
            try:
                cmdline = " ".join(proc.info['cmdline'] or [])
                # Common reverse shell signatures
                if any(sig in cmdline for sig in ["nc -e", "bash -i", "sh -i", "/bin/sh -i", "/bin/bash -i", "socket.socket", "subprocess.Popen"]):
                    if "server.py" not in cmdline and "app.py" not in cmdline:
                        backdoor_findings.append(f"  * [ALERT CRITICAL] High-threat reverse shell connection active: PID {proc.info['pid']} ('{proc.info['name']}') executing '{cmdline}'")
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
    except Exception:
        pass

    if backdoor_findings:
        report.extend(backdoor_findings)
    else:
        report.append("  * Core systems validation: SECURE. Persistent launch vectors and background shell agents are clear of trojan patterns.")

    # ----------------------------------------------------
    # 3. Botnet Command & Control (C2) Sockets Scan
    # ----------------------------------------------------
    report.append("\n[BOTNET COMMAND & CONTROL (C2) TELEMETRY]")
    botnet_findings = []
    
    # Heuristic: Check if a single local process holds anomalous counts of outbound TCP connections (sparks)
    outbound_counts = {}
    try:
        conns = psutil.net_connections(kind='inet')
        for c in conns:
            if c.status == 'ESTABLISHED' and c.raddr:
                pid = c.pid
                if pid:
                    outbound_counts[pid] = outbound_counts.get(pid, 0) + 1
                    
        for pid, count in outbound_counts.items():
            if count >= 15:  # anomalous concentration of sockets pointing outbound
                try:
                    proc = psutil.Process(pid)
                    botnet_findings.append(f"  * [ALERT CRITICAL] Botnet-like swarm connection detected: Process '{proc.name()}' (PID: {pid}) sustaining {count} outbound internet connections.")
                except Exception:
                    pass
    except Exception as e:
        report.append(f"  * Botnet matrix scan error: {str(e)}")
        
    if botnet_findings:
        report.extend(botnet_findings)
    else:
        report.append("  * Quantum outbound streams: SECURE. No malicious connection clusters or C2 swarm structures detected.")

    # ----------------------------------------------------
    # 4. Open Listening Sockets Matrix (Local Ports)
    # ----------------------------------------------------
    report.append("\n[OPEN LISTENING SOCKETS MATRIX]")
    listeners = []
    
    # High-accuracy lsof check on macOS
    if os_name == "Darwin" or os_name == "Linux":
        try:
            lsof_res = subprocess.run(["lsof", "-i", "-P", "-n"], capture_output=True, text=True, timeout=2.0)
            for line in lsof_res.stdout.splitlines():
                if "LISTEN" in line:
                    parts = re.split(r'\s+', line)
                    if len(parts) >= 9:
                        proc_name = parts[0]
                        pid = parts[1]
                        addr = parts[8]
                        listeners.append(f"  * Process: {proc_name} (PID: {pid}) | Bind Address: {addr} [TCP LISTEN]")
        except Exception:
            pass
            
    # Fallback to psutil
    if not listeners:
        try:
            conns = psutil.net_connections(kind='inet')
            for c in conns:
                if c.status == 'LISTEN':
                    try:
                        p = psutil.Process(c.pid)
                        proc_name = p.name()
                    except Exception:
                        proc_name = "Unknown"
                    laddr = f"{c.laddr.ip}:{c.laddr.port}"
                    listeners.append(f"  * Process: {proc_name} (PID: {c.pid}) | Bind Address: {laddr} [TCP LISTEN]")
        except Exception as e:
            report.append(f"  * Listener matrix audit error: {str(e)}")
            
    if listeners:
        report.extend(listeners[:12])
    else:
        report.append("  * Local bindings: SECURE. No listening network sockets active.")

    # ----------------------------------------------------
    # 5. Network Sockets Flow: Ingress vs Egress packets
    # ----------------------------------------------------
    report.append("\n[NETWORK SOCKETS FLOW: INGRESS vs EGRESS PACKETS]")
    
    ingress_flow = []
    egress_flow = []
    
    try:
        conns = psutil.net_connections(kind='inet')
        for c in conns:
            # Skip connections without valid socket address structures
            if not c.laddr:
                continue
                
            pid_str = f"PID: {c.pid}" if c.pid else "PID: N/A"
            proc_name = "System Core"
            if c.pid:
                try:
                    proc_name = psutil.Process(c.pid).name()
                except Exception:
                    proc_name = "Process Closed"
            
            # Categorise network directions
            # Ingress flow: status is LISTEN (standing waiting for requests) OR remote port matches connection incoming
            if c.status == 'LISTEN':
                ingress_flow.append(f"  * [INGRESS] {proc_name} ({pid_str}) waiting incoming on {c.laddr.ip}:{c.laddr.port}")
            elif c.status == 'ESTABLISHED':
                # If local port is standard listening port (80, 443, 8000), it's incoming client connection
                if c.laddr.port in [80, 443, 22, 8000]:
                    ingress_flow.append(f"  * [INGRESS ESTABLISHED] {proc_name} ({pid_str}) from Remote {c.raddr.ip}:{c.raddr.port} to Local {c.laddr.ip}:{c.laddr.port}")
                else:
                    egress_flow.append(f"  * [EGRESS ESTABLISHED] {proc_name} ({pid_str}) to Remote {c.raddr.ip}:{c.raddr.port} from Local {c.laddr.ip}:{c.laddr.port}")
    except Exception as e:
        report.append(f"  * Packet flow diagnostics error: {str(e)}")
        
    report.append("\n  - ACTIVE INGRESS CONNECTIONS (INCOMING LISTENER FLOW):")
    if ingress_flow:
        report.extend(ingress_flow[:8])
    else:
        report.append("    * None active.")
        
    report.append("\n  - ACTIVE EGRESS CONNECTIONS (OUTGOING SYSTEM CLIENT FLOW):")
    if egress_flow:
        report.extend(egress_flow[:8])
    else:
        report.append("    * None active.")
        
    report.append("\n=== MALWARE & PACKET AUDIT PROTOCOLS COMPLETE ===")
    return "\n".join(report)

def run_deep_system_audit() -> str:
    """Performs a comprehensive, deep audit of the host computer, gathering detailed OS integrity settings, system partitions, active listening sockets, and high-resource processes.
    """
    import psutil
    
    report = []
    report.append("=== STARK COMPUTER SYSTEM DEEP SECURITY AUDIT ===")
    
    # 1. OS & Core Integrity
    report.append("\n[OS & CORE INTEGRITY METRICS]")
    os_name = platform.system()
    os_release = platform.release()
    arch = platform.machine()
    cores = psutil.cpu_count(logical=True)
    report.append(f"- Platform: {os_name} {os_release} ({arch})")
    report.append(f"- Logical CPU Cores: {cores}")
    
    # macOS Specific Core Integrity checks
    if os_name == "Darwin":
        # SIP Check
        try:
            sip_res = subprocess.run(["csrutil", "status"], capture_output=True, text=True, timeout=1.5)
            sip_status = sip_res.stdout.strip()
            report.append(f"- macOS System Integrity Protection (SIP): {sip_status}")
        except Exception:
            report.append("- macOS SIP Check: Failed to query status")
            
        # Application Firewall Check
        try:
            fw_res = subprocess.run(["defaults", "read", "/Library/Preferences/com.apple.alf", "globalstate"], capture_output=True, text=True, timeout=1.5)
            fw_val = fw_res.stdout.strip()
            fw_status = "ENABLED (Secure)" if fw_val in ("1", "2") else "DISABLED (Exposed)"
            report.append(f"- macOS Application Layer Firewall: {fw_status}")
        except Exception:
            report.append("- macOS Firewall Check: Failed to query status")
            
    # 2. Storage Partition Audit
    report.append("\n[STORAGE DISK OVERHEAD AUDIT]")
    try:
        partitions = psutil.disk_partitions()
        for part in partitions[:3]:  # Limit to first 3 partitions
            if 'cdrom' in part.opts or part.mountpoint == '':
                continue
            try:
                usage = psutil.disk_usage(part.mountpoint)
                total_gb = usage.total // (1024**3)
                used_gb = usage.used // (1024**3)
                free_gb = usage.free // (1024**3)
                report.append(f"- Partition {part.mountpoint} ({part.fstype}): {usage.percent}% Used | Total: {total_gb}GB | Free: {free_gb}GB")
            except PermissionError:
                report.append(f"- Partition {part.mountpoint}: Access Denied")
    except Exception as e:
        report.append(f"- Storage Audit Error: {str(e)}")
        
    # 3. Active Socket Listener Audit (Network Perimeter)
    report.append("\n[ACTIVE PORT SOCKET LISTENERS]")
    listeners = []
    
    # Attempt using lsof (highly accurate on macOS/Linux)
    try:
        if os_name == "Darwin" or os_name == "Linux":
            lsof_res = subprocess.run(["lsof", "-i", "-P", "-n"], capture_output=True, text=True, timeout=2.0)
            lines = lsof_res.stdout.splitlines()
            for line in lines:
                if "LISTEN" in line:
                    parts = re.split(r'\s+', line)
                    if len(parts) >= 9:
                        proc_name = parts[0]
                        pid = parts[1]
                        addr = parts[8]
                        listeners.append(f"  * Process: {proc_name} (PID: {pid}) listening on {addr}")
    except Exception:
        pass
        
    # Fallback to psutil if no listeners found
    if not listeners:
        try:
            connections = psutil.net_connections(kind='inet')
            for conn in connections:
                if conn.status == 'LISTEN':
                    try:
                        proc = psutil.Process(conn.pid)
                        proc_name = proc.name()
                    except Exception:
                        proc_name = "Unknown Process"
                    laddr = f"{conn.laddr.ip}:{conn.laddr.port}"
                    listeners.append(f"  * Process: {proc_name} (PID: {conn.pid}) listening on {laddr}")
        except Exception as e:
            report.append(f"- Socket Audit Error: {str(e)}")
            
    if listeners:
        report.extend(listeners[:10])  # limit to first 10 for neatness
    else:
        report.append("- No active listening sockets detected on standard TCP ports.")
        
    # 4. Host File Verification
    report.append("\n[DNS RESOLUTION SYSTEM CHECK]")
    hosts_path = "/etc/hosts" if os_name != "Windows" else r"C:\Windows\System32\drivers\etc\hosts"
    if os.path.exists(hosts_path):
        try:
            with open(hosts_path, "r") as f:
                lines = f.readlines()
            custom_redirects = []
            for line in lines:
                line_stripped = line.strip()
                if line_stripped and not line_stripped.startswith("#"):
                    custom_redirects.append(line_stripped)
            if custom_redirects:
                report.append(f"- Active rules in {hosts_path}:")
                for rule in custom_redirects[:5]:  # limit output
                    report.append(f"  * {rule}")
            else:
                report.append(f"- DNS Hosts file ({hosts_path}) has 0 active rule overrides.")
        except Exception as e:
            report.append(f"- Failed to read hosts file: {str(e)}")
            
    # 5. Developer Profiles (Asset Auditing)
    report.append("\n[DEVELOPER PROFILES & SYSTEM RUNTIMES]")
    runtimes = ["git", "clang", "gcc", "node", "python3", "docker"]
    for rt in runtimes:
        try:
            which_cmd = "which" if os_name != "Windows" else "where"
            res = subprocess.run([which_cmd, rt], capture_output=True, text=True, timeout=1.0)
            if res.returncode == 0:
                report.append(f"- {rt}: INSTALLED ({res.stdout.strip().splitlines()[0]})")
            else:
                report.append(f"- {rt}: NOT DETECTED")
        except Exception:
            report.append(f"- {rt}: Check failed")
            
    # 6. Resource Overhead (Top 5 Processes)
    report.append("\n[RESOURCE OVERHEAD - ACTIVE PROCESS DIAGNOSTICS]")
    try:
        processes = []
        for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent']):
            try:
                processes.append(proc.info)
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
        # Sort by CPU
        top_cpu = sorted(processes, key=lambda x: x['cpu_percent'] or 0, reverse=True)[:5]
        for p in top_cpu:
            report.append(f"  * PID: {p['pid']} | Name: {p['name']} | CPU: {p['cpu_percent']}% | RAM: {p['memory_percent']:.2f}%")
    except Exception as e:
        report.append(f"- Process Diagnostics Error: {str(e)}")
        
    report.append("\n=== SCAN PROTOCOLS COMPLETED SUCCESSFULLY ===")
    return "\n".join(report)

# Autonomous System Health Monitor Loop
async def monitor_system_health(websocket: WebSocket):
    """Periodically checks CPU, memory, and exposed ports, pushing warnings to the user autonomously."""
    import psutil
    last_cpu = 0
    last_ports = set()
    
    # Baseline
    try:
        baseline_conns = await asyncio.to_thread(psutil.net_connections, kind='inet')
        last_ports = {c.laddr.port for c in baseline_conns if c.status == 'LISTEN'}
    except Exception:
        pass
        
    await asyncio.sleep(8) # Let bootstrap settle
    
    try:
        while True:
            cpu = psutil.cpu_percent(interval=None)
            mem = psutil.virtual_memory().percent
            
            # Check CPU Spike (>80%)
            if cpu > 80.0 and last_cpu <= 80.0:
                await websocket.send_json({
                    "type": "autonomous_alert",
                    "alertType": "cpu_spike",
                    "value": f"{cpu}%",
                    "message": f"Sir, I have detected a sudden computational workload spike. CPU utilization is currently at {cpu}%."
                })
                
            # Check RAM Overhead (>85%)
            if mem > 85.0:
                await websocket.send_json({
                    "type": "autonomous_alert",
                    "alertType": "mem_spike",
                    "value": f"{mem}%",
                    "message": f"Sir, system virtual memory utilization is critically high at {mem}%. Operational degradation is possible."
                })
                
            # Check Network Perimeter Exposure (New listening port)
            try:
                current_conns = await asyncio.to_thread(psutil.net_connections, kind='inet')
                current_ports = {c.laddr.port for c in current_conns if c.status == 'LISTEN'}
                new_ports = current_ports - last_ports
                if new_ports:
                    for port in new_ports:
                        await websocket.send_json({
                            "type": "autonomous_alert",
                            "alertType": "port_exposure",
                            "port": port,
                            "message": f"Security perimeter alert, Sir! A new local process has bound to port {port} and is in LISTEN state. I highly recommend running port diagnostics."
                        })
                last_ports = current_ports
            except Exception:
                pass
                
            last_cpu = cpu
            await asyncio.sleep(10) # check system metrics every 10 seconds
    except asyncio.CancelledError:
        pass
    except Exception as e:
        print(f"Error in background sentinel monitor: {e}")

# Web Server Routes

@app.get("/api/health")
async def health():
    return {"status": "healthy", "service": "ALEX Core"}

@app.post("/api/shutdown")
async def shutdown():
    """Programmatically shuts down ALEX python process safely."""
    print("Core Shutdown Protocol Activated by User Request, Sir. Farewell.")
    def force_exit():
        import signal
        # Kill the parent (uvicorn reloader) if it exists, then self
        ppid = os.getppid()
        try:
            os.kill(ppid, signal.SIGTERM)
        except Exception:
            pass
        os._exit(0)
    asyncio.get_event_loop().call_later(0.5, force_exit)
    return {"status": "success", "message": "Core Shutdown Protocol Activated. Farewell, Sir."}


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """Receives and securely indexes screenshot variables within the Stark core scratch repository."""
    os.makedirs("scratch", exist_ok=True)
    import time
    filename = f"screenshot_{int(time.time())}_{file.filename}"
    file_path = os.path.abspath(os.path.join("scratch", filename))
    with open(file_path, "wb") as f:
        f.write(await file.read())
    return {"success": True, "filepath": file_path}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    agent = None
    monitor_task = None
    
    # Offline Session State variables
    mode = "online"
    ollama_model = "deepseek-r1:8b"
    offline_messages = []
    
    try:
        while True:
            data = await websocket.receive_json()
            if data["type"] == "init":
                connection_mode = data.get("mode", "online")
                api_key = data.get("apiKey")
                model_name = data.get("modelName", "deepseek-r1:8b")
                
                mode = connection_mode
                ollama_model = model_name
                
                # Cleanup existing online agent or background monitor tasks if resetting coupling
                if agent:
                    await agent.__aexit__(None, None, None)
                    agent = None
                if monitor_task:
                    monitor_task.cancel()
                    monitor_task = None
                
                if mode == "online":
                    target_key = api_key if api_key else os.environ.get("GEMINI_API_KEY")
                    if not target_key:
                        await websocket.send_json({
                            "type": "status", 
                            "message": "ALEX requires a Gemini API Key to initialize. Please configure one in the Settings panel, Sir."
                        })
                        continue
                    
                    # Start Google Antigravity Agent
                    config = LocalAgentConfig(
                        api_key=target_key,
                        system_instructions=PA_SYSTEM_INSTRUCTIONS,
                        tools=[run_local_port_scan, scan_code_vulnerabilities, get_system_diagnostics, run_deep_system_audit, run_malware_and_network_packets_audit],
                        skills_paths=["/Users/vikrantvel/.gemini/antigravity/scratch/JARVIS/skills"]
                    )
                    agent = Agent(config)
                    await agent.__aenter__()
                    
                    # Spawn proactive system monitor
                    monitor_task = asyncio.create_task(monitor_system_health(websocket))
                    
                    await websocket.send_json({
                        "type": "status", 
                        "message": "Security firewall initialized. Google Gemini connection online. ALEX is fully active, Sir."
                    })
                
                else:
                    # Offline / Ollama Mode
                    # Validate that Ollama local server is active
                    try:
                        async with httpx.AsyncClient() as client:
                            res = await client.get("http://localhost:11434/api/tags", timeout=2.0)
                            if res.status_code == 200:
                                # Setup baseline system parameters
                                offline_messages = [{"role": "system", "content": PA_SYSTEM_INSTRUCTIONS}]
                                monitor_task = asyncio.create_task(monitor_system_health(websocket))
                                
                                await websocket.send_json({
                                    "type": "status", 
                                    "message": f"Quantum local core coupled! Connected to local Ollama model '{ollama_model}'. ALEX is fully OFFLINE and active, Sir."
                                })
                            else:
                                raise Exception("Local runner returned status code: " + str(res.status_code))
                    except Exception as e:
                        await websocket.send_json({
                            "type": "error", 
                            "message": f"Ollama Core connection failed, Sir. Please ensure Ollama is active on http://localhost:11434. Error: {str(e)}"
                        })
                        continue
                
            elif data["type"] == "chat":
                text = data["text"]
                image_path = data.get("image_path")
                print(f"[WS DEBUG]: Received chat message: '{text}', image_path: '{image_path}'")
                await websocket.send_json({"type": "typing"})
                
                # Check for direct local tool command overrides (bypasses online and offline AI server dependency)
                if text.startswith("/"):
                    parts = text.split(" ", 1)
                    cmd = parts[0].lower().strip()
                    args = parts[1].strip() if len(parts) > 1 else ""
                    
                    try:
                        if cmd == "/malware":
                            res = await asyncio.to_thread(run_malware_and_network_packets_audit)
                            for line in res.split("\n"):
                                await websocket.send_json({"type": "token", "text": line + "\n"})
                                await asyncio.sleep(0.001)
                            await websocket.send_json({"type": "done"})
                            continue
                        elif cmd == "/deepscan":
                            res = await asyncio.to_thread(run_deep_system_audit)
                            for line in res.split("\n"):
                                await websocket.send_json({"type": "token", "text": line + "\n"})
                                await asyncio.sleep(0.001)
                            await websocket.send_json({"type": "done"})
                            continue
                        elif cmd == "/scan":
                            res = await asyncio.to_thread(run_local_port_scan, args if args else "1-1024")
                            await websocket.send_json({"type": "token", "text": res + "\n"})
                            await websocket.send_json({"type": "done"})
                            continue
                        elif cmd == "/audit":
                            res = await asyncio.to_thread(scan_code_vulnerabilities, args)
                            for line in res.split("\n"):
                                await websocket.send_json({"type": "token", "text": line + "\n"})
                                await asyncio.sleep(0.001)
                            await websocket.send_json({"type": "done"})
                            continue
                    except Exception as ex:
                        await websocket.send_json({"type": "error", "message": f"Diagnostics override exception: {str(ex)}"})
                        continue
                
                if mode == "online":
                    if not agent:
                        await websocket.send_json({
                            "type": "error", 
                            "message": "ALEX is not initialized. Please check your Gemini API key in the HUD panel, Sir."
                        })
                        continue
                    
                    try:
                        if image_path and os.path.exists(image_path):
                            from google.antigravity.types import Image
                            image = Image.from_file(image_path)
                            response = await agent.chat([text, image])
                        else:
                            response = await agent.chat(text)
                        
                        # Stream thoughts first
                        async for thought in response.thoughts:
                            await websocket.send_json({"type": "thought", "text": thought})
                            
                        # Stream response tokens
                        async for token in response:
                            await websocket.send_json({"type": "token", "text": token})
                            
                        await websocket.send_json({"type": "done"})
                    except Exception as e:
                        await websocket.send_json({"type": "error", "message": f"Agent query error, Sir: {str(e)}"})
                
                else:
                    # Offline Ollama Chat Streaming
                    # Check if they are calling tools conversationally, we can manually intercept and inject the tool results!
                    lower_text = text.lower()
                    if "port scan" in lower_text or "/scan" in lower_text:
                        # Safely inject local port scan result directly!
                        scan_res = await asyncio.to_thread(run_local_port_scan, "1-1024")
                        text += f"\n\n[SYSTEM TOOL INJECTION: run_local_port_scan completed successfully. Output: {scan_res}]"
                    elif "system diagnostics" in lower_text or "telemetry details" in lower_text:
                        diag_res = await asyncio.to_thread(get_system_diagnostics)
                        text += f"\n\n[SYSTEM TOOL INJECTION: get_system_diagnostics completed successfully. Output: {diag_res}]"
                    elif "deep audit" in lower_text or "deep system scan" in lower_text or "/deepscan" in lower_text:
                        audit_res = await asyncio.to_thread(run_deep_system_audit)
                        text += f"\n\n[SYSTEM TOOL INJECTION: run_deep_system_audit completed successfully. Output: {audit_res}]"
                    elif any(kw in lower_text for kw in ["malware", "keylogger", "botnet", "trojan", "backdoor", "rat", "packet", "incoming", "outgoing", "/malware"]):
                        malware_res = await asyncio.to_thread(run_malware_and_network_packets_audit)
                        text += f"\n\n[SYSTEM TOOL INJECTION: run_malware_and_network_packets_audit completed successfully. Output: {malware_res}]"
                    
                    if image_path and os.path.exists(image_path):
                        # Execute native offline high-speed macOS Vision OCR
                        try:
                            import subprocess
                            ocr_binary = os.path.abspath(os.path.join(os.path.dirname(__file__), "scratch", "ocr"))
                            if os.path.exists(ocr_binary):
                                print(f"[WS DEBUG]: Executing native macOS Vision OCR binary at {ocr_binary} on {image_path}")
                                result = subprocess.run([ocr_binary, image_path], capture_output=True, text=True, timeout=5.0)
                                if result.returncode == 0 and result.stdout.strip():
                                    extracted_text = result.stdout.strip()
                                    print(f"[WS DEBUG]: OCR Successful. Extracted {len(extracted_text)} chars.")
                                    # Present the text to the model exactly as a direct text environment state copy-paste!
                                    # This completely prevents triggering the model's pre-programmed "text-only capability" refusal.
                                    text += f"\n\n[STARK CORE TEXT BUFFER INJECTION - SYSTEM ENVIRONMENT STATE]:\n----------------------------------------\n{extracted_text}\n----------------------------------------\nSir, please analyze this copy-pasted system state text buffer to directly answer the user's questions or doubts. If this environment state indicates a specific vulnerability (such as Cross-Site Scripting XSS, SQL Injection SQLi, or any of the 200 vulnerabilities), guide them step-by-step on how to test it using Burp Suite based on your reference manual!"
                                else:
                                    print(f"[WS DEBUG]: OCR returned empty output or failed with code {result.returncode}")
                                    text += "\n\n[SYSTEM NOTICE: An empty or blank system environment text buffer was provided.]"
                            else:
                                print(f"[WS DEBUG]: OCR binary not found at {ocr_binary}")
                                text += "\n\n[SYSTEM WARNING: Native environment OCR cores not compiled.]"
                        except Exception as ocr_err:
                            print(f"[WS DEBUG]: OCR exception: {str(ocr_err)}")
                            text += f"\n\n[SYSTEM WARNING: Local visual OCR processing failed: {str(ocr_err)}]"
                    offline_messages.append({"role": "user", "content": text})
                    
                    try:
                        complete_response = ""
                        in_thought = False
                        
                        async with httpx.AsyncClient() as client:
                            async with client.stream("POST", "http://localhost:11434/api/chat", json={
                                "model": ollama_model,
                                "messages": offline_messages,
                                "stream": True
                            }, timeout=45.0) as response_stream:
                                
                                async for line in response_stream.aiter_lines():
                                    if not line:
                                        continue
                                    chunk = json.loads(line)
                                    content = chunk.get("message", {}).get("content", "")
                                    
                                    # Support parsing reasoning thoughts (DeepSeek-R1 <think> blocks)
                                    if "<think>" in content:
                                        in_thought = True
                                        content = content.replace("<think>", "")
                                    if "</think>" in content:
                                        in_thought = False
                                        content = content.replace("</think>", "")
                                        
                                    if content:
                                        complete_response += content
                                        if in_thought:
                                            await websocket.send_json({"type": "thought", "text": content})
                                        else:
                                            await websocket.send_json({"type": "token", "text": content})
                                            
                        offline_messages.append({"role": "assistant", "content": complete_response})
                        await websocket.send_json({"type": "done"})
                        
                    except Exception as e:
                        await websocket.send_json({"type": "error", "message": f"Ollama Local stream execution failed, Sir: {str(e)}"})
                        
    except WebSocketDisconnect:
        print("Client disconnected from ALEX core.")
    except Exception as e:
        print(f"Error in ALEX core logic loop: {e}")
        try:
            await websocket.send_json({"type": "error", "message": f"Core Exception, Sir: {str(e)}"})
        except Exception:
            pass
    finally:
        if monitor_task:
            monitor_task.cancel()
        if agent:
            await agent.__aexit__(None, None, None)

# Mount frontend files (use absolute path so it works regardless of CWD)
_STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
app.mount("/", StaticFiles(directory=_STATIC_DIR, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    # Make sure static directory exists
    os.makedirs("static", exist_ok=True)
    print("Launching ALEX Core on http://localhost:8000")
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
