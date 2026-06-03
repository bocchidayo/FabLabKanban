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


if __name__ == "__main__":
    unittest.main()
