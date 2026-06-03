"""FabLab Kanban persistence sidecar.

Pure Python standard library. Owns data.json + backups/ on disk and serves
GET/POST /api/state. Run standalone (`python3 server.py`) to also serve the
static app for local development. In production it runs behind nginx, which
reverse-proxies only /api/ to it.
"""
import json
import os
import shutil
import time


class StateStore:
    """Reads/writes the JSON state file with atomic writes and throttled backups."""

    def __init__(self, root, backup_interval=300, backup_keep=20, clock=time.time):
        self.root = root
        self.data_path = os.path.join(root, "data.json")
        self.tmp_path = os.path.join(root, "data.json.tmp")
        self.backups_dir = os.path.join(root, "backups")
        self.backup_interval = backup_interval
        self.backup_keep = backup_keep
        self.clock = clock

    def read(self):
        """Return (exists, text). Raises ValueError if an existing file is not valid JSON."""
        if not os.path.exists(self.data_path):
            return (False, None)
        with open(self.data_path, "r", encoding="utf-8") as f:
            text = f.read()
        json.loads(text)  # validate; json.JSONDecodeError is a subclass of ValueError
        return (True, text)

    def write(self, text):
        """Validate JSON, back up the previous file (throttled), then atomically replace.

        Raises ValueError on invalid JSON (caller maps to HTTP 400).
        """
        json.loads(text)  # validate before touching disk
        self._backup_if_due()
        with open(self.tmp_path, "w", encoding="utf-8") as f:
            f.write(text)
            f.flush()
            os.fsync(f.fileno())
        os.replace(self.tmp_path, self.data_path)  # atomic swap (safe on SD cards)

    def _backup_if_due(self):
        """No-op for now; throttled backups added in Task 3."""
        return
