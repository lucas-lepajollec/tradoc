import io
import re
from collections import Counter, defaultdict
from html import escape
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple

import fitz
from bs4 import BeautifulSoup
from ebooklib import epub

from core.cleaner import BLOCK_TAGS
from core.pdf_templates import PdfBookTemplate, get_pdf_template


_PAGE_NUMBER_RE = re.compile(r"^\s*(?:\d{1,4}|[ivxlcdm]{1,8})(?:\s+\d{1,4})?\s*$", re.IGNORECASE)
_CHAPTER_RE = re.compile(
    r"^\s*(?:chapter|chapitre|part|partie|book|livre|volume|prologue|epilogue|épilogue)\b",
    re.IGNORECASE,
)
_SPACE_RE = re.compile(r"\s+")


class PdfParser:
    """Extract semantic book blocks and rebuild a clean, reflowable PDF."""

    PASSTHROUGH_IMAGE_RATIO = 0.52

    def __init__(
        self,
        pdf_path: Path,
        template_name: str = "literary-book",
        legacy: bool = False,
    ):
        self.pdf_path = Path(pdf_path)
        self.doc = fitz.open(str(pdf_path))
        self.template = get_pdf_template(template_name)
        self.legacy = legacy
        self._page_profiles: Dict[int, Dict[str, Any]] = {}

    def extract_nodes(self) -> Tuple[List[Dict[str, Any]], List[str]]:
        if self.legacy:
            return self._extract_legacy_nodes()
        candidates: List[Dict[str, Any]] = []
        margin_signatures: Counter[str] = Counter()
        size_weights: Counter[float] = Counter()
        page_profiles: Dict[int, Dict[str, Any]] = {}

        for page_idx, page in enumerate(self.doc):
            page_dict = page.get_text("dict", sort=True)
            page_area = max(1.0, page.rect.width * page.rect.height)
            image_area = 0.0
            page_candidates: List[Dict[str, Any]] = []

            for block_idx, block in enumerate(page_dict.get("blocks", [])):
                bbox = block.get("bbox")
                if not bbox:
                    continue
                if block.get("type") == 1:
                    rect = fitz.Rect(bbox) & page.rect
                    image_area += max(0.0, rect.width * rect.height)
                    continue
                if block.get("type") != 0:
                    continue

                candidate = self._candidate_from_block(page_idx, block_idx, block, page.rect)
                if not candidate:
                    continue
                page_candidates.append(candidate)
                for size, weight in candidate["size_weights"].items():
                    size_weights[size] += weight

                y0, y1 = candidate["bbox"][1], candidate["bbox"][3]
                if y0 < page.rect.height * 0.12 or y1 > page.rect.height * 0.88:
                    margin_signatures[candidate["signature"]] += 1

            ratio = min(1.0, image_area / page_area)
            page_profiles[page_idx + 1] = {
                "has_text": bool(page_candidates),
                "has_images": image_area > 0,
                "image_ratio": ratio,
                "passthrough": (not page_candidates and image_area > 0)
                or ratio >= self.PASSTHROUGH_IMAGE_RATIO,
            }
            candidates.extend(page_candidates)

        if not candidates:
            self._page_profiles = page_profiles
            return [], []

        body_size = max(size_weights, key=size_weights.get) if size_weights else 11.0
        repeated_margins = {signature for signature, count in margin_signatures.items() if count >= 3}
        node_meta: List[Dict[str, Any]] = []
        node_texts: List[str] = []

        for candidate in candidates:
            if _PAGE_NUMBER_RE.fullmatch(candidate["plain_text"]):
                continue
            if candidate["signature"] in repeated_margins:
                continue
            if page_profiles[candidate["page_num"]]["passthrough"]:
                continue

            tag_name, role = self._classify_candidate(candidate, body_size)
            html_block = f"<{tag_name}>{candidate['inner_html']}</{tag_name}>"
            node_meta.append(
                {
                    "page_num": candidate["page_num"],
                    "block_idx": candidate["block_idx"],
                    "bbox": candidate["bbox"],
                    "font_size": candidate["font_size"],
                    "body_font_size": body_size,
                    "role": role,
                    "tag_name": tag_name,
                    "original_html": html_block,
                }
            )
            node_texts.append(html_block)

        self._page_profiles = page_profiles
        return node_meta, node_texts

    def _extract_legacy_nodes(self) -> Tuple[List[Dict[str, Any]], List[str]]:
        """Reproduce parser v1 boundaries so existing checkpoints remain resumable."""
        node_meta: List[Dict[str, Any]] = []
        node_texts: List[str] = []
        for page_idx, page in enumerate(self.doc):
            page_width = page.rect.width
            for block_idx, block in enumerate(page.get_text("dict").get("blocks", [])):
                bbox = block.get("bbox")
                lines = block.get("lines", [])
                if block.get("type") != 0 or not bbox or not lines:
                    continue
                text_lines: List[str] = []
                font_sizes: List[float] = []
                colors: List[int] = []
                is_bold = False
                is_italic = False
                for line in lines:
                    line_text = ""
                    for span in line.get("spans", []):
                        value = span.get("text", "")
                        if not value:
                            continue
                        line_text += value
                        font_sizes.append(float(span.get("size", 10.0)))
                        colors.append(int(span.get("color", 0)))
                        font_name = span.get("font", "").lower()
                        flags = int(span.get("flags", 0))
                        is_bold = is_bold or bool(flags & 16) or "bold" in font_name
                        is_italic = is_italic or bool(flags & 2) or any(
                            name in font_name for name in ("italic", "oblique")
                        )
                    if line_text.strip():
                        text_lines.append(line_text.strip())
                clean_block = " ".join(text_lines).strip()
                if not clean_block or _PAGE_NUMBER_RE.fullmatch(clean_block):
                    continue

                average_size = sum(font_sizes) / len(font_sizes) if font_sizes else 10.0
                dominant_color = max(set(colors), key=colors.count) if colors else 0
                color = (
                    ((dominant_color >> 16) & 0xFF) / 255.0,
                    ((dominant_color >> 8) & 0xFF) / 255.0,
                    (dominant_color & 0xFF) / 255.0,
                )
                x0, _, x1, _ = bbox
                width = x1 - x0
                midpoint = (x0 + x1) / 2
                if abs(midpoint - page_width / 2) < 35 and width < page_width * 0.85:
                    alignment = fitz.TEXT_ALIGN_CENTER
                elif x0 > page_width * 0.6:
                    alignment = fitz.TEXT_ALIGN_RIGHT
                else:
                    alignment = fitz.TEXT_ALIGN_LEFT
                tag_name = "h1" if average_size >= 15 else "h2" if average_size >= 12.5 else "p"
                html_block = f"<{tag_name}>{escape(clean_block, quote=False)}</{tag_name}>"
                node_meta.append(
                    {
                        "page_num": page_idx + 1,
                        "block_idx": block_idx,
                        "bbox": tuple(bbox),
                        "font_size": average_size,
                        "color": color,
                        "align": alignment,
                        "is_bold": is_bold,
                        "is_italic": is_italic,
                        "original_html": html_block,
                    }
                )
                node_texts.append(html_block)
        return node_meta, node_texts

    def _candidate_from_block(
        self,
        page_idx: int,
        block_idx: int,
        block: Dict[str, Any],
        page_rect: fitz.Rect,
    ) -> Dict[str, Any] | None:
        styled_parts: List[Tuple[str, bool, bool]] = []
        plain_parts: List[str] = []
        size_weights: Counter[float] = Counter()
        bold_weight = 0
        italic_weight = 0
        total_weight = 0

        for line in block.get("lines", []):
            line_parts: List[Tuple[str, bool, bool]] = []
            line_plain = ""
            for span in line.get("spans", []):
                text = span.get("text", "").replace("\u00a0", " ")
                if not text:
                    continue
                font_name = span.get("font", "").lower()
                flags = int(span.get("flags", 0))
                bold = bool(flags & 16) or any(name in font_name for name in ("bold", "semibold", "black"))
                italic = bool(flags & 2) or any(name in font_name for name in ("italic", "oblique"))
                weight = max(1, len(text.strip()))
                size = round(float(span.get("size", 10.0)) * 2) / 2
                size_weights[size] += weight
                total_weight += weight
                bold_weight += weight if bold else 0
                italic_weight += weight if italic else 0
                line_parts.append((text, bold, italic))
                line_plain += text

            line_plain = line_plain.strip()
            if not line_plain:
                continue
            if plain_parts:
                previous = plain_parts[-1]
                if previous.endswith("-") and line_plain[:1].islower():
                    plain_parts[-1] = previous[:-1]
                    if styled_parts:
                        text, bold, italic = styled_parts[-1]
                        styled_parts[-1] = (text[:-1], bold, italic)
                else:
                    plain_parts.append(" ")
                    styled_parts.append((" ", False, False))
            plain_parts.append(line_plain)
            line_parts[0] = (line_parts[0][0].lstrip(), line_parts[0][1], line_parts[0][2])
            line_parts[-1] = (line_parts[-1][0].rstrip(), line_parts[-1][1], line_parts[-1][2])
            styled_parts.extend(line_parts)

        plain_text = _SPACE_RE.sub(" ", "".join(plain_parts)).strip()
        if not plain_text:
            return None

        merged_parts: List[Tuple[str, bool, bool]] = []
        for text, bold, italic in styled_parts:
            if not text:
                continue
            if merged_parts and merged_parts[-1][1:] == (bold, italic):
                previous_text, _, _ = merged_parts[-1]
                merged_parts[-1] = (previous_text + text, bold, italic)
            else:
                merged_parts.append((text, bold, italic))

        inner_html = "".join(self._inline_html(text, bold, italic) for text, bold, italic in merged_parts)
        font_size = max(size_weights, key=size_weights.get) if size_weights else 10.0
        x0, y0, x1, y1 = block["bbox"]
        width = x1 - x0
        centered = abs(((x0 + x1) / 2) - (page_rect.width / 2)) <= 18 and width < page_rect.width * 0.72
        signature = _SPACE_RE.sub(" ", plain_text.lower()).strip()

        return {
            "page_num": page_idx + 1,
            "block_idx": block_idx,
            "bbox": tuple(block["bbox"]),
            "plain_text": plain_text,
            "inner_html": inner_html,
            "signature": signature,
            "size_weights": size_weights,
            "font_size": font_size,
            "centered": centered,
            "mostly_bold": bold_weight >= total_weight * 0.55 if total_weight else False,
            "mostly_italic": italic_weight >= total_weight * 0.65 if total_weight else False,
        }

    @staticmethod
    def _inline_html(text: str, bold: bool, italic: bool) -> str:
        value = escape(text, quote=False)
        if italic:
            value = f"<em>{value}</em>"
        if bold:
            value = f"<strong>{value}</strong>"
        return value

    @staticmethod
    def _classify_candidate(candidate: Dict[str, Any], body_size: float) -> Tuple[str, str]:
        text = candidate["plain_text"]
        size = candidate["font_size"]
        centered = candidate["centered"]
        chapter_like = bool(_CHAPTER_RE.match(text))

        if size >= body_size * 1.45 or (
            chapter_like and size >= body_size * 1.30
        ) or (candidate["mostly_bold"] and size >= body_size * 1.20 and len(text) <= 180):
            return "h1", "chapter"
        if centered and len(text) <= 180 and (size >= body_size * 1.07 or chapter_like):
            return "h2", "toc" if chapter_like else "section"
        return "p", "body"

    def reconstruct_pdf(
        self,
        node_meta: List[Dict[str, Any]],
        translated_nodes: List[str],
        output_path: Path,
    ) -> None:
        """Build a new, naturally paginated book instead of painting over text boxes."""
        if self.legacy:
            self.reconstruct_overlay_pdf(node_meta, translated_nodes, output_path)
            return
        if len(node_meta) != len(translated_nodes):
            raise ValueError("Le nombre de blocs PDF traduits ne correspond pas à la source.")
        if not self._page_profiles:
            self.extract_nodes()

        page_blocks: Dict[int, List[str]] = defaultdict(list)
        expected_text_parts: List[str] = []
        for meta, translated_html in zip(node_meta, translated_nodes):
            block = self._prepare_translated_block(meta, translated_html)
            page_blocks[int(meta["page_num"])].append(block)
            expected_text_parts.append(self._plain_text(block))

        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        final_doc = fitz.open()
        body_pages: List[int] = []
        passthrough_pages: set[int] = set()
        pending_blocks: List[str] = []

        def flush_story() -> None:
            if not pending_blocks:
                return
            first_page = len(final_doc)
            story_doc = self._render_story(pending_blocks, self.template)
            for story_page in story_doc:
                if story_page.get_text().strip() or story_page.get_images(full=True):
                    final_doc.insert_pdf(story_doc, from_page=story_page.number, to_page=story_page.number)
                    body_pages.append(len(final_doc) - 1)
            story_doc.close()
            pending_blocks.clear()
            if len(final_doc) == first_page:
                raise RuntimeError("Le moteur de mise en page PDF n’a produit aucune page.")

        for page_num in range(1, len(self.doc) + 1):
            profile = self._page_profiles.get(page_num, {})
            if profile.get("passthrough"):
                flush_story()
                self._append_source_page(final_doc, page_num - 1, self.template)
                passthrough_pages.add(len(final_doc) - 1)
                continue
            pending_blocks.extend(page_blocks.get(page_num, []))
        flush_story()

        if not final_doc.page_count:
            final_doc.close()
            raise RuntimeError("Le PDF reconstruit est vide.")

        self._add_page_numbers(final_doc, body_pages)
        self._set_document_metadata(final_doc)
        self._build_outline(final_doc)
        final_doc.save(str(output_path), garbage=4, deflate=True, clean=True)
        final_doc.close()

        self._validate_reflow_pdf(output_path, " ".join(expected_text_parts), passthrough_pages)

    def _prepare_translated_block(self, meta: Dict[str, Any], translated_html: str) -> str:
        soup = BeautifulSoup(translated_html or "", "html.parser")
        tag = soup.find(BLOCK_TAGS)
        if not tag:
            raise ValueError("Un bloc traduit du PDF ne contient aucune balise éditoriale valide.")
        tag.attrs = {}
        role = meta.get("role", "body")
        if role == "chapter":
            tag.name = "h1"
            tag["class"] = "chapter-title"
        elif role == "toc":
            tag.name = "h2"
            tag["class"] = "toc-entry"
        elif role == "section":
            tag.name = "h2"
            tag["class"] = "section-title"
        else:
            tag.name = "p"
        return str(tag)

    @staticmethod
    def _plain_text(html_block: str) -> str:
        return BeautifulSoup(html_block, "html.parser").get_text(" ", strip=True)

    def _font_css(self, template: PdfBookTemplate, archive: fitz.Archive) -> str:
        serif_css = self._system_serif_css(archive)
        if serif_css:
            return template.css + serif_css
        if not fitz.fitz_fontdescriptors or "figo" not in fitz.fitz_fontdescriptors:
            raise RuntimeError(
                "La police Unicode PDF est absente. Installez pymupdf-fonts==1.0.5."
            )
        return fitz.css_for_pymupdf_font(
            "figo",
            CSS=template.css,
            archive=archive,
            name="tradoc-book",
        )

    @staticmethod
    def _system_serif_css(archive: fitz.Archive) -> str:
        """Use a complete OS serif family; never trust a subset embedded in the source PDF."""
        required_codepoints = (0x00E9, 0x00E0, 0x00C9, 0x0153, 0x0152, 0x2019, 0x00AB, 0x00BB)
        families = (
            (
                Path("C:/Windows/Fonts"),
                {
                    "regular": "georgia.ttf",
                    "bold": "georgiab.ttf",
                    "italic": "georgiai.ttf",
                    "bold-italic": "georgiaz.ttf",
                },
            ),
            (
                Path("/usr/share/fonts/truetype/dejavu"),
                {
                    "regular": "DejaVuSerif.ttf",
                    "bold": "DejaVuSerif-Bold.ttf",
                    "italic": "DejaVuSerif-Italic.ttf",
                    "bold-italic": "DejaVuSerif-BoldItalic.ttf",
                },
            ),
            (
                Path("/System/Library/Fonts/Supplemental"),
                {
                    "regular": "Georgia.ttf",
                    "bold": "Georgia Bold.ttf",
                    "italic": "Georgia Italic.ttf",
                    "bold-italic": "Georgia Bold Italic.ttf",
                },
            ),
        )
        for directory, variants in families:
            regular = directory / variants["regular"]
            if not all((directory / filename).is_file() for filename in variants.values()):
                continue
            try:
                font = fitz.Font(fontfile=str(regular))
                if not all(font.has_glyph(codepoint) for codepoint in required_codepoints):
                    continue
            except Exception:
                continue
            archive.add(str(directory))
            rules: List[str] = []
            for style, filename in variants.items():
                attributes = ""
                if "bold" in style:
                    attributes += " font-weight: bold;"
                if "italic" in style:
                    attributes += " font-style: italic;"
                rules.append(
                    f"@font-face {{ font-family: tradoc-book; src: url('{filename}');{attributes} }}"
                )
            return "\n" + "\n".join(rules)
        return ""

    def _render_story(self, blocks: Iterable[str], template: PdfBookTemplate) -> fitz.Document:
        html = "<main>" + "\n".join(blocks) + "</main>"
        archive = fitz.Archive()
        css = self._font_css(template, archive)
        story = fitz.Story(html=html, user_css=css, archive=archive)
        buffer = io.BytesIO()
        writer = fitz.DocumentWriter(buffer, "compress")
        more = True
        page_count = 0
        try:
            while more:
                device = writer.begin_page(template.media_box)
                more, _ = story.place(template.content_box)
                story.draw(device)
                writer.end_page()
                page_count += 1
                if page_count > 100_000:
                    raise RuntimeError("La pagination PDF ne converge pas.")
        finally:
            writer.close()
        return fitz.open("pdf", buffer.getvalue())

    def _append_source_page(
        self,
        target: fitz.Document,
        source_page_index: int,
        template: PdfBookTemplate,
    ) -> None:
        source_page = self.doc[source_page_index]
        page = target.new_page(width=template.width, height=template.height)
        available = fitz.Rect(0, 0, template.width, template.height)
        scale = min(available.width / source_page.rect.width, available.height / source_page.rect.height)
        width = source_page.rect.width * scale
        height = source_page.rect.height * scale
        rect = fitz.Rect(
            (template.width - width) / 2,
            (template.height - height) / 2,
            (template.width + width) / 2,
            (template.height + height) / 2,
        )
        page.show_pdf_page(rect, self.doc, source_page_index, keep_proportion=True)

    @staticmethod
    def _add_page_numbers(doc: fitz.Document, body_pages: List[int]) -> None:
        logical_page = 0
        for page_index in body_pages:
            page = doc[page_index]
            logical_page += 1
            blocks = page.get_text("dict").get("blocks", [])
            is_chapter_opening = any(
                span.get("size", 0) >= 18
                for block in blocks
                if block.get("type") == 0
                for line in block.get("lines", [])
                for span in line.get("spans", [])
            )
            if is_chapter_opening:
                continue
            footer = fitz.Rect(36, page.rect.height - 28, page.rect.width - 36, page.rect.height - 14)
            page.insert_textbox(
                footer,
                str(logical_page),
                fontsize=7.5,
                fontname="helv",
                color=(0.42, 0.45, 0.50),
                align=fitz.TEXT_ALIGN_CENTER,
            )

    def _set_document_metadata(self, doc: fitz.Document) -> None:
        source_metadata = dict(self.doc.metadata or {})
        title = source_metadata.get("title") or self.pdf_path.stem
        source_metadata.update(
            {
                "title": title,
                "producer": "TraDoc PDF Book Renderer",
                "creator": "TraDoc",
            }
        )
        doc.set_metadata({key: value or "" for key, value in source_metadata.items()})

    @staticmethod
    def _build_outline(doc: fitz.Document) -> None:
        toc: List[List[Any]] = []
        for page_index, page in enumerate(doc):
            for block in page.get_text("dict").get("blocks", []):
                if block.get("type") != 0:
                    continue
                spans = [span for line in block.get("lines", []) for span in line.get("spans", [])]
                if not spans or max(float(span.get("size", 0)) for span in spans) < 18:
                    continue
                text = _SPACE_RE.sub(
                    " ",
                    " ".join(span.get("text", "") for span in spans),
                ).strip()
                if text and len(text) <= 220:
                    toc.append([1, text, page_index + 1])
        if toc:
            doc.set_toc(toc)

    @staticmethod
    def _validate_reflow_pdf(
        output_path: Path,
        expected_text: str,
        passthrough_pages: set[int],
    ) -> None:
        doc = fitz.open(str(output_path))
        try:
            if doc.page_count == 0:
                raise RuntimeError("Le PDF généré ne contient aucune page.")
            extracted_parts: List[str] = []
            for page_index, page in enumerate(doc):
                text = page.get_text().strip()
                if page_index not in passthrough_pages and not text:
                    raise RuntimeError(f"La page PDF {page_index + 1} est vide après reconstruction.")
                extracted_parts.append(text)
                for block in page.get_text("blocks"):
                    rect = fitz.Rect(block[:4])
                    if not page.rect.contains(rect + (-2, -2, 2, 2)):
                        raise RuntimeError(f"Du contenu dépasse de la page PDF {page_index + 1}.")

            extracted = _SPACE_RE.sub(" ", " ".join(extracted_parts)).strip()
            expected = _SPACE_RE.sub(" ", expected_text).strip()
            if "\ufffd" in extracted:
                raise RuntimeError("Le PDF généré contient des caractères Unicode invalides.")
            if expected and len(extracted) < len(expected) * 0.88:
                raise RuntimeError("Le PDF généré semble avoir perdu une partie du texte traduit.")
        finally:
            doc.close()

    def reconstruct_overlay_pdf(
        self,
        node_meta: List[Dict[str, Any]],
        translated_nodes: List[str],
        output_path: Path,
    ) -> None:
        """Experimental legacy mode kept for exceptional fixed-layout documents."""
        pdf_doc = fitz.open(str(self.pdf_path))
        pages_map: Dict[int, List[Tuple[Dict[str, Any], str]]] = defaultdict(list)
        for meta, translated_html in zip(node_meta, translated_nodes):
            page_index = int(meta.get("page_num", 1)) - 1
            if 0 <= page_index < len(pdf_doc) and meta.get("bbox"):
                pages_map[page_index].append((meta, translated_html))

        font = fitz.Font("figo")
        role_sizes = {
            "chapter": 18.0,
            "section": 11.5,
            "toc": 10.25,
            "body": self.template.body_font_size,
        }
        role_minimums = {
            "chapter": 16.0,
            "section": 10.5,
            "toc": 9.75,
            "body": 9.5,
        }
        for page_index, items in pages_map.items():
            page = pdf_doc[page_index]
            for meta, _ in items:
                page.add_redact_annot(fitz.Rect(meta["bbox"]), fill=(1, 1, 1))
            page.apply_redactions()
            page.insert_font(fontname="TraDocUnicode", fontbuffer=font.buffer)
            for meta, translated_html in items:
                text = self._plain_text(translated_html)
                source_rect = fitz.Rect(meta["bbox"])
                role = meta.get("role", "body")
                # The source bbox is only as wide as the English glyphs. French
                # is often longer, so fitting inside that exact width causes a
                # different font size for every line. Use stable book margins.
                horizontal_margin = 42.0
                rect = fitz.Rect(
                    horizontal_margin,
                    source_rect.y0 - 1.5,
                    page.rect.width - horizontal_margin,
                    source_rect.y1 + 2.0,
                )
                size = role_sizes.get(role, self.template.body_font_size)
                minimum = role_minimums.get(role, 9.5)
                alignment = (
                    fitz.TEXT_ALIGN_CENTER
                    if role in {"chapter", "section", "toc"}
                    else fitz.TEXT_ALIGN_LEFT
                )
                while size >= minimum:
                    result = page.insert_textbox(
                        rect,
                        text,
                        fontsize=size,
                        fontname="TraDocUnicode",
                        color=(0, 0, 0),
                        align=alignment,
                    )
                    if result >= 0:
                        break
                    size -= 0.25
                if result < 0:
                    # A very dense body block may need a little more vertical
                    # room. Keep the minimum readable size rather than collapsing
                    # independently toward 7 pt.
                    expanded = fitz.Rect(rect.x0, rect.y0, rect.x1, min(page.rect.height - 36, rect.y1 + 18))
                    result = page.insert_textbox(
                        expanded,
                        text,
                        fontsize=minimum,
                        fontname="TraDocUnicode",
                        color=(0, 0, 0),
                        align=alignment,
                    )
                if result < 0:
                    raise RuntimeError(
                        f"Le bloc PDF de la page {page_index + 1} ne tient pas dans l'aperçu sans devenir illisible."
                    )
        pdf_doc.save(str(output_path), garbage=4, deflate=True, clean=True)
        pdf_doc.close()

    def reconstruct_partial_pdf(
        self,
        node_meta: List[Dict[str, Any]],
        translated_nodes: List[str],
        output_path: Path,
        changed_node_indices: Iterable[int],
    ) -> None:
        """Create a fast preview by overlaying only nodes translated in the snapshot.

        The original pages remain untouched everywhere else. The expensive book-wide
        reflow renderer stays reserved for the completed, final export.
        """
        changed = sorted(set(changed_node_indices))
        if not changed:
            raise ValueError("Aucun bloc PDF traduit n'est disponible pour l'aperçu.")
        selected_meta = [node_meta[index] for index in changed if 0 <= index < len(node_meta)]
        selected_nodes = [translated_nodes[index] for index in changed if 0 <= index < len(translated_nodes)]
        if len(selected_meta) != len(changed) or len(selected_nodes) != len(changed):
            raise ValueError("Certains blocs PDF traduits ne peuvent pas être remappés.")
        self.reconstruct_overlay_pdf(selected_meta, selected_nodes, output_path)

    def export_translated_epub(self, title: str, translated_nodes: List[str], output_path: Path) -> None:
        book = epub.EpubBook()
        book.set_identifier(f"tradoc-pdf-{self.pdf_path.stem}")
        book.set_title(title)
        book.set_language("fr")
        style = """
        @namespace url('http://www.w3.org/1999/xhtml');
        body { font-family: Georgia, serif; line-height: 1.6; padding: 5%; }
        p { margin-bottom: 1em; text-indent: 1.5em; text-align: justify; }
        h1, h2 { text-align: center; margin-top: 2em; }
        """
        nav_css = epub.EpubItem(
            uid="style_nav",
            file_name="style/nav.css",
            media_type="text/css",
            content=style,
        )
        book.add_item(nav_css)
        html_content = "<html><head><link rel='stylesheet' href='style/nav.css'/></head><body>"
        html_content += f"<h1>{escape(title)}</h1>" + "\n".join(translated_nodes) + "</body></html>"
        chapter = epub.EpubHtml(title="Traduction", file_name="chapter_1.xhtml", lang="fr")
        chapter.content = html_content
        chapter.add_item(nav_css)
        book.add_item(chapter)
        book.toc = (epub.Link("chapter_1.xhtml", "Traduction", "chap1"),)
        book.add_item(epub.EpubNcx())
        book.add_item(epub.EpubNav())
        book.spine = ["nav", chapter]
        epub.write_epub(str(output_path), book, {})

    def export_translated_pdf(self, title: str, translated_nodes: List[str], output_path: Path) -> None:
        blocks = [f"<h1>{escape(title)}</h1>", *translated_nodes]
        rendered = self._render_story(blocks, self.template)
        rendered.set_metadata(
            {"title": title, "producer": "TraDoc PDF Book Renderer", "creator": "TraDoc"}
        )
        rendered.save(str(output_path), garbage=4, deflate=True, clean=True)
        rendered.close()

    def close(self) -> None:
        if self.doc and not self.doc.is_closed:
            self.doc.close()

    def __del__(self) -> None:
        try:
            self.close()
        except Exception:
            pass
