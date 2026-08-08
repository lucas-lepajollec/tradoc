import tempfile
import unittest
from pathlib import Path

from core.parser_text import TextParser


class TextParserTests(unittest.TestCase):
    def test_fenced_markdown_is_translated_without_exposing_fence_markers(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "book.md"
            output = Path(directory) / "translated.md"
            source.write_text("```\nHello World.\n```\n", encoding="utf-8")

            parser = TextParser(source)
            metadata, nodes = parser.extract_nodes()

            self.assertEqual(nodes, ["<p>Hello World.</p>"])
            parser.reconstruct_text(metadata, ["<p>Bonjour Monde.</p>"], output)
            self.assertEqual(output.read_text(encoding="utf-8"), "```\nBonjour Monde.\n```\n")

    def test_markdown_list_and_inline_code_are_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "book.md"
            output = Path(directory) / "translated.md"
            source.write_text("- `CHAPTER 1: HELLO`\n", encoding="utf-8")

            parser = TextParser(source)
            metadata, nodes = parser.extract_nodes()

            self.assertEqual(nodes, ["<li>CHAPTER 1: HELLO</li>"])
            parser.reconstruct_text(metadata, ["<li>CHAPITRE 1 : BONJOUR</li>"], output)
            self.assertEqual(output.read_text(encoding="utf-8"), "- `CHAPITRE 1 : BONJOUR`\n")

    def test_unlabelled_fence_line_wrapping_is_not_structural(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "book.md"
            source.write_text("```\nA long sentence wrapped by a converter\nonto another physical line.\n```\n", encoding="utf-8")

            _, nodes = TextParser(source).extract_nodes()

            self.assertEqual(nodes, ["<p>A long sentence wrapped by a converter onto another physical line.</p>"])

    def test_converter_fence_with_multiple_chapter_titles_is_normalized_and_rebuilt(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "book.md"
            output = Path(directory) / "translated.md"
            source.write_text(
                "```\nCHAPTER 89: A SIMPLE MISSION\nCHAPTER 90: FINDINGS BY SIGHT\n```\n",
                encoding="utf-8",
            )

            parser = TextParser(source)
            metadata, nodes = parser.extract_nodes()

            self.assertEqual(
                nodes,
                ["<p>CHAPTER 89: A SIMPLE MISSION</p>", "<p>CHAPTER 90: FINDINGS BY SIGHT</p>"],
            )
            parser.reconstruct_text(
                metadata,
                ["<p>CHAPITRE 89 : UNE MISSION SIMPLE</p>", "<p>CHAPITRE 90 : RÉSULTATS VISUELS</p>"],
                output,
            )
            self.assertEqual(
                output.read_text(encoding="utf-8"),
                "```\nCHAPITRE 89 : UNE MISSION SIMPLE\nCHAPITRE 90 : RÉSULTATS VISUELS\n```\n",
            )

    def test_parser_version_three_keeps_existing_fence_mapping(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "book.md"
            source.write_text("```\nCHAPTER 1: ONE\nCHAPTER 2: TWO\n```\n", encoding="utf-8")

            _, nodes = TextParser(source, normalize_fenced_headings=False).extract_nodes()

            self.assertEqual(nodes, ["<p>CHAPTER 1: ONE CHAPTER 2: TWO</p>"])

    def test_heading_code_wrapper_is_kept_outside_translation(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "book.md"
            output = Path(directory) / "translated.md"
            source.write_text("# `Chapter 3: Melissa`\n", encoding="utf-8")

            parser = TextParser(source)
            metadata, nodes = parser.extract_nodes()

            self.assertEqual(nodes, ["<h1>Chapter 3: Melissa</h1>"])
            parser.reconstruct_text(metadata, ["<h1>Chapitre 3 : Melissa</h1>"], output)
            self.assertEqual(output.read_text(encoding="utf-8"), "# `Chapitre 3 : Melissa`\n")

    def test_legacy_parser_keeps_existing_project_mapping(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "book.md"
            source.write_text("```\nHello\n```\n", encoding="utf-8")

            _, nodes = TextParser(source, legacy=True).extract_nodes()

            self.assertEqual(nodes, ["<p>```<br/>Hello<br/>```</p>"])


if __name__ == "__main__":
    unittest.main()
