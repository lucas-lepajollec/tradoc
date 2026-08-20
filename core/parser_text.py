from pathlib import Path
import html
import re
from typing import List, Tuple, Dict, Any
from bs4 import BeautifulSoup

class TextParser:
    def __init__(
        self,
        text_path: Path,
        legacy: bool = False,
        normalize_fenced_headings: bool = True,
        strip_converter_fences: bool = False,
    ):
        self.text_path = text_path
        self.raw_content = text_path.read_text(encoding="utf-8", errors="replace")
        self.is_markdown = text_path.suffix.lower() == ".md"
        self.legacy = legacy
        self.normalize_fenced_headings = normalize_fenced_headings
        self.strip_converter_fences = strip_converter_fences
        self.converter_fence_mode = (
            strip_converter_fences and self._looks_like_converter_markdown()
        )

    @staticmethod
    def _inline_markdown_to_html(value: str) -> str:
        escaped = html.escape(value)
        escaped = re.sub(r"`([^`\n]+)`", r"<code>\1</code>", escaped)
        return escaped.replace("\n", "<br/>")

    def _split_blocks(self) -> List[str]:
        if not self.is_markdown:
            return [block.strip() for block in re.split(r"\n\s*\n", self.raw_content) if block.strip()]

        blocks: List[str] = []
        current: List[str] = []
        fence_marker: str | None = None

        def flush() -> None:
            nonlocal current
            if current and any(line.strip() for line in current):
                blocks.append("\n".join(current).strip())
            current = []

        for line in self.raw_content.splitlines():
            stripped = line.strip()
            if fence_marker:
                current.append(line)
                if re.fullmatch(rf"{re.escape(fence_marker)}\s*", stripped):
                    flush()
                    fence_marker = None
                continue

            opener = re.match(r"^\s*(`{3,}|~{3,})(?:[^`]*)$", line)
            if opener:
                flush()
                fence_marker = opener.group(1)
                current.append(line)
            elif not stripped:
                flush()
            else:
                current.append(line)
        flush()
        return blocks

    def _looks_like_converter_markdown(self) -> bool:
        """Detect documents where a converter wrapped ordinary prose in fences."""
        if not self.is_markdown:
            return False
        blocks = self._split_blocks()
        if len(blocks) < 8:
            return False
        unlabelled_fences = 0
        for block in blocks:
            lines = block.splitlines()
            if (
                len(lines) >= 3
                and re.fullmatch(r"\s*(`{3,}|~{3,})\s*", lines[0])
                and re.fullmatch(rf"\s*{re.escape(lines[0].strip())}\s*", lines[-1])
            ):
                unlabelled_fences += 1
        return unlabelled_fences >= 8 and unlabelled_fences / len(blocks) >= 0.35

    def _extract_legacy_nodes(self) -> Tuple[List[Dict[str, Any]], List[str]]:
        node_meta: List[Dict[str, Any]] = []
        node_texts: List[str] = []
        current_block: List[str] = []
        block_idx = 0

        def flush_block() -> None:
            nonlocal block_idx, current_block
            if not current_block:
                return
            block_str = "\n".join(current_block).strip()
            current_block = []
            if not block_str:
                return
            heading = re.match(r"^(#{1,6})\s+(.+)$", block_str, flags=re.DOTALL) if self.is_markdown else None
            tag_name = f"h{len(heading.group(1))}" if heading else "p"
            inner = heading.group(2).strip() if heading else block_str
            html_node = f"<{tag_name}>{html.escape(inner).replace(chr(10), '<br/>')}</{tag_name}>"
            node_meta.append({"block_idx": block_idx, "tag_name": tag_name, "original_html": html_node})
            node_texts.append(html_node)
            block_idx += 1

        for line in self.raw_content.splitlines():
            if not line.strip():
                flush_block()
            else:
                current_block.append(line)
        flush_block()
        return node_meta, node_texts

    def extract_nodes(self) -> Tuple[List[Dict[str, Any]], List[str]]:
        """
        Parses Markdown or plain text into paragraph and header HTML blocks.
        Returns:
        - node_meta: metadata tracking block index and tag type
        - node_texts: list of paragraph HTML strings (<p>...</p>, <h1>...</h1>, etc.)
        """
        if self.legacy:
            return self._extract_legacy_nodes()

        node_meta: List[Dict[str, Any]] = []
        node_texts: List[str] = []
        for block_idx, block in enumerate(self._split_blocks()):
            lines = block.splitlines()
            fence = re.match(r"^\s*(`{3,}|~{3,})(.*)$", lines[0]) if self.is_markdown and lines else None
            if fence and len(lines) >= 2 and re.fullmatch(rf"\s*{re.escape(fence.group(1))}\s*", lines[-1]):
                fence_info = fence.group(2).strip()
                inner_lines = [line.strip() for line in lines[1:-1] if line.strip()]
                chapter_lines = [
                    line
                    for line in inner_lines
                    if re.fullmatch(r"(?i)CHAPTER\s+\d+\s*:\s*.+", line)
                ]
                if (
                    self.normalize_fenced_headings
                    and not fence_info
                    and len(chapter_lines) > 1
                    and len(chapter_lines) == len(inner_lines)
                ):
                    # PDF-to-Markdown converters sometimes wrap several distinct
                    # TOC headings in one unlabelled code fence. Treating that
                    # fence as one paragraph hides many logical lines from the
                    # chunker and makes the LLM merge block boundaries.
                    for line_pos, chapter_line in enumerate(chapter_lines):
                        html_node = f"<p>{self._inline_markdown_to_html(chapter_line)}</p>"
                        node_meta.append({
                            "block_idx": len(node_meta),
                            "kind": "fence_heading_line",
                            "tag_name": "p",
                            "original_html": html_node,
                            "fence_open": lines[0].strip(),
                            "fence_close": lines[-1].strip(),
                            "fence_group": block_idx,
                            "fence_pos": line_pos,
                            "fence_count": len(chapter_lines),
                            "suppress_fence": self.converter_fence_mode,
                        })
                        node_texts.append(html_node)
                    continue

            kind = "paragraph"
            tag_name = "p"
            inner = block
            meta: Dict[str, Any] = {"block_idx": len(node_meta)}

            if fence and len(lines) >= 2 and re.fullmatch(rf"\s*{re.escape(fence.group(1))}\s*", lines[-1]):
                kind = "fence"
                fence_info = fence.group(2).strip()
                raw_inner = "\n".join(lines[1:-1]).strip()
                # Unlabelled fences are commonly emitted by PDF-to-Markdown tools
                # around ordinary prose. Their physical line wrapping is not
                # semantic and must not become a strict sequence of <br> tags.
                inner = raw_inner if fence_info else re.sub(r"\s*\n\s*", " ", raw_inner)
                meta.update({
                    "fence_open": lines[0].strip(),
                    "fence_close": lines[-1].strip(),
                    "fence_info": fence_info,
                    "suppress_fence": (
                        self.converter_fence_mode
                        and not fence_info
                    ),
                })
            else:
                heading = re.match(r"^(#{1,6})\s+(.+)$", block, flags=re.DOTALL) if self.is_markdown else None
                list_item = re.match(r"^(\s*(?:[-+*]|\d+[.)])\s+)(.+)$", block, flags=re.DOTALL) if self.is_markdown else None
                quote = self.is_markdown and all(not line.strip() or re.match(r"^\s*>\s?", line) for line in lines)
                if heading:
                    kind = "heading"
                    tag_name = f"h{len(heading.group(1))}"
                    inner = heading.group(2).strip()
                elif list_item:
                    kind = "list_item"
                    tag_name = "li"
                    meta["marker"] = list_item.group(1)
                    inner = list_item.group(2).strip()
                    wrapped_code = re.fullmatch(r"`([^`\n]+)`", inner)
                    if wrapped_code:
                        # Keep Markdown punctuation outside of the LLM payload so
                        # a translation model cannot turn backticks into quotes.
                        meta["code_wrapper"] = "`"
                        inner = wrapped_code.group(1)
                elif quote:
                    kind = "blockquote"
                    tag_name = "blockquote"
                    inner = "\n".join(re.sub(r"^\s*>\s?", "", line) for line in lines)

            if self.is_markdown and kind != "fence" and "code_wrapper" not in meta:
                wrapped_code = re.fullmatch(r"`([^`\n]+)`", inner)
                if wrapped_code:
                    meta["code_wrapper"] = "`"
                    inner = wrapped_code.group(1)

            html_node = f"<{tag_name}>{self._inline_markdown_to_html(inner)}</{tag_name}>"
            meta.update({"kind": kind, "tag_name": tag_name, "original_html": html_node})
            node_meta.append(meta)
            node_texts.append(html_node)
        return node_meta, node_texts

    @staticmethod
    def _translated_text(trans_html: str) -> str:
        soup = BeautifulSoup(trans_html, "html.parser")
        for line_break in soup.find_all("br"):
            line_break.replace_with("\n")
        for code in soup.find_all("code"):
            code.replace_with(f"`{code.get_text()}`")
        return soup.get_text("").strip()

    def reconstruct_text(self, node_meta: List[Dict[str, Any]], translated_nodes: List[str], output_path: Path):
        """
        Reconstructs Markdown or plain text output from translated HTML nodes.
        """
        output_blocks = []
        for meta, trans_html in zip(node_meta, translated_nodes):
            if not trans_html or not trans_html.strip():
                continue
            tag_name = meta["tag_name"]
            text_val = self._translated_text(trans_html)
            if not text_val:
                continue

            kind = meta.get("kind")
            wrapper = meta.get("code_wrapper", "")
            rendered_text = f"{wrapper}{text_val}{wrapper}"
            if self.is_markdown and kind == "fence_heading_line":
                if meta.get("suppress_fence"):
                    output_blocks.append(rendered_text)
                elif meta.get("fence_pos") == 0:
                    output_blocks.append(f"{meta.get('fence_open', '```')}\n{rendered_text}")
                else:
                    output_blocks[-1] += f"\n{rendered_text}"
                if (
                    not meta.get("suppress_fence")
                    and meta.get("fence_pos") == meta.get("fence_count", 1) - 1
                ):
                    output_blocks[-1] += f"\n{meta.get('fence_close', '```')}"
            elif self.is_markdown and kind == "fence":
                if meta.get("suppress_fence"):
                    output_blocks.append(text_val)
                else:
                    output_blocks.append(f"{meta.get('fence_open', '```')}\n{text_val}\n{meta.get('fence_close', '```')}")
            elif self.is_markdown and kind == "list_item":
                output_blocks.append(f"{meta.get('marker', '- ')}{rendered_text}")
            elif self.is_markdown and kind == "blockquote":
                output_blocks.append("\n".join(f"> {line}" if line else ">" for line in rendered_text.splitlines()))
            elif self.is_markdown and re.fullmatch(r"h[1-6]", tag_name):
                output_blocks.append(f"{'#' * int(tag_name[1])} {rendered_text}")
            else:
                output_blocks.append(rendered_text)

        final_content = "\n\n".join(output_blocks) + "\n"
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(final_content, encoding="utf-8")
