import json
import os
import tempfile
import unittest

from server import StateStore


class StateStoreReadTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = self.tmp.name
        self.store = StateStore(self.root)

    def tearDown(self):
        self.tmp.cleanup()

    def test_read_missing_file_signals_new_install(self):
        exists, text = self.store.read()
        self.assertFalse(exists)
        self.assertIsNone(text)

    def test_read_returns_existing_file_text(self):
        path = os.path.join(self.root, "data.json")
        with open(path, "w", encoding="utf-8") as f:
            f.write('{"lab": "X"}')
        exists, text = self.store.read()
        self.assertTrue(exists)
        self.assertEqual(json.loads(text)["lab"], "X")

    def test_read_corrupt_file_raises_valueerror(self):
        path = os.path.join(self.root, "data.json")
        with open(path, "w", encoding="utf-8") as f:
            f.write("{not json")
        with self.assertRaises(ValueError):
            self.store.read()


class StateStoreWriteTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = self.tmp.name
        self.store = StateStore(self.root)

    def tearDown(self):
        self.tmp.cleanup()

    def test_write_persists_text_and_removes_tmp(self):
        self.store.write('{"a": 1}')
        with open(os.path.join(self.root, "data.json"), encoding="utf-8") as f:
            self.assertEqual(json.load(f), {"a": 1})
        self.assertFalse(os.path.exists(os.path.join(self.root, "data.json.tmp")))

    def test_write_rejects_invalid_json(self):
        with self.assertRaises(ValueError):
            self.store.write("{nope")
        self.assertFalse(os.path.exists(os.path.join(self.root, "data.json")))

    def test_write_then_read_roundtrip(self):
        self.store.write('{"members": []}')
        exists, text = self.store.read()
        self.assertTrue(exists)
        self.assertEqual(json.loads(text), {"members": []})


class FakeClock:
    def __init__(self, t=1000.0):
        self.t = t

    def __call__(self):
        return self.t


class StateStoreBackupTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = self.tmp.name
        self.clock = FakeClock()
        self.store = StateStore(self.root, backup_interval=300, backup_keep=3, clock=self.clock)

    def tearDown(self):
        self.tmp.cleanup()

    def _backup_files(self):
        d = os.path.join(self.root, "backups")
        return sorted(os.listdir(d)) if os.path.isdir(d) else []

    def test_first_write_makes_no_backup(self):
        self.store.write('{"v": 1}')  # nothing existed to back up
        self.assertEqual(self._backup_files(), [])

    def test_second_write_backs_up_previous(self):
        self.store.write('{"v": 1}')
        self.store.write('{"v": 2}')  # backs up the v:1 file
        self.assertEqual(len(self._backup_files()), 1)

    def test_backup_is_throttled_within_interval(self):
        self.store.write('{"v": 1}')
        self.store.write('{"v": 2}')          # backup #1 at t=1000
        self.clock.t = 1100.0                 # +100s (< 300s)
        self.store.write('{"v": 3}')          # throttled: no new backup
        self.assertEqual(len(self._backup_files()), 1)

    def test_backup_after_interval(self):
        self.store.write('{"v": 1}')
        self.store.write('{"v": 2}')          # backup #1 at t=1000
        self.clock.t = 1400.0                 # +400s (>= 300s)
        self.store.write('{"v": 3}')          # new backup
        self.assertEqual(len(self._backup_files()), 2)

    def test_backups_pruned_to_keep_limit(self):
        self.store.write('{"v": 0}')
        for i in range(1, 6):                 # 5 more writes, each >interval apart
            self.clock.t += 400.0
            self.store.write('{"v": %d}' % i)
        self.assertEqual(len(self._backup_files()), 3)  # backup_keep=3


if __name__ == "__main__":
    unittest.main()
