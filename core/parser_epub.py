import copy
from pathlib import Path
from typing import List, Tuple, Dict, Any, Iterable, Optional
import ebooklib
from ebooklib import epub
from bs4 import BeautifulSoup


BLOCK_TAGS = ["p", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "li", "caption", "figcaption"]


def _top_level_blocks(soup: BeautifulSoup):
    return [tag for tag in soup.find_all(BLOCK_TAGS) if tag.find_parent(BLOCK_TAGS) is None]

class EpubParser:
    def __init__(self, epub_path: Path, legacy: bool = False):
        self.epub_path = epub_path
        self.legacy = legacy
        self.book = epub.read_epub(str(epub_path))

    def extract_nodes(self) -> Tuple[List[Dict[str, Any]], List[str]]:
        """
        Parses all HTML items in the EPUB.
        Returns:
        - node_meta: list of metadata dicts tracking item_id, bs4 tag reference identifier, original node html
        - node_texts: list of raw HTML/text strings to be chunked and translated
        """
        node_meta: List[Dict[str, Any]] = []
        node_texts: List[str] = []

        for item in self.book.get_items():
            if item.get_type() == ebooklib.ITEM_DOCUMENT:
                content = item.get_content().decode("utf-8", errors="replace")
                soup = BeautifulSoup(content, "html.parser")

                # Find candidate tags
                # Nested blocks (notably <li><p>...</p></li>) must be represented
                # once, otherwise reconstruction translates and injects them twice.
                tags = soup.find_all(BLOCK_TAGS) if self.legacy else _top_level_blocks(soup)
                for tag_idx, tag in enumerate(tags):
                    text_content = tag.get_text().strip()
                    if not text_content:
                        continue
                    
                    # Convert tag to string representation preserving inline HTML (<em>, <i>, <b>)
                    raw_tag_str = str(tag)

                    node_meta.append({
                        "item_id": item.get_id(),
                        "tag_idx": tag_idx,
                        "tag_name": tag.name,
                        "original_html": raw_tag_str
                    })
                    node_texts.append(raw_tag_str)

        return node_meta, node_texts

    def reconstruct_epub(
        self,
        node_meta: List[Dict[str, Any]],
        translated_nodes: List[str],
        output_path: Path,
        changed_node_indices: Optional[Iterable[int]] = None,
    ):
        """
        Re-injects translated HTML nodes into a copy of the EPUB and writes the output file.
        """
        out_book = copy.deepcopy(self.book)
        changed = set(changed_node_indices) if changed_node_indices is not None else None

        # Group translated nodes by item_id
        item_updates: Dict[str, List[Tuple[int, str]]] = {}
        for node_index, (meta, translated_html) in enumerate(zip(node_meta, translated_nodes)):
            if changed is not None and node_index not in changed:
                continue
            item_id = meta["item_id"]
            tag_idx = meta["tag_idx"]
            if item_id not in item_updates:
                item_updates[item_id] = []
            item_updates[item_id].append((tag_idx, translated_html))

        for item in out_book.get_items():
            if item.get_type() == ebooklib.ITEM_DOCUMENT and item.get_id() in item_updates:
                content = item.get_content().decode("utf-8", errors="replace")
                soup = BeautifulSoup(content, "html.parser")
                tags = soup.find_all(BLOCK_TAGS) if self.legacy else _top_level_blocks(soup)

                for tag_idx, new_html in item_updates[item.get_id()]:
                    if tag_idx < len(tags):
                        old_tag = tags[tag_idx]
                        try:
                            new_soup = BeautifulSoup(new_html, "html.parser")
                            new_element = new_soup.find(old_tag.name)
                            if not new_element:
                                raise ValueError("Translated block has the wrong tag")
                            inline_tags = ["a", "span", "i", "em", "b", "strong", "u", "sup", "sub", "code"]
                            original_inline = old_tag.find_all(inline_tags)
                            translated_inline = new_element.find_all(inline_tags)
                            if len(original_inline) == len(translated_inline):
                                for source_inline, target_inline in zip(original_inline, translated_inline):
                                    if source_inline.name == target_inline.name:
                                        target_inline.attrs = copy.deepcopy(source_inline.attrs)
                            # Keep the exact source element and its EPUB attributes;
                            # replace only its children with the validated translation.
                            old_tag.clear()
                            for child in list(new_element.contents):
                                old_tag.append(child)
                        except Exception:
                            plain_text = BeautifulSoup(new_html, "html.parser").get_text()
                            old_tag.string = plain_text

                item.set_content(str(soup).encode("utf-8"))

        epub.write_epub(str(output_path), out_book, {})
