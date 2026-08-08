import unittest

from core.chunker import SemanticChunker
from core.cleaner import StructureValidationError, verify_and_repair_html


class CleanerTests(unittest.TestCase):
    def test_valid_structure_is_preserved(self):
        source = "<p>Hello <em>world</em>.</p><h2>Next</h2>"
        translated = "<p>Bonjour <em>le monde</em>.</p><h2>Suite</h2>"
        self.assertEqual(verify_and_repair_html(source, translated), "<p>Bonjour <em>le monde</em>.</p>\n<h2>Suite</h2>")

    def test_missing_block_is_rejected(self):
        with self.assertRaises(StructureValidationError):
            verify_and_repair_html("<p>One</p><p>Two</p>", "<p>Un et deux</p>")

    def test_missing_inline_markup_is_rejected(self):
        with self.assertRaises(StructureValidationError):
            verify_and_repair_html("<p>Hello <em>world</em></p>", "<p>Bonjour le monde</p>")

    def test_literary_repetition_is_not_deleted(self):
        translated = "<p>Jamais. Jamais. Jamais.</p>"
        self.assertIn("Jamais. Jamais. Jamais.", verify_and_repair_html("<p>Never. Never. Never.</p>", translated))

class ChunkerTests(unittest.TestCase):
    def test_oversized_single_node_is_split(self):
        node = f"<p>{'A long sentence with enough words. ' * 500}</p>"
        chunker = SemanticChunker(target_chunk_tokens=200, max_chunk_tokens=230)
        chunks = chunker.create_chunks([node])
        self.assertGreater(len(chunks), 1)
        self.assertTrue(all(chunk.token_estimate <= 240 for chunk in chunks))
        self.assertTrue(all(chunk.node_indices == [0] for chunk in chunks))


if __name__ == "__main__":
    unittest.main()
