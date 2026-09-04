import * as demoApi from './demo/api';

const API_BASE = '/api';
export const isDemoMode = import.meta.env.MODE === 'demo';

function notifyAuthenticationRequired() {
  window.dispatchEvent(new CustomEvent('tradoc:auth-required'));
}

function getAppSecret() {
  const current = sessionStorage.getItem('tradoc_app_secret');
  if (current) return current;
  const legacy = localStorage.getItem('tradoc_app_secret');
  if (legacy) {
    sessionStorage.setItem('tradoc_app_secret', legacy);
    localStorage.removeItem('tradoc_app_secret');
  }
  return legacy || '';
}

export function setAppSecret(secret) {
  if (secret?.trim()) sessionStorage.setItem('tradoc_app_secret', secret.trim());
  else sessionStorage.removeItem('tradoc_app_secret');
  localStorage.removeItem('tradoc_app_secret');
}

function getAuthHeaders(extraHeaders = {}) {
  const secret = getAppSecret();
  return secret ? { ...extraHeaders, 'X-App-Secret': secret } : extraHeaders;
}

async function request(path, options = {}) {
  if (isDemoMode) return demoApi.request(path, options);
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: getAuthHeaders(options.headers || {}),
  });
  if (response.status === 401) notifyAuthenticationRequired();
  if (!response.ok) {
    let message = `HTTP error ${response.status}`;
    try {
      const payload = await response.json();
      message = payload.detail || payload.message || message;
    } catch {
      // Keep the generic status message for non-JSON responses.
    }
    throw new Error(message);
  }
  if (response.status === 204) return null;
  return response.json();
}

export const fetchJobs = () => request('/jobs');
export const fetchJobDetail = (jobId) => request(`/jobs/${encodeURIComponent(jobId)}`);
export const fetchJobSegments = (jobId) => request(`/jobs/${encodeURIComponent(jobId)}/segments`);

export function uploadBook(formData) {
  return request('/jobs/upload', { method: 'POST', body: formData });
}

export function startJob(jobId, options = {}) {
  const body = new FormData();
  if (options.endpoint) body.append('endpoint', options.endpoint);
  if (options.apiKey) body.append('api_key', options.apiKey);
  if (options.apiType) body.append('api_type', options.apiType);
  if (options.model) body.append('model', options.model);
  if (options.concurrency !== undefined) body.append('concurrency', options.concurrency);
  if (options.temperature !== undefined) body.append('temperature', options.temperature);
  if (options.enableProofreading !== undefined) body.append('enable_proofreading', options.enableProofreading);
  if (options.enablePromptCaching !== undefined) body.append('enable_prompt_caching', options.enablePromptCaching);
  return request(`/jobs/${encodeURIComponent(jobId)}/start`, { method: 'POST', body });
}

export function updateJobConfig(jobId, options = {}) {
  const body = new FormData();
  if (options.temperature !== undefined) body.append('temperature', options.temperature);
  if (options.concurrency !== undefined) body.append('concurrency', options.concurrency);
  if (options.model) body.append('model', options.model);
  return request(`/jobs/${encodeURIComponent(jobId)}/update-config`, { method: 'POST', body });
}

export function cloneJobForProofread(jobId, model) {
  const body = new FormData();
  if (model) body.append('model', model);
  return request(`/jobs/${encodeURIComponent(jobId)}/clone-for-proofread`, { method: 'POST', body });
}

export const pauseJob = (jobId) => request(`/jobs/${encodeURIComponent(jobId)}/pause`, { method: 'POST' });
export const retryJob = (jobId) => request(`/jobs/${encodeURIComponent(jobId)}/retry`, { method: 'POST' });
export const deleteJob = (jobId) => request(`/jobs/${encodeURIComponent(jobId)}`, { method: 'DELETE' });

export async function testConnection(endpoint, apiKey, apiType) {
  try {
    return await request('/settings/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: endpoint || null, api_key: apiKey || null, api_type: apiType }),
    });
  } catch (error) {
    return { success: false, message: error.message, models: [] };
  }
}

export function testTranslation(payload) {
  return request('/settings/test-translation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export const fetchCredentialMetadata = () => request('/settings/credentials');
export const fetchInterfaceSettings = () => request('/settings/interface');
export function saveInterfaceLanguage(language) {
  return request('/settings/interface', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language }),
  });
}
export function saveProviderCredentials(provider, apiKey, endpoint) {
  const payload = { provider };
  if (apiKey !== undefined) payload.api_key = apiKey;
  if (endpoint !== undefined) payload.endpoint = endpoint;
  return request('/settings/credentials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export const fetchGlossaries = () => request('/glossaries');
export const fetchGlossary = (name) => request(`/glossaries/${encodeURIComponent(name)}`);
export function saveGlossary(glossary) {
  return request('/glossaries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(glossary),
  });
}
export const deleteGlossary = (name) => request(`/glossaries/${encodeURIComponent(name)}`, { method: 'DELETE' });

export function extractSandboxSample(formData) {
  return request('/settings/sandbox-extract', { method: 'POST', body: formData });
}

export async function downloadJob(jobId) {
  if (isDemoMode) return demoApi.downloadJob(jobId);
  const response = await fetch(`${API_BASE}/jobs/${encodeURIComponent(jobId)}/download`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    let message = 'The download failed.';
    try {
      message = (await response.json()).detail || message;
    } catch {
      // Ignore a non-JSON error body.
    }
    throw new Error(message);
  }
  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') || '';
  const utfName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plainName = disposition.match(/filename="?([^";]+)"?/i)?.[1];
  const filename = decodeURIComponent(utfName || plainName || 'traduction');
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function subscribeToEvents(onEvent, onError = () => {}) {
  if (isDemoMode) return demoApi.subscribeToEvents(onEvent);
  const controller = new AbortController();

  async function connect() {
    while (!controller.signal.aborted) {
      try {
        const response = await fetch(`${API_BASE}/events`, {
          headers: getAuthHeaders({ Accept: 'text/event-stream' }),
          signal: controller.signal,
        });
        if (response.status === 401) {
          notifyAuthenticationRequired();
          onError(new Error('SSE HTTP 401'));
          return;
        }
        if (!response.ok || !response.body) throw new Error(`SSE HTTP ${response.status}`);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (!controller.signal.aborted) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split('\n\n');
          buffer = frames.pop() || '';
          frames.forEach((frame) => {
            const data = frame.split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('\n');
            if (data) {
              try { onEvent(JSON.parse(data)); } catch { /* malformed event ignored */ }
            }
          });
        }
      } catch (error) {
        if (controller.signal.aborted) break;
        onError(error);
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  connect();
  return () => controller.abort();
}
