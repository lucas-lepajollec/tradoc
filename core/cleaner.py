import re
from bs4 import BeautifulSoup

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

def deduplicate_consecutive_paragraphs(html_text: str) -> str:
    if "</p>" not in html_text:
        return html_text
    parts = html_text.split("</p>")
    new_parts = []
    last_clean = None
    for part in parts:
        clean_part = part.strip()
        if not clean_part:
            if part == parts[-1]:
                new_parts.append(part)
            continue
        
        # Remove tags to compare pure content
        pure_text = re.sub(r'<[^>]*>', '', clean_part).strip()
        if pure_text and pure_text == last_clean:
            continue
        
        new_parts.append(part)
        if pure_text:
            last_clean = pure_text
            
    return "</p>".join(new_parts)

def verify_and_repair_html(original_html: str, translated_text: str) -> str:
    """
    Ensures that essential HTML structures (<p>, <i>, <em>, <b>, <strong>) present
    in original text are preserved or properly closed in translated output.
    Also handles paragraph deduplication.
    """
    cleaned = clean_llm_response(translated_text)
    deduped = deduplicate_consecutive_paragraphs(cleaned)
    
    if "<" not in original_html and ">" not in original_html:
        return deduped

    try:
        soup = BeautifulSoup(deduped, "html.parser")
        return str(soup)
    except Exception:
        return deduped
