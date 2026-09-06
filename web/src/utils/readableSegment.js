export function readableSegment(text = '') {
  const documentFragment = new DOMParser().parseFromString(String(text), 'text/html');
  documentFragment.querySelectorAll('script, style').forEach((node) => node.remove());
  return (documentFragment.body.textContent || '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n\s+/g, '\n')
    .trim();
}
