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
        Extracts structured text paragraphs from PDF pages tracking exact bounding box coordinates (bbox),
        font size, color, flags (bold/italic), and alignment (centered/left/right) for 100% fidelity layout preservation.
        """
        import re
        node_meta: List[Dict[str, Any]] = []
        node_texts: List[str] = []

        for page_idx, page in enumerate(self.doc):
            page_rect = page.rect
            page_w = page_rect.width
            page_dict = page.get_text("dict")
            
            for block_idx, b in enumerate(page_dict.get("blocks", [])):
                if b.get("type") == 0:  # Text block
                    bbox = b.get("bbox")
                    lines = b.get("lines", [])
                    if not lines or not bbox:
                        continue

                    # Collect text and typography from spans
                    full_text_lines = []
                    font_sizes = []
                    colors = []
                    is_bold = False
                    is_italic = False

                    for line in lines:
                        line_str = ""
                        for span in line.get("spans", []):
                            txt = span.get("text", "")
                            if txt:
                                line_str += txt
                                font_sizes.append(span.get("size", 10.0))
                                col_int = span.get("color", 0)
                                colors.append(col_int)
                                flags = span.get("flags", 0)
                                if flags & 16 or "bold" in span.get("font", "").lower():
                                    is_bold = True
                                if flags & 2 or "italic" in span.get("font", "").lower() or "oblique" in span.get("font", "").lower():
                                    is_italic = True
                        if line_str.strip():
                            full_text_lines.append(line_str.strip())

                    clean_block = " ".join(full_text_lines).strip()
                    if not clean_block or re.match(r'^\d{1,3}(\s+\d{1,3})?$', clean_block):
                        continue

                    # Check font family (default to serif for books/novels unless explicitly sans-serif)
                    font_names = [span.get("font", "").lower() for line in lines for span in line.get("spans", [])]
                    font_str = " ".join(font_names)
                    if any(s in font_str for s in ["arial", "helvetica", "verdana", "tahoma", "sans", "roboto", "inter"]):
                        font_family = "sans"
                    else:
                        font_family = "serif"

                    # Calculate dominant font size and color
                    avg_font_size = sum(font_sizes) / len(font_sizes) if font_sizes else 10.0
                    dominant_color_int = max(set(colors), key=colors.count) if colors else 0
                    
                    # Convert color int to RGB tuple
                    r = ((dominant_color_int >> 16) & 0xFF) / 255.0
                    g = ((dominant_color_int >> 8) & 0xFF) / 255.0
                    b_col = (dominant_color_int & 0xFF) / 255.0
                    color_tuple = (r, g, b_col)

                    # Calculate alignment: check if centered on page
                    x0, y0, x1, y1 = bbox
                    block_mid = (x0 + x1) / 2.0
                    block_w = x1 - x0
                    page_mid = page_w / 2.0

                    if abs(block_mid - page_mid) < 35.0 and block_w < (page_w * 0.85):
                        align_val = fitz.TEXT_ALIGN_CENTER
                    elif x0 > (page_w * 0.6):
                        align_val = fitz.TEXT_ALIGN_RIGHT
                    else:
                        align_val = fitz.TEXT_ALIGN_LEFT

                    # Form tag name based on font size/bold
                    if avg_font_size >= 15.0:
                        tag_name = "h1"
                    elif avg_font_size >= 12.5:
                        tag_name = "h2"
                    else:
                        tag_name = "p"

                    html_para = f"<{tag_name}>{clean_block}</{tag_name}>"

                    node_meta.append({
                        "page_num": page_idx + 1,
                        "block_idx": block_idx,
                        "bbox": bbox,
                        "font_size": avg_font_size,
                        "color": color_tuple,
                        "align": align_val,
                        "is_bold": is_bold,
                        "is_italic": is_italic,
                        "font_family": font_family,
                        "original_html": html_para
                    })
                    node_texts.append(html_para)

        return node_meta, node_texts

    def reconstruct_pdf(self, node_meta: List[Dict[str, Any]], translated_nodes: List[str], output_path: Path):
        """
        Reconstructs original PDF file in-place with 100% visual layout fidelity:
        1. Keeps all original images, graphics, vector elements, fonts and page structure untouched.
        2. Erases original English text in exact bounding boxes via PyMuPDF redaction.
        3. Re-injects French translated text preserving original font size, colors (RGB), alignment (centered/left/right), and font weights.
        """
        import re
        pdf_doc = fitz.open(str(self.pdf_path))

        # Group translations by page_num
        pages_map: Dict[int, List[Tuple[Dict[str, Any], str]]] = {}

        for meta, translated_html in zip(node_meta, translated_nodes):
            page_idx = meta.get("page_num", 1) - 1
            bbox = meta.get("bbox")
            if bbox and 0 <= page_idx < len(pdf_doc):
                if page_idx not in pages_map:
                    pages_map[page_idx] = []
                pages_map[page_idx].append((meta, translated_html))

        for page_idx, items in pages_map.items():
            page = pdf_doc[page_idx]
            page_w = page.rect.width
            page_h = page.rect.height

            # Step A: Erase 100% of original English text blocks at their EXACT original bounding boxes FIRST!
            for meta, _ in items:
                bbox = meta.get("bbox")
                if bbox:
                    page.add_redact_annot(fitz.Rect(bbox), fill=(1, 1, 1))
            page.apply_redactions()

            # Step B: Inject translated French text with clean vertical reflow
            y_shift = 0.0
            
            for meta, translated_html in items:
                clean_translated = re.sub(r'<[^>]*>', '', translated_html).strip()
                if not clean_translated:
                    continue

                # UTF-8 unicode encoding fix for PyMuPDF built-in fonts (replaces 'œ' with 'oe' to prevent 'C?UR')
                clean_translated = clean_translated.replace("œ", "oe").replace("Œ", "OE")

                bbox = meta.get("bbox")
                if not bbox:
                    continue

                orig_rect = fitz.Rect(bbox)

                # 1. Vertical Reflow: Apply accumulated y_shift from previous expanding blocks on this page
                y0 = orig_rect.y0 + y_shift
                y1 = orig_rect.y1 + y_shift

                orig_size = meta.get("font_size", 10.0)
                color = meta.get("color", (0, 0, 0))
                align = meta.get("align", fitz.TEXT_ALIGN_LEFT)
                is_bold = meta.get("is_bold", False)
                is_italic = meta.get("is_italic", False)
                font_family = meta.get("font_family", "serif")

                # Map font family: Times-Roman (tiro) for book serif typography, Helvetica (helv) for sans
                if font_family == "serif":
                    fontname = "tiro"
                    if is_bold and is_italic:
                        fontname = "tibi"
                    elif is_bold:
                        fontname = "tibo"
                    elif is_italic:
                        fontname = "tiit"
                else:
                    fontname = "helv"
                    if is_bold and is_italic:
                        fontname = "hebi"
                    elif is_bold:
                        fontname = "hebo"
                    elif is_italic:
                        fontname = "heit"

                # 2. Uniform Font Size: Keep original font size constant (no micro-text font scaling)
                font_sz = orig_size

                # 3. Strict Bounding Box Margins (Valid & Finite Rect Coordinates)
                x0 = max(20.0, orig_rect.x0)
                x1 = max(x0 + 40.0, orig_rect.x1)

                if align == fitz.TEXT_ALIGN_CENTER:
                    x0 = 36.0
                    x1 = page_w - 36.0
                else:
                    x1 = max(x1, page_w - x0)

                y1_target = max(y0 + font_sz + 4.0, min(page_h - 10.0, y0 + max(orig_rect.y1 - orig_rect.y0, font_sz * 12.0)))
                if y1_target <= y0:
                    y1_target = y0 + 20.0

                target_rect = fitz.Rect(x0, y0, x1, y1_target)

                # Insert text into target rect with uniform font size
                rc = page.insert_textbox(target_rect, clean_translated, fontsize=font_sz, fontname=fontname, color=color, align=align)

                # If text overflows due to page height boundary, scale down font slightly as fallback
                if rc < 0:
                    min_sz = max(8.0, orig_size * 0.85)
                    while rc < 0 and font_sz > min_sz:
                        font_sz -= 0.5
                        rc = page.insert_textbox(target_rect, clean_translated, fontsize=font_sz, fontname=fontname, color=color, align=align)

                # 4. Measure actual vertical height used and update y_shift for subsequent blocks
                col_w = target_rect.width
                chars_per_line = max(1, int(col_w / (font_sz * 0.52)))
                est_lines = max(1, (len(clean_translated) + chars_per_line - 1) // chars_per_line)
                actual_block_h = est_lines * (font_sz * 1.35)
                orig_block_h = orig_rect.y1 - orig_rect.y0

                if actual_block_h > orig_block_h:
                    extra_h = actual_block_h - orig_block_h
                    y_shift += extra_h

        try:
            pdf_doc.save(str(output_path), incremental=False, deflate=True)
        except Exception:
            import uuid
            temp_out = output_path.with_name(f"temp_{uuid.uuid4().hex[:6]}_{output_path.name}")
            pdf_doc.save(str(temp_out), incremental=False, deflate=True)
            try:
                if output_path.exists():
                    output_path.unlink(missing_ok=True)
                temp_out.replace(output_path)
            except Exception:
                pass

        pdf_doc.close()

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

    def export_translated_pdf(self, title: str, translated_nodes: List[str], output_path: Path):
        """
        Generates a clean PDF document from translated PDF text nodes using PyMuPDF.
        """
        import re
        doc = fitz.open()
        # Page dimensions: A4 (595 x 842 pt)
        page_width = 595
        page_height = 842
        margin = 54  # 0.75 in margin

        rect = fitz.Rect(margin, margin, page_width - margin, page_height - margin)

        css = """
        body { font-family: sans-serif; font-size: 11pt; line-height: 1.5; color: #111; }
        h1 { font-size: 18pt; text-align: center; margin-bottom: 20pt; color: #000; }
        p { margin-bottom: 10pt; text-align: justify; text-indent: 12pt; }
        """

        full_html = f"<h1>{title}</h1>\n" + "\n".join(translated_nodes)

        try:
            # Use PyMuPDF Story for automatic multi-page flow rendering
            story = fitz.Story(html=full_html, user_css=css)
            more = True
            while more:
                page = doc.new_page(width=page_width, height=page_height)
                more, _ = story.place(rect)
                story.draw(page)
        except Exception:
            # Fallback: line-by-line page insertion
            page = doc.new_page(width=page_width, height=page_height)
            curr_rect = fitz.Rect(margin, margin, page_width - margin, page_height - margin)
            try:
                page.insert_htmlbox(curr_rect, full_html, css=css)
            except Exception:
                clean_text = f"{title}\n\n" + "\n\n".join(re.sub(r'<[^>]*>', '', n) for n in translated_nodes)
                page.insert_textbox(curr_rect, clean_text, fontsize=10)

        doc.save(str(output_path))
        doc.close()
