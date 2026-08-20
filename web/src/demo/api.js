const now = () => new Date().toISOString();
const clone = (value) => structuredClone(value);

const listeners = new Set();
const sourceFiles = new Map();

const initialJobs = [
  {
    id: 'demo-northanger',
    file_name: 'Northanger Abbey — Sample.md',
    file_type: 'md',
    source_lang: 'en',
    target_lang: 'fr',
    model: 'demo-literary-model',
    status: 'COMPLETED',
    total_chunks: 6,
    completed_chunks: 6,
    glossary_name: 'regency_fiction',
    temperature: 0.15,
    concurrency: 4,
    chunk_size: 1200,
    job_type: 'translation',
    api_type: 'demo',
    endpoint: null,
    enable_proofreading: true,
    enable_prompt_caching: false,
    created_at: '2026-08-18T09:30:00.000Z',
    completed_at: '2026-08-18T09:34:18.000Z',
  },
  {
    id: 'demo-voyage',
    file_name: 'A Voyage to the Moon — Sample.txt',
    file_type: 'txt',
    source_lang: 'en',
    target_lang: 'fr',
    model: 'demo-literary-model',
    status: 'PAUSED',
    total_chunks: 8,
    completed_chunks: 5,
    glossary_name: 'lunar_voyage',
    temperature: 0.2,
    concurrency: 3,
    chunk_size: 1000,
    job_type: 'translation',
    api_type: 'demo',
    endpoint: null,
    enable_proofreading: false,
    enable_prompt_caching: false,
    created_at: '2026-08-19T14:12:00.000Z',
    completed_at: null,
  },
];

const makeSegment = (jobId, chunkIndex, original, translated, status = 'DONE') => ({
  id: chunkIndex + 1,
  job_id: jobId,
  chunk_index: chunkIndex,
  original_text: original,
  translated_text: translated,
  status,
  error_message: null,
  node_indices: [chunkIndex],
  tokens_est: Math.max(18, Math.round(original.length / 4)),
  updated_at: now(),
});

const initialSegments = {
  'demo-northanger': [
    makeSegment('demo-northanger', 0, '<h1>Chapter I</h1>', '<h1>Chapitre I</h1>'),
    makeSegment('demo-northanger', 1, 'No one who had ever seen Catherine Morland in her infancy would have supposed her born to be an heroine.', 'Quiconque avait connu Catherine Morland dans son enfance n’aurait jamais supposé qu’elle fût née pour devenir une héroïne.'),
    makeSegment('demo-northanger', 2, 'Her situation in life, the character of her father and mother, her own person and disposition, were all equally against her.', 'Sa condition, le caractère de son père et de sa mère, sa personne même et ses dispositions semblaient également s’y opposer.'),
    makeSegment('demo-northanger', 3, 'She had a thin awkward figure, a sallow skin without colour, dark lank hair, and strong features.', 'Elle avait une silhouette maigre et gauche, un teint pâle sans couleur, des cheveux sombres et plats, et des traits marqués.'),
    makeSegment('demo-northanger', 4, 'But from fifteen to seventeen she was in training for a heroine.', 'Mais de quinze à dix-sept ans, elle se formait peu à peu au destin d’une héroïne.'),
    makeSegment('demo-northanger', 5, '<p>She began to curl her hair and long for balls.</p>', '<p>Elle commença à boucler ses cheveux et à rêver de bals.</p>'),
  ],
  'demo-voyage': [
    makeSegment('demo-voyage', 0, '<h1>A Voyage to the Moon</h1>', '<h1>Voyage vers la Lune</h1>'),
    makeSegment('demo-voyage', 1, 'The observatory dome opened above us.', 'La coupole de l’observatoire s’ouvrit au-dessus de nous.'),
    makeSegment('demo-voyage', 2, 'Beyond the glass, the Moon filled half the sky.', 'Au-delà de la verrière, la Lune occupait la moitié du ciel.'),
    makeSegment('demo-voyage', 3, 'Every instrument trembled as the engines awakened.', 'Chaque instrument trembla lorsque les moteurs s’éveillèrent.'),
    makeSegment('demo-voyage', 4, 'We left the blue world behind without a word.', 'Nous laissâmes le monde bleu derrière nous sans un mot.'),
    makeSegment('demo-voyage', 5, 'The silence of space surrounded the vessel.', null, 'PENDING'),
    makeSegment('demo-voyage', 6, 'A silver horizon rose ahead.', null, 'PENDING'),
    makeSegment('demo-voyage', 7, 'Our descent would begin at dawn.', null, 'PENDING'),
  ],
};

