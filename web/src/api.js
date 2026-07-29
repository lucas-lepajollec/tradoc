const API_BASE = '/api';

export async function fetchJobs() {
  const res = await fetch(`${API_BASE}/jobs`);
  if (!res.ok) throw new Error('Erreur lors du chargement des jobs');
  return res.json();
}

export async function fetchJobDetail(jobId) {
  const res = await fetch(`${API_BASE}/jobs/${jobId}`);
  if (!res.ok) throw new Error('Job introuvable');
  return res.json();
}

export async function fetchJobSegments(jobId) {
  const res = await fetch(`${API_BASE}/jobs/${jobId}/segments`);
  if (!res.ok) throw new Error('Erreur lors du chargement des segments');
  return res.json();
}

export async function uploadBook(formData) {
  const res = await fetch(`${API_BASE}/jobs/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Erreur lors de l\'envoi du fichier');
  }
  return res.json();
}

export async function startJob(jobId, options = {}) {
  const body = new FormData();
  if (options.endpoint) body.append('endpoint', options.endpoint);
  if (options.apiKey) body.append('api_key', options.apiKey);
  if (options.concurrency) body.append('concurrency', options.concurrency);
  if (options.temperature) body.append('temperature', options.temperature);

  const res = await fetch(`${API_BASE}/jobs/${jobId}/start`, {
    method: 'POST',
    body,
  });
  if (!res.ok) throw new Error('Erreur lors du démarrage du job');
  return res.json();
}

export async function updateJobConfig(jobId, options = {}) {
  const body = new FormData();
  if (options.temperature !== undefined) body.append('temperature', options.temperature);
  if (options.concurrency !== undefined) body.append('concurrency', options.concurrency);
  if (options.model) body.append('model', options.model);

  const res = await fetch(`${API_BASE}/jobs/${jobId}/update-config`, {
    method: 'POST',
    body,
  });
  if (!res.ok) throw new Error('Erreur lors de la mise à jour de la config du job');
  return res.json();
}

export async function pauseJob(jobId) {
  const res = await fetch(`${API_BASE}/jobs/${jobId}/pause`, { method: 'POST' });
  return res.json();
}

export async function retryJob(jobId) {
  const res = await fetch(`${API_BASE}/jobs/${jobId}/retry`, { method: 'POST' });
  return res.json();
}

export async function deleteJob(jobId) {
  const res = await fetch(`${API_BASE}/jobs/${jobId}`, { method: 'DELETE' });
  return res.json();
}

export async function testConnection(endpoint, apiKey, apiType) {
  const res = await fetch(`${API_BASE}/settings/test-connection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint, api_key: apiKey, api_type: apiType }),
  });
  return res.json();
}

export async function testTranslation(payload) {
  const res = await fetch(`${API_BASE}/settings/test-translation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Erreur lors du test de traduction');
  }
  return res.json();
}

export async function fetchRemoteModels(endpoint, apiKey) {
  const url = `${API_BASE}/models?endpoint=${encodeURIComponent(endpoint)}&api_key=${encodeURIComponent(apiKey || '')}`;
  const res = await fetch(url);
  return res.json();
}

export async function fetchGlossaries() {
  const res = await fetch(`${API_BASE}/glossaries`);
  return res.json();
}

export async function fetchGlossary(name) {
  const res = await fetch(`${API_BASE}/glossaries/${name}`);
  return res.json();
}

export async function saveGlossary(glossary) {
  const res = await fetch(`${API_BASE}/glossaries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(glossary),
  });
  return res.json();
}

export async function deleteGlossary(name) {
  const res = await fetch(`${API_BASE}/glossaries/${name}`, { method: 'DELETE' });
  return res.json();
}

export async function extractSandboxSample(formData) {
  const res = await fetch(`${API_BASE}/settings/sandbox-extract`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Erreur lors de l\'extraction de l\'extrait');
  }
  return res.json();
}
