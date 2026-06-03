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


if __name__ == "__main__":
    unittest.main()