const initialGlossaries = {
  regency_fiction: {
    name: 'regency_fiction',
    description: 'Names and period-specific expressions for the sample novel.',
    items: [
      { source: 'Catherine Morland', target: 'Catherine Morland', category: 'name', note: 'Keep unchanged' },
      { source: 'heroine', target: 'héroïne', category: 'general', note: 'Literary register' },
      { source: 'ball', target: 'bal', category: 'general', note: 'Social event' },
    ],
  },
  lunar_voyage: {
    name: 'lunar_voyage',
    description: 'Terminology for the fictional lunar expedition.',
    items: [
      { source: 'Moon', target: 'Lune', category: 'place', note: 'Capitalize in astronomical context' },
      { source: 'observatory dome', target: 'coupole de l’observatoire', category: 'general', note: '' },
    ],
  },
};

let jobs = clone(initialJobs);
let segments = clone(initialSegments);
let glossaries = clone(initialGlossaries);

const emit = (type, jobId) => {
  listeners.forEach((listener) => listener({ type, job_id: jobId, demo: true }));
};

const findJob = (jobId) => {
  const job = jobs.find((item) => item.id === jobId);
  if (!job) throw new Error('Demo project not found.');
  return job;
};

const completeJob = (jobId) => {
  const job = findJob(jobId);
  const jobSegments = segments[jobId] || [];
  jobSegments.forEach((segment) => {
    if (segment.status !== 'DONE') {
      segment.status = 'DONE';
      segment.translated_text = {
        'The silence of space surrounded the vessel.': 'Le silence de l’espace enveloppait le vaisseau.',
        'A silver horizon rose ahead.': 'Un horizon d’argent se leva devant nous.',
        'Our descent would begin at dawn.': 'Notre descente commencerait à l’aube.',
      }[segment.original_text] || `[Demo translation] ${segment.original_text}`;
      segment.updated_at = now();
    }
  });
  job.status = 'COMPLETED';
  job.completed_chunks = job.total_chunks;
  job.completed_at = now();
  emit('job_completed', jobId);
};

export const resetDemo = () => {
  jobs = clone(initialJobs);
  segments = clone(initialSegments);
  glossaries = clone(initialGlossaries);
  sourceFiles.clear();
  emit('demo_reset', null);
};

