import os
import re
import logging
from typing import List, Dict, Optional
from app.config import settings

logger = logging.getLogger(__name__)


def list_log_files() -> List[str]:
    """List available samba log files."""
    log_path = settings.samba_log_path
    
    if not os.path.exists(log_path):
        return []
    
    files = []
    for f in sorted(os.listdir(log_path)):
        full_path = os.path.join(log_path, f)
        if os.path.isfile(full_path) and not f.startswith("."):
            files.append(f)
    
    return files


def read_log(
    filename: str,
    lines: int = 200,
    level_filter: Optional[str] = None,
    search: Optional[str] = None,
) -> Dict:
    """Read a samba log file (tail)."""
    log_path = os.path.join(settings.samba_log_path, filename)
    
    if not os.path.exists(log_path):
        return {"entries": [], "total": 0, "file": filename}
    
    # Security check: prevent path traversal
    real_path = os.path.realpath(log_path)
    real_log_dir = os.path.realpath(settings.samba_log_path)
    if not real_path.startswith(real_log_dir):
        raise ValueError("Invalid log file path")
    
    entries = []
    
    with open(log_path, "r", errors="replace") as f:
        all_lines = f.readlines()
    
    # Take last N lines
    tail_lines = all_lines[-lines:] if len(all_lines) > lines else all_lines
    
    for line in tail_lines:
        line = line.strip()
        if not line:
            continue
        
        entry = _parse_log_line(line)
        
        # Apply filters
        if level_filter and entry.get("level") and entry["level"] != level_filter:
            continue
        if search and search.lower() not in line.lower():
            continue
        
        entries.append(entry)
    
    return {
        "entries": entries,
        "total": len(entries),
        "file": filename,
    }


def _parse_log_line(line: str) -> Dict:
    """Parse a single samba log line."""
    # Samba log format: [YYYY/MM/DD HH:MM:SS.uuuuuu, N] source
    match = re.match(
        r"\[(\d{4}/\d{2}/\d{2}\s+\d{2}:\d{2}:\d{2}\.\d+),\s*(\d+)\]\s*(.*)",
        line
    )
    
    if match:
        return {
            "timestamp": match.group(1),
            "level": match.group(2),
            "source": match.group(3),
            "message": line,
        }
    
    return {
        "timestamp": None,
        "level": None,
        "source": None,
        "message": line,
    }
