import copy
from pathlib import Path
from typing import List, Tuple, Dict, Any
from bs4 import BeautifulSoup
import docx

class DocxParser:
    def __init__(self, docx_path: Path):
        self.docx_path = docx_path
        self.doc = docx.Document(str(docx_path))

    def extract_nodes(self) -> Tuple[List[Dict[str, Any]], List[str]]:
        """
        Parses all paragraphs and table cells in the DOCX file.
        Returns:
        - node_meta: metadata tracking element type ('paragraph' or 'table_cell') and index
        - node_texts: list of paragraph HTML strings (<p>...</p> or <h1>...</h1>)
        """
        node_meta: List[Dict[str, Any]] = []
        node_texts: List[str] = []

        # Process paragraphs
        for idx, p in enumerate(self.doc.paragraphs):
            text = p.text.strip()
            if not text:
                continue

            # Map style to heading tag if applicable
            style_name = p.style.name.lower() if p.style else ""
            if "heading 1" in style_name:
                tag_name = "h1"
            elif "heading 2" in style_name:
                tag_name = "h2"
            elif "heading 3" in style_name:
                tag_name = "h3"
            else:
                tag_name = "p"

            # Reconstruct inline HTML (bold/italic)
            html_content = ""
            if p.runs:
                for run in p.runs:
                    r_text = run.text
                    if not r_text:
                        continue
                    if run.bold and run.italic:
                        r_text = f"<b><i>{r_text}</i></b>"
                    elif run.bold:
                        r_text = f"<b>{r_text}</b>"
                    elif run.italic:
                        r_text = f"<i>{r_text}</i>"
                    html_content += r_text
            else:
                html_content = text

            if not html_content.strip():
                continue

            raw_node_html = f"<{tag_name}>{html_content}</{tag_name}>"
            node_meta.append({
                "type": "paragraph",
                "idx": idx,
                "tag_name": tag_name,
                "original_html": raw_node_html
            })
            node_texts.append(raw_node_html)

        # Process tables
        for t_idx, table in enumerate(self.doc.tables):
            for r_idx, row in enumerate(table.rows):
                for c_idx, cell in enumerate(row.cells):
                    cell_text = cell.text.strip()
                    if not cell_text:
                        continue

                    raw_node_html = f"<p>{cell_text}</p>"
                    node_meta.append({
                        "type": "table_cell",
                        "table_idx": t_idx,
                        "row_idx": r_idx,
                        "col_idx": c_idx,
                        "original_html": raw_node_html
                    })
                    node_texts.append(raw_node_html)

        return node_meta, node_texts

    def reconstruct_docx(self, node_meta: List[Dict[str, Any]], translated_nodes: List[str], output_path: Path):
        """
        Injects translated text back into a copy of the DOCX document.
        """
        out_doc = docx.Document(str(self.docx_path))

        for meta, trans_html in zip(node_meta, translated_nodes):
            soup = BeautifulSoup(trans_html, "html.parser")
            clean_text = soup.get_text()

            if meta["type"] == "paragraph":
                p_idx = meta["idx"]
                if p_idx < len(out_doc.paragraphs):
                    p = out_doc.paragraphs[p_idx]
                    p.text = clean_text
            elif meta["type"] == "table_cell":
                t_idx = meta["table_idx"]
                r_idx = meta["row_idx"]
                c_idx = meta["col_idx"]
                if t_idx < len(out_doc.tables):
                    table = out_doc.tables[t_idx]
                    if r_idx < len(table.rows) and c_idx < len(table.rows[r_idx].cells):
                        cell = table.rows[r_idx].cells[c_idx]
                        cell.text = clean_text

        output_path.parent.mkdir(parents=True, exist_ok=True)
        out_doc.save(str(output_path))
