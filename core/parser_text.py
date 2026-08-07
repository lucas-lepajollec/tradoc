from pathlib import Path
from typing import List, Tuple, Dict, Any
from bs4 import BeautifulSoup

class TextParser:
    def __init__(self, text_path: Path):
        self.text_path = text_path
        self.raw_content = text_path.read_text(encoding="utf-8", errors="replace")

    def extract_nodes(self) -> Tuple[List[Dict[str, Any]], List[str]]:
        """
        Parses Markdown or plain text into paragraph and header HTML blocks.
        Returns:
        - node_meta: metadata tracking block index and tag type
        - node_texts: list of paragraph HTML strings (<p>...</p>, <h1>...</h1>, etc.)
        """
        node_meta: List[Dict[str, Any]] = []
        node_texts: List[str] = []

        lines = self.raw_content.splitlines()
        current_block = []
        block_idx = 0

        def flush_block():
            nonlocal block_idx, current_block
            if not current_block:
                return
            block_str = "\n".join(current_block).strip()
            current_block = []
            if not block_str:
                return

            # Check if Markdown heading
            if block_str.startswith("# "):
                tag_name = "h1"
                inner = block_str[2:].strip()
            elif block_str.startswith("## "):
                tag_name = "h2"
                inner = block_str[3:].strip()
            elif block_str.startswith("### "):
                tag_name = "h3"
                inner = block_str[4:].strip()
            else:
                tag_name = "p"
                inner = block_str

            html_node = f"<{tag_name}>{inner}</{tag_name}>"
            node_meta.append({
                "block_idx": block_idx,
                "tag_name": tag_name,
                "original_html": html_node
            })
            node_texts.append(html_node)
            block_idx += 1

        for line in lines:
            if not line.strip():
                flush_block()
            else:
                current_block.append(line)
        flush_block()

        return node_meta, node_texts

    def reconstruct_text(self, node_meta: List[Dict[str, Any]], translated_nodes: List[str], output_path: Path):
        """
        Reconstructs Markdown or plain text output from translated HTML nodes.
        """
        output_blocks = []
        for meta, trans_html in zip(node_meta, translated_nodes):
            if not trans_html or not trans_html.strip():
                continue
            soup = BeautifulSoup(trans_html, "html.parser")
            tag_name = meta["tag_name"]
            text_val = soup.get_text().strip()
            if not text_val:
                continue

            if tag_name == "h1":
                output_blocks.append(f"# {text_val}")
            elif tag_name == "h2":
                output_blocks.append(f"## {text_val}")
            elif tag_name == "h3":
                output_blocks.append(f"### {text_val}")
            else:
                output_blocks.append(text_val)

        final_content = "\n\n".join(output_blocks) + "\n"
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(final_content, encoding="utf-8")
