import re
from typing import List, Dict, Any
from pydantic import BaseModel

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
    def __init__(self, target_chunk_tokens: int = 1400, max_chunk_tokens: int = 1800, max_nodes_per_chunk: int = 35):
        self.target_chunk_tokens = target_chunk_tokens
        self.max_chunk_tokens = max_chunk_tokens
        self.max_nodes_per_chunk = max_nodes_per_chunk

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

        for idx, node in enumerate(nodes):
            node_clean = node.strip()
            if not node_clean:
                continue

            node_tokens = estimate_tokens(node_clean)

            # If a single node is already huge (e.g., giant paragraph > max_tokens)
            if node_tokens > self.max_chunk_tokens and not current_nodes:
                chunks.append(SegmentChunk(
                    index=chunk_counter,
                    text=node_clean,
                    token_estimate=node_tokens,
                    node_indices=[idx]
                ))
                chunk_counter += 1
                continue

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
