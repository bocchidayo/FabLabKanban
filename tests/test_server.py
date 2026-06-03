import json
import os
import tempfile
import threading
import unittest
import urllib.error
import urllib.request

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


from http.server import ThreadingHTTPServer
from server import make_handler


class ApiIntegrationTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = StateStore(self.tmp.name)
        handler = make_handler(self.store, serve_static=False)
        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        self.port = self.httpd.server_address[1]
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.httpd.shutdown()
        self.httpd.server_close()
        self.tmp.cleanup()

    def _url(self):
        return "http://127.0.0.1:%d/api/state" % self.port

    def _get(self):
        try:
            with urllib.request.urlopen(self._url()) as r:
                return r.status, r.read().decode("utf-8")
        except urllib.error.HTTPError as e:
            return e.code, e.read().decode("utf-8")

    def _post(self, body):
        req = urllib.request.Request(
            self._url(), data=body.encode("utf-8"), method="POST",
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req) as r:
                return r.status, r.read().decode("utf-8")
        except urllib.error.HTTPError as e:
            return e.code, e.read().decode("utf-8")

    def test_get_missing_returns_204(self):
        status, _ = self._get()
        self.assertEqual(status, 204)

    def test_post_then_get_roundtrip(self):
        status, _ = self._post('{"lab": "FabLab"}')
        self.assertEqual(status, 200)
        status, body = self._get()
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)["lab"], "FabLab")

    def test_post_invalid_json_returns_400(self):
        status, _ = self._post("{bad")
        self.assertEqual(status, 400)


if __name__ == "__main__":
    unittest.main()
