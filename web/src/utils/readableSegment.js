export function readableSegment(text = '') {
  const source = String(text);
  const lower = source.toLowerCase();
  let plain = '';
  let cursor = 0;

  while (cursor < source.length) {
    if (source[cursor] !== '<') {
      plain += source[cursor];
      cursor += 1;
      continue;
    }

    const tagEnd = source.indexOf('>', cursor + 1);
    if (tagEnd === -1) {
      plain += source.slice(cursor);
      break;
    }

    const tag = lower.slice(cursor + 1, tagEnd).trim();
    const blocked = tag.startsWith('script') ? 'script' : tag.startsWith('style') ? 'style' : '';
    if (blocked) {
      const closing = lower.indexOf(`</${blocked}`, tagEnd + 1);
      if (closing === -1) break;
      const closingEnd = source.indexOf('>', closing + blocked.length + 2);
      cursor = closingEnd === -1 ? source.length : closingEnd + 1;
      continue;
    }

    plain += ' ';
    cursor = tagEnd + 1;
  }

  return plain
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n\s+/g, '\n')
    .trim();
}
