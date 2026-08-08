import re
from typing import List, Optional
from pydantic import BaseModel
from bs4 import BeautifulSoup

class SegmentChunk(BaseModel):
    index: int
    text: str
    token_estimate: int
    node_indices: List[int]

def estimate_tokens(text: str) -> int:
    """Estimates token count (approx 3.5 - 4 chars per token for French/English)."""
    if not text:
        return 0
    words = len(text.split())
    chars = len(text)
    return max(int(chars / 3.8), int(words * 1.3))

class SemanticChunker:
    def __init__(self, target_chunk_tokens: int = 1400, max_chunk_tokens: Optional[int] = None, max_nodes_per_chunk: int = 35):
        self.target_chunk_tokens = target_chunk_tokens
        self.max_chunk_tokens = max_chunk_tokens or max(target_chunk_tokens, int(target_chunk_tokens * 1.15))
        self.max_nodes_per_chunk = max_nodes_per_chunk

    def _split_oversized_node(self, node: str) -> List[str]:
        """Split a giant single paragraph while keeping a valid outer block tag."""
        soup = BeautifulSoup(node, "html.parser")
        outer = soup.find(["p", "h1", "h2", "h3", "h4", "h5", "h6", "li", "blockquote", "caption", "figcaption"])
        tag_name = outer.name if outer else "p"
        plain_text = outer.get_text(" ", strip=True) if outer else node.strip()
        if not plain_text:
            return [node]

        sentences = [part.strip() for part in re.split(r"(?<=[.!?…])\s+|\n+", plain_text) if part.strip()]
        if not sentences:
            sentences = plain_text.split()

        fragments: List[str] = []
        current: List[str] = []
        for sentence in sentences:
            if estimate_tokens(sentence) > self.max_chunk_tokens:
                words = sentence.split()
                while words:
                    piece: List[str] = []
                    while words and estimate_tokens(" ".join(piece + [words[0]])) <= self.max_chunk_tokens:
                        piece.append(words.pop(0))
                    if not piece:
                        piece.append(words.pop(0))
                    if current:
                        fragments.append(f"<{tag_name}>{' '.join(current)}</{tag_name}>")
                        current = []
                    fragments.append(f"<{tag_name}>{' '.join(piece)}</{tag_name}>")
                continue

            candidate = " ".join(current + [sentence])
            if current and estimate_tokens(candidate) > self.max_chunk_tokens:
                fragments.append(f"<{tag_name}>{' '.join(current)}</{tag_name}>")
                current = [sentence]
            else:
                current.append(sentence)
        if current:
            fragments.append(f"<{tag_name}>{' '.join(current)}</{tag_name}>")
        return fragments or [node]

    def create_chunks(self, nodes: List[str]) -> List[SegmentChunk]:
        """
        Groups list of HTML/text nodes into balanced semantic chunks.
        Preserves individual node boundaries so HTML structure remains intact.
        Caps max node count per chunk to prevent prompt pattern repetition loops on short lists.
        """
        chunks: List[SegmentChunk] = []
        current_nodes: List[str] = []
        current_node_indices: List[int] = []
        current_tokens = 0
        chunk_counter = 0

        expanded_nodes = []
        for idx, node in enumerate(nodes):
            node_clean = node.strip()
            if not node_clean:
                continue
            if estimate_tokens(node_clean) > self.max_chunk_tokens:
                expanded_nodes.extend((idx, part) for part in self._split_oversized_node(node_clean))
            else:
                expanded_nodes.append((idx, node_clean))

        for idx, node_clean in expanded_nodes:
            node_tokens = estimate_tokens(node_clean)

            # If adding this node exceeds target token window OR exceeds max node count per chunk
            exceeds_tokens = (current_tokens + node_tokens > self.target_chunk_tokens)
            exceeds_nodes = (len(current_nodes) >= self.max_nodes_per_chunk)

            if (exceeds_tokens or exceeds_nodes) and current_nodes:
                chunks.append(SegmentChunk(
                    index=chunk_counter,
                    text="\n\n".join(current_nodes),
                    token_estimate=current_tokens,
                    node_indices=list(current_node_indices)
                ))
                chunk_counter += 1
                current_nodes = [node_clean]
                current_node_indices = [idx]
                current_tokens = node_tokens
            else:
                current_nodes.append(node_clean)
                current_node_indices.append(idx)
                current_tokens += node_tokens

        # Flush remaining nodes
        if current_nodes:
            chunks.append(SegmentChunk(
                index=chunk_counter,
                text="\n\n".join(current_nodes),
                token_estimate=current_tokens,
                node_indices=list(current_node_indices)
            ))

        return chunks
