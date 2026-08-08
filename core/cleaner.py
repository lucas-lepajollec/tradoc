import re
from bs4 import BeautifulSoup


BLOCK_TAGS = ("p", "h1", "h2", "h3", "h4", "h5", "h6", "li", "blockquote", "caption", "figcaption")
INLINE_TAGS = {"a", "b", "strong", "i", "em", "u", "s", "span", "br", "sup", "sub", "code"}
ALLOWED_TAGS = set(BLOCK_TAGS) | INLINE_TAGS


class StructureValidationError(ValueError):
    """Raised when a model response cannot map safely back to source nodes."""

def simplify_html_for_prompt(raw_html: str) -> str:
    """
    Strips bloated HTML attributes (href, class, id, style) from prompt string before sending to LLM.
    Reduces token count by up to 80% while retaining structural text tags (<p>, <a>, <i>, <em>, <b>, <strong>).
    Original attributes are preserved when rebuilding the final EPUB document.
    """
    if not raw_html or "<" not in raw_html:
        return raw_html

    try:
        soup = BeautifulSoup(raw_html, "html.parser")
        for tag in soup.find_all(True):
            tag.attrs = {}
        return str(soup)
    except Exception:
        # Regex fallback to remove class, href, id attributes
        clean = re.sub(r'\s+(?:class|href|id|style|data-[a-z0-9-]+)="[^"]*"', '', raw_html, flags=re.IGNORECASE)
        return clean


def clean_llm_response(raw_text: str) -> str:
    """
    Cleans raw LLM outputs:
    1. Removes reasoning/thinking tags (<think>...</think>, <thought>...</thought>, [THINKING]...[/THINKING]).
    2. Strips markdown code block wrappers (```html ... ``` or ``` ... ```).
    3. Trims extraneous leading/trailing whitespace.
    """
    if not raw_text:
        return ""

    text = raw_text

    # 1. Remove <think>...</think> and <thought>...</thought> (case insensitive, multi-line)
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<thought>.*?</thought>", "", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"\[THINKING\].*?\[/THINKING\]", "", text, flags=re.DOTALL | re.IGNORECASE)
    
    # Unclosed <think> tag safety fallback
    if "<think>" in text.lower():
        # If HTML blocks exist after or before <think>, extract HTML blocks directly
        html_blocks = re.findall(r'<(?:p|h[1-6]|li|blockquote|caption|figcaption)[^>]*>.*?</(?:p|h[1-6]|li|blockquote|caption|figcaption)>', text, re.DOTALL | re.IGNORECASE)
        if html_blocks:
            text = "\n".join(html_blocks)
        else:
            parts = re.split(r"<think>", text, flags=re.IGNORECASE)
            text = parts[0] if parts[0].strip() else parts[-1]
            text = text.replace("<think>", "").replace("</think>", "")

    # 2. Strip Markdown code fences if the model returned ```html ... ```
    code_fence_pattern = r"^```(?:html|xml|markdown)?\s*\n?(.*?)\n?```$"
    match = re.search(code_fence_pattern, text.strip(), re.DOTALL | re.IGNORECASE)
    if match:
        text = match.group(1)

    text = re.sub(r"^```(?:html|xml)?", "", text.strip())
    text = re.sub(r"```$", "", text.strip())

    return text.strip()

def deduplicate_sentences_in_text(text: str) -> str:
    """
    Removes consecutive duplicate sentences or phrases within text blocks (eliminates LLM stuttering).
    Also aggressively clears out repeating stub words or stutter loops (e.g., CHAP CHAP CHAP).
    """
    if not text:
        return text

    # Phase 1: Clean out tight repeating single word loops (e.g., "CHAP CHAP CHAP" or "CHAP\nCHAP\nCHAP")
    # This matches any word/stub repeating 3 or more times consecutively with optional spaces/newlines
    for stub_match in re.finditer(r'\b([a-zA-Z]{3,15})\b(?:\s+|\n+)\1\b(?:\s+|\n+)\1\b', text, re.IGNORECASE):
        stub = stub_match.group(1)
        # Replace the entire sequence of repeats with just a single occurrence of the stub
        pattern = r'\b' + re.escape(stub) + r'\b(?:\s+|\n+|\b' + re.escape(stub) + r'\b)*'
        text = re.sub(pattern, stub + "\n", text, flags=re.IGNORECASE)

    # Phase 2: Standard sentence level deduplication
    sentences = re.split(r'((?<=[.!?])\s+|\n+)', text)
    cleaned_sentences = []
    last_pure_sentence = ""

    for item in sentences:
        pure = re.sub(r'<[^>]*>', '', item).strip().lower()
        pure_norm = re.sub(r'\s+', ' ', pure)
        
        # Avoid duplicate sentences (length > 6 to protect very short items like "Oui." or "Non.")
        if pure_norm and len(pure_norm) > 6 and pure_norm == last_pure_sentence:
            continue
        
        cleaned_sentences.append(item)
        if pure_norm and len(pure_norm) > 6:
            last_pure_sentence = pure_norm

    return "".join(cleaned_sentences)

