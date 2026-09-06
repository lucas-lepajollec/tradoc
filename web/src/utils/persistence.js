const copy = (value, keys) => Object.fromEntries(
  keys.filter((key) => value?.[key] !== undefined).map((key) => [key, value[key]]),
);

const SETTINGS_KEYS = [
  'endpoint', 'apiType', 'model', 'sourceLang', 'targetLang', 'concurrency',
  'temperature', 'chunkSize', 'systemPrompt', 'enableProofreading',
  'enablePromptCaching',
];

export const sanitizePersistedSettings = (value) => copy(value, SETTINGS_KEYS);

export const sanitizePersistedPreset = (value) => copy(value, [
  'id', 'name', ...SETTINGS_KEYS,
]);

export const sanitizeProviderConfig = (value) => copy(value, [
  'endpoint', 'model', 'concurrency', 'chunkSize',
]);

export const sanitizeProviderConfigs = (value) => Object.fromEntries(
  Object.entries(value || {}).map(([provider, config]) => [provider, sanitizeProviderConfig(config)]),
);
