// Providers TraDoc can talk to, shared by settings and every model menu.
export const PROVIDERS = [
  { id: 'openai', name: 'OpenAI', logoUrl: '/providers/openai.png', defaultModel: 'gpt-5.6-luna', defaultUrl: 'https://api.openai.com/v1', staticModels: ['gpt-5.6-sol', 'gpt-5.6-luna', 'gpt-4o', 'o1', 'o3-mini'] },
  { id: 'claude', name: 'Claude (Anthropic)', logoUrl: '/providers/claude.png', defaultModel: 'claude-fable-5', defaultUrl: 'https://api.anthropic.com/v1', staticModels: ['claude-fable-5', 'claude-opus-5', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'] },
  { id: 'gemini', name: 'Gemini (Google)', logoUrl: '/providers/gemini.png', defaultModel: 'gemini-3.1-flash', defaultUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/v1', staticModels: ['gemini-3.1-flash', 'gemini-3.1-pro', 'gemini-2.5-flash', 'gemini-2.5-pro'] },
  { id: 'deepseek', name: 'DeepSeek', logoUrl: '/providers/deepseek.png', defaultModel: 'deepseek-chat', defaultUrl: 'https://api.deepseek.com/v1', staticModels: ['deepseek-chat', 'deepseek-reasoner', 'deepseek-v4-flash'] },
  { id: 'openrouter', name: 'OpenRouter', logoUrl: '/providers/openrouter.png', defaultModel: 'openai/gpt-5.6-luna', defaultUrl: 'https://openrouter.ai/api/v1', staticModels: ['openai/gpt-5.6-luna', 'anthropic/claude-fable-5', 'google/gemini-3.1-flash', 'deepseek/deepseek-v4-flash'] },
  { id: 'minimax', name: 'Minimax', logoUrl: '/providers/minimax.png', defaultModel: 'abab7-chat', defaultUrl: 'https://api.minimax.chat/v1', staticModels: ['abab7-chat', 'abab6.5-chat'] },
  { id: 'kimi', name: 'Kimi (Moonshot)', logoUrl: '/providers/kimi.png', defaultModel: 'kimi-k3', defaultUrl: 'https://api.moonshot.cn/v1', staticModels: ['kimi-k3', 'kimi-k2.6', 'moonshot-v1-32k'] },
  { id: 'glm', name: 'GLM (Zhipu AI)', logoUrl: '/providers/glm.png', defaultModel: 'glm-5.2', defaultUrl: 'https://open.bigmodel.cn/api/paas/v4', staticModels: ['glm-5.2', 'glm-4.7', 'glm-4-flash'] },
  { id: 'lm-studio', name: 'LM Studio / Local', logoUrl: '/providers/lmstudio.webp', defaultModel: 'qwen3.5-instruct', defaultUrl: 'http://localhost:1234/v1', staticModels: ['qwen3.5-instruct', 'translategemma-12b-it'] },
  { id: 'ollama', name: 'Ollama / Local', logoUrl: '/providers/ollama.png', defaultModel: 'qwen2.5:7b', defaultUrl: 'http://localhost:11434', staticModels: ['qwen2.5:7b', 'llama3:8b'] },
];

const LOCAL_PROVIDERS = new Set(['lm-studio', 'ollama']);
const MODEL_SEPARATOR = '::';

export const isLocalProvider = (providerId) => LOCAL_PROVIDERS.has(providerId);

export const findProvider = (providerId) => PROVIDERS.find((provider) => provider.id === providerId);

export const providerName = (providerId) => findProvider(providerId)?.name || providerId || '';

// Model menus mix several providers, so each option carries both values.
export const encodeModelChoice = (providerId, model) => `${providerId}${MODEL_SEPARATOR}${model}`;

export function decodeModelChoice(value, fallbackProvider) {
  const text = String(value || '');
  const index = text.indexOf(MODEL_SEPARATOR);
  if (index === -1) return { provider: fallbackProvider, model: text };
  return { provider: text.slice(0, index), model: text.slice(index + MODEL_SEPARATOR.length) };
}

/**
 * Builds the grouped model list shown in every model menu: one group per
 * connected provider, the active provider first, and the current model kept
 * even when discovery has not returned it yet.
 */
export function buildModelGroups(catalog = [], activeProvider, activeModels = [], currentModel = '') {
  const groups = new Map();
  const add = (provider, models) => {
    if (!provider) return;
    const existing = groups.get(provider) || [];
    groups.set(provider, [...new Set([...existing, ...models.filter(Boolean)])]);
  };
  add(activeProvider, [...activeModels, currentModel]);
  catalog.forEach((entry) => {
    if (entry?.models?.length) add(entry.provider, entry.models);
  });
  return [...groups.entries()]
    .filter(([, models]) => models.length > 0)
    .map(([provider, models]) => ({ provider, label: providerName(provider), models }));
}