def deduplicate_consecutive_paragraphs(html_text: str) -> str:
    """
    Collapses consecutive duplicated paragraphs, headings, and sentences.
    """
    if not html_text:
        return html_text

    text_sentences_cleared = deduplicate_sentences_in_text(html_text)

    # Clean consecutive duplicate lines/paragraphs before parsing tags
    lines = text_sentences_cleared.split("\n")
    cleaned_lines = []
    last_line_norm = ""
    for line in lines:
        clean_line = line.strip()
        pure_line = re.sub(r'<[^>]*>', '', clean_line).strip()
        line_norm = re.sub(r'\s+', ' ', pure_line.lower())
        
        # Filter repeats of significant lines (length > 6)
        if line_norm and len(line_norm) > 6 and line_norm == last_line_norm:
            continue
        cleaned_lines.append(line)
        if line_norm and len(line_norm) > 6:
            last_line_norm = line_norm
            
    text_sentences_cleared = "\n".join(cleaned_lines)

    if "</p>" not in text_sentences_cleared:
        return text_sentences_cleared

    parts = text_sentences_cleared.split("</p>")
    new_parts = []
    last_clean = None

    for part in parts:
        clean_part = part.strip()
        if not clean_part:
            if part == parts[-1]:
                new_parts.append(part)
            continue
        
        pure_text = re.sub(r'<[^>]*>', '', clean_part).strip()
        pure_norm = re.sub(r'\s+', ' ', pure_text.lower())

        # Filter paragraph repeats
        if pure_norm and len(pure_norm) > 6 and pure_norm == last_clean:
            continue
        
        new_parts.append(part)
        if pure_norm and len(pure_norm) > 6:
            last_clean = pure_norm
            
    return "</p>".join(new_parts)

def verify_and_repair_html(original_html: str, translated_text: str) -> str:
    """
    Ensures that essential HTML structures (<p>, <i>, <em>, <b>, <strong>) present
    in original text are preserved or properly closed in translated output.
    Also handles paragraph deduplication.
    """
    cleaned = clean_llm_response(translated_text)
    if not cleaned:
        raise StructureValidationError("La réponse du modèle est vide.")

    if "<" not in original_html and ">" not in original_html:
        return cleaned

    source_blocks = extract_html_blocks(original_html)
    translated_blocks = extract_html_blocks(cleaned)
    if len(source_blocks) != len(translated_blocks):
        raise StructureValidationError(
            f"Structure invalide: {len(source_blocks)} bloc(s) source, "
            f"{len(translated_blocks)} bloc(s) reçu(s)."
        )

    repaired: list[str] = []
    for index, (source_block, translated_block) in enumerate(zip(source_blocks, translated_blocks), start=1):
        source_tag = BeautifulSoup(source_block, "html.parser").find(BLOCK_TAGS)
        translated_tag = BeautifulSoup(translated_block, "html.parser").find(BLOCK_TAGS)
        if not source_tag or not translated_tag or source_tag.name != translated_tag.name:
            actual = translated_tag.name if translated_tag else "aucun"
            expected = source_tag.name if source_tag else "inconnu"
            raise StructureValidationError(
                f"Structure invalide au bloc {index}: balise <{expected}> attendue, <{actual}> reçue."
            )
        source_inline = [tag.name for tag in source_tag.find_all(INLINE_TAGS)]
        translated_inline = [tag.name for tag in translated_tag.find_all(INLINE_TAGS)]
        if source_inline != translated_inline:
            raise StructureValidationError(
                f"Structure inline invalide au bloc {index}: {source_inline} attendu, {translated_inline} reçu."
            )

        # The source document owns attributes. Model-generated attributes, scripts and
        # event handlers must never be injected into EPUB/DOCX output.
        translated_tag.attrs = {}
        for tag in list(translated_tag.find_all(True)):
            if tag.name not in ALLOWED_TAGS:
                tag.unwrap()
                continue
            tag.attrs = {}
        repaired.append(str(translated_tag))

    return "\n".join(repaired)


def extract_html_blocks(html_text: str) -> list[str]:
    """Return only top-level translatable blocks, excluding nested duplicates."""
    soup = BeautifulSoup(html_text or "", "html.parser")
    for dangerous in soup.find_all(["script", "style", "iframe", "object", "embed"]):
        dangerous.decompose()
    blocks = []
    for tag in soup.find_all(BLOCK_TAGS):
        if tag.find_parent(BLOCK_TAGS) is None:
            blocks.append(str(tag))
    return blocks
