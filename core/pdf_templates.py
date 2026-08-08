from dataclasses import dataclass

import fitz


@dataclass(frozen=True)
class PdfBookTemplate:
    """Deterministic page geometry and typography for reflowed books."""

    name: str
    width: float
    height: float
    margin_left: float
    margin_top: float
    margin_right: float
    margin_bottom: float
    body_font_size: float

    @property
    def media_box(self) -> fitz.Rect:
        return fitz.Rect(0, 0, self.width, self.height)

    @property
    def content_box(self) -> fitz.Rect:
        return fitz.Rect(
            self.margin_left,
            self.margin_top,
            self.width - self.margin_right,
            self.height - self.margin_bottom,
        )

    @property
    def css(self) -> str:
        return f"""
        html, body {{
            font-family: tradoc-book;
            font-size: {self.body_font_size}pt;
            line-height: 1.48;
            color: #202124;
            background: #ffffff;
        }}
        body {{ margin: 0; padding: 0; }}
        p {{
            margin: 0 0 8.5pt 0;
            text-align: justify;
            text-indent: 15pt;
        }}
        h1 + p, h2 + p, blockquote + p {{ text-indent: 0; }}
        h1 {{
            font-size: 22pt;
            line-height: 1.18;
            font-weight: bold;
            text-align: center;
            color: #111827;
            margin: 0 0 30pt 0;
            padding-top: 18pt;
            page-break-before: always;
            page-break-after: avoid;
        }}
        h1:first-child {{ page-break-before: avoid; }}
        h2 {{
            font-size: 14pt;
            line-height: 1.25;
            font-weight: bold;
            text-align: center;
            color: #1f2937;
            margin: 20pt 0 14pt 0;
            page-break-after: avoid;
        }}
        h2.toc-entry {{
            font-size: 10.25pt;
            line-height: 1.25;
            font-weight: normal;
            text-align: left;
            margin: 0 0 4pt 0;
            page-break-after: avoid;
        }}
        blockquote {{
            margin: 8pt 20pt 12pt 20pt;
            padding-left: 12pt;
            border-left: 1.5pt solid #9ca3af;
            font-style: italic;
            color: #374151;
        }}
        img {{
            display: block;
            max-width: 100%;
            max-height: 470pt;
            margin: 14pt auto 18pt auto;
        }}
        strong, b {{ font-weight: bold; }}
        em, i {{ font-style: italic; }}
        """


LITERARY_BOOK = PdfBookTemplate(
    name="literary-book",
    width=432.0,   # 6 inches
    height=648.0,  # 9 inches
    margin_left=48.0,
    margin_top=50.0,
    margin_right=48.0,
    margin_bottom=48.0,
    body_font_size=10.75,
)


PDF_TEMPLATES = {LITERARY_BOOK.name: LITERARY_BOOK}


def get_pdf_template(name: str = LITERARY_BOOK.name) -> PdfBookTemplate:
    try:
        return PDF_TEMPLATES[name]
    except KeyError as exc:
        raise ValueError(f"Template PDF inconnu: {name}") from exc
