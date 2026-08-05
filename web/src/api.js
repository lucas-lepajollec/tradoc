const API_BASE = '/api';

function getAuthHeaders(extraHeaders = {}) {
  const secret = localStorage.getItem('tradoc_app_secret');
  if (secret) {
    return { ...extraHeaders, 'X-App-Secret': secret };
  }
  return extraHeaders;
}

export async function fetchJobs() {
  const res = await fetch(`${API_BASE}/jobs`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Erreur lors du chargement des jobs');
  return res.json();
}

export async function fetchJobDetail(jobId) {
  const res = await fetch(`${API_BASE}/jobs/${jobId}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Job introuvable');
  return res.json();
}

export async function fetchJobSegments(jobId) {
  const res = await fetch(`${API_BASE}/jobs/${jobId}/segments`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Erreur lors du chargement des segments');
  return res.json();
}

export async function uploadBook(formData) {
  const res = await fetch(`${API_BASE}/jobs/upload`, {
    method: 'POST',
    headers: getAuthHeaders(),
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
  if (options.apiType) body.append('api_type', options.apiType);
  if (options.model) body.append('model', options.model);
  if (options.concurrency) body.append('concurrency', options.concurrency);
  if (options.temperature) body.append('temperature', options.temperature);
  if (options.enableProofreading !== undefined) body.append('enable_proofreading', options.enableProofreading);

  const res = await fetch(`${API_BASE}/jobs/${jobId}/start`, {
    method: 'POST',
    headers: getAuthHeaders(),
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
    headers: getAuthHeaders(),
    body,
  });
  if (!res.ok) throw new Error('Erreur lors de la mise à jour de la config du job');
  return res.json();
}

export async function proofreadJob(jobId, options = {}) {
  const body = new FormData();
  if (options.endpoint) body.append('endpoint', options.endpoint);
  if (options.apiKey) body.append('api_key', options.apiKey);
  if (options.apiType) body.append('api_type', options.apiType);
  if (options.model) body.append('model', options.model);
  if (options.concurrency) body.append('concurrency', options.concurrency);

  const res = await fetch(`${API_BASE}/jobs/${jobId}/proofread`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body,
  });
  if (!res.ok) throw new Error('Erreur lors du lancement de la relecture');
  return res.json();
}

export async function cloneJobForProofread(jobId, model) {
  const body = new FormData();
  if (model) body.append('model', model);

  const res = await fetch(`${API_BASE}/jobs/${jobId}/clone-for-proofread`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body,
  });
  if (!res.ok) throw new Error('Erreur lors de la préparation de la relecture');
  return res.json();
}

export async function pauseJob(jobId) {
  const res = await fetch(`${API_BASE}/jobs/${jobId}/pause`, { method: 'POST', headers: getAuthHeaders() });
  return res.json();
}

export async function retryJob(jobId) {
  const res = await fetch(`${API_BASE}/jobs/${jobId}/retry`, { method: 'POST', headers: getAuthHeaders() });
  return res.json();
}

export async function deleteJob(jobId) {
  const res = await fetch(`${API_BASE}/jobs/${jobId}`, { method: 'DELETE', headers: getAuthHeaders() });
  return res.json();
}

export async function testConnection(endpoint, apiKey, apiType) {
  try {
    const res = await fetch(`${API_BASE}/settings/test-connection`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ endpoint, api_key: apiKey, api_type: apiType }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { success: false, message: text || `Erreur HTTP ${res.status}`, models: [] };
    }
    return await res.json();
  } catch (e) {
    return { success: false, message: e.message, models: [] };
  }
}

export async function testTranslation(payload) {
  const res = await fetch(`${API_BASE}/settings/test-translation`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Erreur lors du test de traduction');
  }
  return res.json();
}

export async function fetchRemoteModels(endpoint, apiKey) {
  try {
    const url = `${API_BASE}/models?endpoint=${encodeURIComponent(endpoint)}&api_key=${encodeURIComponent(apiKey || '')}`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    console.error('fetchRemoteModels error:', e);
    return [];
  }
}

export async function fetchGlossaries() {
  const res = await fetch(`${API_BASE}/glossaries`, { headers: getAuthHeaders() });
  return res.json();
}

export async function fetchGlossary(name) {
  const res = await fetch(`${API_BASE}/glossaries/${name}`, { headers: getAuthHeaders() });
  return res.json();
}

export async function saveGlossary(glossary) {
  const res = await fetch(`${API_BASE}/glossaries`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(glossary),
  });
  return res.json();
}

export async function deleteGlossary(name) {
  const res = await fetch(`${API_BASE}/glossaries/${name}`, { method: 'DELETE', headers: getAuthHeaders() });
  return res.json();
}

export function getDownloadUrl(jobId) {
  const secret = localStorage.getItem('tradoc_app_secret');
  const query = secret ? `?token=${encodeURIComponent(secret)}` : '';
  return `${API_BASE}/jobs/${jobId}/download${query}`;
}

export async function extractSandboxSample(formData) {
  const res = await fetch(`${API_BASE}/settings/sandbox-extract`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Erreur lors de l\'extraction de l\'extrait');
  }
  return res.json();
}
