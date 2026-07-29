import fitz  # PyMuPDF
from pathlib import Path
from typing import List, Tuple, Dict, Any
from ebooklib import epub
from bs4 import BeautifulSoup

class PdfParser:
    def __init__(self, pdf_path: Path):
        self.pdf_path = pdf_path
        self.doc = fitz.open(str(pdf_path))

    def extract_nodes(self) -> Tuple[List[Dict[str, Any]], List[str]]:
        """
        Extracts structured text paragraphs from PDF pages.
        Returns:
        - node_meta: metadata list tracking page number and block index
        - node_texts: list of paragraph HTML strings (<p>...</p>)
        """
        node_meta: List[Dict[str, Any]] = []
        node_texts: List[str] = []

        for page_idx, page in enumerate(self.doc):
            # Extract text blocks: (x0, y0, x1, y1, "text", block_no, block_type)
            blocks = page.get_text("blocks")
            for block_idx, b in enumerate(blocks):
                # block_type 0 is text
                if len(b) >= 7 and b[6] == 0:
                    raw_text = b[4].strip()
                    if not raw_text:
                        continue

                    # Clean line breaks within paragraph
                    paragraph_text = " ".join(line.strip() for line in raw_text.splitlines() if line.strip())
                    if not paragraph_text:
                        continue

                    html_para = f"<p>{paragraph_text}</p>"
                    node_meta.append({
                        "page_num": page_idx + 1,
                        "block_idx": block_idx,
                        "original_html": html_para
                    })
                    node_texts.append(html_para)

        return node_meta, node_texts

    def export_translated_epub(self, title: str, translated_nodes: List[str], output_path: Path):
        """
        Generates a clean EPUB ebook from translated PDF text nodes.
        """
        book = epub.EpubBook()
        book.set_identifier(f"tradoc-pdf-{self.pdf_path.stem}")
        book.set_title(title)
        book.set_language("fr")

        # Create CSS
        style = """
        @namespace url('http://www.w3.org/1999/xhtml');
        body { font-family: Georgia, serif; line-height: 1.6; padding: 5%; }
        p { margin-bottom: 1em; text-indent: 1.5em; text-align: justify; }
        h1, h2 { text-align: center; margin-top: 2em; }
        """
        nav_css = epub.EpubItem(uid="style_nav", file_name="style/nav.css", media_type="text/css", content=style)
        book.add_item(nav_css)

        # Create main chapter containing translated HTML
        html_content = f"<html><head><link rel='stylesheet' href='style/nav.css'/></head><body><h1>{title}</h1>"
        html_content += "\n".join(translated_nodes)
        html_content += "</body></html>"

        chapter = epub.EpubHtml(title="Traduction", file_name="chapter_1.xhtml", lang="fr")
        chapter.content = html_content
        chapter.add_item(nav_css)
        book.add_item(chapter)

        book.toc = (epub.Link("chapter_1.xhtml", "Traduction", "chap1"),)
        book.add_item(epub.EpubNcx())
        book.add_item(epub.EpubNav())
        book.spine = ["nav", chapter]

        epub.write_epub(str(output_path), book, {})
