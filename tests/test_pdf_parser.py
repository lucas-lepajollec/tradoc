import tempfile
import unittest
from pathlib import Path

import fitz

from core.parser_pdf import PdfParser


class PdfParserTests(unittest.TestCase):
    def _make_source(self, path: Path) -> None:
        doc = fitz.open()
        page = doc.new_page(width=432, height=648)
        page.insert_textbox(
            fitz.Rect(48, 55, 384, 125),
            "CHAPTER 1",
            fontsize=22,
            fontname="hebo",
            align=fitz.TEXT_ALIGN_CENTER,
        )
        page.insert_textbox(
            fitz.Rect(48, 145, 384, 570),
            "This is the first paragraph of the book. It has enough text to be detected as body copy.",
            fontsize=11,
            fontname="tiro",
            align=fitz.TEXT_ALIGN_LEFT,
        )
        doc.save(path)
        doc.close()

    def test_extracts_heading_and_body_without_centering_body(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "source.pdf"
            self._make_source(source)
            parser = PdfParser(source)
            try:
                meta, nodes = parser.extract_nodes()
            finally:
                parser.close()

            self.assertEqual([item["role"] for item in meta], ["chapter", "body"])
            self.assertTrue(nodes[0].startswith("<h1>"))
            self.assertTrue(nodes[1].startswith("<p>"))

    def test_reflows_unicode_text_across_pages(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "source.pdf"
            output = Path(directory) / "translated.pdf"
            self._make_source(source)
            parser = PdfParser(source)
            try:
                meta, _ = parser.extract_nodes()
                long_paragraph = (
                    "« Le cœur de l’œuvre était déjà prêt. » — L’apostrophe et les accents "
                    "doivent rester parfaitement lisibles dans le document reconstruit. "
                ) * 180
                parser.reconstruct_pdf(
                    meta,
                    ["<h1>CHAPITRE 1 : UN NOUVEAU DÉPART</h1>", f"<p>{long_paragraph}</p>"],
                    output,
                )
            finally:
                parser.close()

            rendered = fitz.open(output)
            try:
                text = "\n".join(page.get_text() for page in rendered)
                self.assertGreater(rendered.page_count, 1)
                self.assertIn("cœur", text)
                self.assertIn("œuvre", text)
                self.assertIn("L’apostrophe", text)
                self.assertNotIn("\ufffd", text)
            finally:
                rendered.close()

    def test_preserves_image_only_pages_in_the_book_template(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "illustrated.pdf"
            output = Path(directory) / "translated.pdf"
            doc = fitz.open()
            cover = doc.new_page(width=612, height=792)
            pixmap = fitz.Pixmap(fitz.csRGB, fitz.IRect(0, 0, 40, 60), False)
            pixmap.clear_with(0x315A7D)
            cover.insert_image(cover.rect, stream=pixmap.tobytes("png"))
            page = doc.new_page(width=612, height=792)
            page.insert_textbox(
                fitz.Rect(70, 80, 542, 150),
                "CHAPTER 1",
                fontsize=24,
                fontname="hebo",
                align=fitz.TEXT_ALIGN_CENTER,
            )
            page.insert_textbox(
                fitz.Rect(70, 180, 542, 500),
                "A short paragraph follows the illustrated cover.",
                fontsize=12,
                fontname="tiro",
            )
            doc.save(source)
            doc.close()

            parser = PdfParser(source)
            try:
                meta, nodes = parser.extract_nodes()
                parser.reconstruct_pdf(meta, nodes, output)
            finally:
                parser.close()

            rendered = fitz.open(output)
            try:
                self.assertGreaterEqual(rendered.page_count, 2)
                self.assertTrue(rendered[0].get_images(full=True))
                self.assertEqual(tuple(rendered[0].rect), (0.0, 0.0, 432.0, 648.0))
                self.assertIn("CHAPTER 1", rendered[1].get_text().replace("\u00a0", " "))
            finally:
                rendered.close()

    def test_partial_preview_uses_consistent_sizes_for_toc_entries(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "toc.pdf"
            output = Path(directory) / "preview.pdf"
            doc = fitz.open()
            page = doc.new_page(width=612, height=792)
            page.insert_textbox(
                fitz.Rect(120, 100, 492, 145),
                "CHAPTER 1: SHORT",
                fontsize=17,
                fontname="hebo",
                align=fitz.TEXT_ALIGN_CENTER,
            )
            page.insert_textbox(
                fitz.Rect(90, 165, 522, 210),
                "CHAPTER 2: A LONGER ENGLISH TITLE",
                fontsize=17,
                fontname="hebo",
                align=fitz.TEXT_ALIGN_CENTER,
            )
            doc.save(source)
            doc.close()

            parser = PdfParser(source)
            try:
                meta, _ = parser.extract_nodes()
                self.assertEqual([item["role"] for item in meta], ["toc", "toc"])
                parser.reconstruct_partial_pdf(
                    meta,
                    [
                        "<h2>CHAPITRE 1 : COURT</h2>",
                        "<h2>CHAPITRE 2 : UN TITRE FRANÇAIS NETTEMENT PLUS LONG</h2>",
                    ],
                    output,
                    changed_node_indices={0, 1},
                )
            finally:
                parser.close()

            rendered = fitz.open(output)
            try:
                translated_spans = [
                    span
                    for block in rendered[0].get_text("dict").get("blocks", [])
                    if block.get("type") == 0
                    for line in block.get("lines", [])
                    for span in line.get("spans", [])
                    if "Fira" in span.get("font", "")
                ]
                self.assertEqual({round(float(span["size"]), 2) for span in translated_spans}, {10.25})
                text = " ".join(span["text"] for span in translated_spans)
                self.assertIn("CHAPITRE 1", text)
                self.assertIn("NETTEMENT PLUS LONG", text)
            finally:
                rendered.close()


if __name__ == "__main__":
    unittest.main()
