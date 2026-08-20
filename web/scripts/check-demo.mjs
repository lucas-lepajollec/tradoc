import assert from 'node:assert/strict';

import { getDemoDownload, request, resetDemo } from '../src/demo/api.js';

resetDemo();

const jobs = await request('/jobs');
assert.equal(jobs.length, 2);
assert.equal(jobs[0].status, 'COMPLETED');
assert.equal(jobs[1].status, 'PAUSED');

const detail = await request('/jobs/demo-northanger');
assert.equal(detail.file_type, 'md');
assert.equal(detail.completed_chunks, detail.total_chunks);

const segments = await request('/jobs/demo-voyage/segments');
assert.equal(segments.length, 8);
assert.equal(segments.filter((segment) => segment.status === 'DONE').length, 5);

const connection = await request('/settings/test-connection', {
  method: 'POST',
  body: JSON.stringify({ api_type: 'openai' }),
});
assert.equal(connection.success, true);
assert.ok(connection.models.includes('demo-literary-model'));

const sandbox = await request('/settings/test-translation', {
  method: 'POST',
  body: JSON.stringify({
    model: 'demo-literary-model',
    text: '<p>It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.</p>\n\n<p>However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered the rightful property of some one or other of their daughters.</p>',
  }),
});
assert.match(sandbox.translated_text, /Il est une vérité universellement reconnue/);
assert.match(sandbox.translated_text, /Si peu que l’on connaisse les sentiments/);
assert.doesNotMatch(sandbox.translated_text, /single man|However little known/);

const glossaries = await request('/glossaries');
assert.deepEqual(glossaries, ['regency_fiction', 'lunar_voyage']);

for (const [extension, mime] of [
  ['pdf', 'application/pdf'],
  ['epub', 'application/epub+zip'],
  ['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ['md', 'text/markdown'],
  ['txt', 'text/plain'],
]) {
  const upload = new FormData();
  const original = new Blob([`demo-${extension}-source`], { type: mime });
  upload.append('file', original, `Browser sample.${extension}`);
  const uploadedJob = await request('/jobs/upload', { method: 'POST', body: upload });
  const exported = getDemoDownload(uploadedJob.id);
  assert.equal(exported.filename, `demo-output-Browser sample.${extension}`);
  assert.equal(exported.blob.type, mime);
  assert.equal(await exported.blob.text(), await original.text());
}

await request('/jobs/demo-voyage/start', { method: 'POST', body: new FormData() });
assert.equal((await request('/jobs/demo-voyage')).status, 'PROCESSING');

console.log('TraDoc demo fixtures and simulated API routes are valid.');