export async function request(path, options = {}) {
  await new Promise((resolve) => setTimeout(resolve, 120));
  const method = (options.method || 'GET').toUpperCase();

  if (path === '/jobs' && method === 'GET') return clone(jobs);
  if (path === '/glossaries' && method === 'GET') return Object.keys(glossaries);
  if (path === '/settings/credentials' && method === 'GET') return {};
  if (path === '/settings/test-connection') {
    return {
      success: true,
      message: 'Interactive demo — fictional provider ready.',
      models: ['demo-literary-model', 'demo-proofreader'],
    };
  }
  if (path === '/settings/test-translation') {
    const payload = JSON.parse(options.body || '{}');
    const source = String(payload.text || '');
    const translated = source
      .replaceAll('CHAPTER I', 'CHAPITRE I')
      .replaceAll(
        'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.',
        'Il est une vérité universellement reconnue qu’un célibataire possédant une belle fortune doit éprouver le besoin de prendre femme.',
      )
      .replaceAll(
        'However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered the rightful property of some one or other of their daughters.',
        'Si peu que l’on connaisse les sentiments ou les intentions d’un tel homme lorsqu’il arrive dans le voisinage, cette vérité est si bien établie dans l’esprit des familles des environs qu’il est aussitôt considéré comme la propriété légitime de l’une ou l’autre de leurs filles.',
      )
      .replaceAll(
        '"My dear Mr. Bennet," said his lady to him one day, "have you heard that Netherfield Park is let at last?"',
        '« Mon cher monsieur Bennet, lui dit un jour son épouse, avez-vous appris que Netherfield Park est enfin loué ? »',
      )
      .replaceAll(
        'The fictional vessel crossed the silent lunar horizon.',
        'Le vaisseau fictif franchit l’horizon lunaire silencieux.',
      );
    return {
      original_text: source,
      translated_text: translated === source ? `[Demo translation]\n\n${source}` : translated,
      execution_time_ms: 184,
      model_used: payload.model || 'demo-literary-model',
    };
  }
  if (path === '/settings/sandbox-extract') {
    return {
      text: '<p>The fictional vessel crossed the silent lunar horizon.</p>',
      tokens: 14,
    };
  }
  if (path === '/settings/credentials' && method === 'POST') {
    return { message: 'Demo settings updated in this browser session.', metadata: {} };
  }

  if (path === '/jobs/upload' && method === 'POST') {
    const file = options.body?.get?.('file');
    const id = `demo-upload-${Date.now()}`;
    const fileName = file?.name || 'Browser sample.md';
    const job = {
      ...clone(initialJobs[1]),
      id,
      file_name: fileName,
      file_type: fileName.split('.').pop()?.toLowerCase() || 'md',
      source_lang: options.body?.get?.('source_lang') || 'en',
      target_lang: options.body?.get?.('target_lang') || 'fr',
      model: options.body?.get?.('model') || 'demo-literary-model',
      status: 'PENDING',
      total_chunks: 3,
      completed_chunks: 0,
      glossary_name: options.body?.get?.('glossary_name') || null,
      created_at: now(),
    };
    jobs.unshift(job);
    if (file instanceof Blob) sourceFiles.set(id, file);
    segments[id] = [
      makeSegment(id, 0, 'This browser-only sample never leaves your device.', null, 'PENDING'),
      makeSegment(id, 1, 'TraDoc preserves paragraphs, headings, and terminology.', null, 'PENDING'),
      makeSegment(id, 2, 'The public demo does not contact an AI provider.', null, 'PENDING'),
    ];
    emit('job_created', id);
    return clone(job);
  }

  const detailMatch = path.match(/^\/jobs\/([^/]+)$/);
  if (detailMatch && method === 'GET') return clone(findJob(decodeURIComponent(detailMatch[1])));
  if (detailMatch && method === 'DELETE') {
    const id = decodeURIComponent(detailMatch[1]);
    jobs = jobs.filter((item) => item.id !== id);
    delete segments[id];
    sourceFiles.delete(id);
    emit('job_deleted', id);
    return null;
  }

  const segmentsMatch = path.match(/^\/jobs\/([^/]+)\/segments$/);
  if (segmentsMatch) return clone(segments[decodeURIComponent(segmentsMatch[1])] || []);

  const actionMatch = path.match(/^\/jobs\/([^/]+)\/(start|pause|retry|update-config|clone-for-proofread)$/);
  if (actionMatch) {
    const id = decodeURIComponent(actionMatch[1]);
    const action = actionMatch[2];
    const job = findJob(id);
    if (action === 'pause') {
      job.status = 'PAUSED';
      emit('job_paused', id);
    } else if (action === 'update-config') {
      const body = options.body;
      if (body?.get?.('model')) job.model = body.get('model');
      if (body?.get?.('concurrency')) job.concurrency = Number(body.get('concurrency'));
      if (body?.get?.('temperature')) job.temperature = Number(body.get('temperature'));
    } else if (action === 'clone-for-proofread') {
      const cloneId = `demo-proofread-${Date.now()}`;
      const cloned = {
        ...clone(job),
        id: cloneId,
        file_name: `Proofread — ${job.file_name}`,
        job_type: 'proofreading',
        status: 'PENDING',
        completed_chunks: 0,
        completed_at: null,
        created_at: now(),
      };
      jobs.unshift(cloned);
      if (sourceFiles.has(id)) sourceFiles.set(cloneId, sourceFiles.get(id));
      segments[cloneId] = (segments[id] || []).map((segment, index) => ({
        ...clone(segment),
        id: index + 1,
        job_id: cloneId,
        status: 'PENDING',
        translated_text: null,
      }));
      emit('job_created', cloneId);
      return clone(cloned);
    } else {
      job.status = 'PROCESSING';
      emit('job_started', id);
      setTimeout(() => completeJob(id), 900);
    }
    return { message: `Demo action: ${action}`, job_id: id };
  }

  const glossaryMatch = path.match(/^\/glossaries\/([^/]+)$/);
  if (glossaryMatch && method === 'GET') {
    const glossary = glossaries[decodeURIComponent(glossaryMatch[1])];
    if (!glossary) throw new Error('Demo glossary not found.');
    return clone(glossary);
  }
  if (glossaryMatch && method === 'DELETE') {
    delete glossaries[decodeURIComponent(glossaryMatch[1])];
    return { message: 'Demo glossary deleted.' };
  }
  if (path === '/glossaries' && method === 'POST') {
    const glossary = JSON.parse(options.body || '{}');
    glossaries[glossary.name] = clone(glossary);
    return { message: 'Demo glossary saved.' };
  }

  throw new Error(`Unsupported demo action: ${method} ${path}`);
}

const MIME_TYPES = {
  epub: 'application/epub+zip',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  md: 'text/markdown;charset=utf-8',
  txt: 'text/plain;charset=utf-8',
};

export function getDemoDownload(jobId) {
  const job = findJob(jobId);
  const sourceFile = sourceFiles.get(jobId);
  if (sourceFile) {
    return {
      blob: sourceFile,
      filename: `demo-output-${job.file_name}`,
    };
  }

  const content = (segments[jobId] || [])
    .map((segment) => segment.translated_text || segment.original_text)
    .join('\n\n');
  const extension = job.file_type?.toLowerCase() || 'txt';
  return {
    blob: new Blob([content], { type: MIME_TYPES[extension] || 'application/octet-stream' }),
    filename: `demo-output-${job.file_name}`,
  };
}

export async function downloadJob(jobId) {
  const { blob, filename } = getDemoDownload(jobId);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function subscribeToEvents(onEvent) {
  listeners.add(onEvent);
  return () => listeners.delete(onEvent);
}
