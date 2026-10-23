import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, RefreshCw, Trash2, Check, ArrowLeftRight, Eye, EyeOff } from 'lucide-react';
import { isDemoMode, testConnection, saveProviderCredentials } from '../api';
import { t, l, languageLabel, AVAILABLE_LANGUAGES } from '../i18n/translations';
import { sanitizeProviderConfigs } from '../utils/persistence';

const DEFAULT_LITERARY_PROMPT = `You are a professional literary translator. Translate the supplied source text into the target language configured for this project, using fluent, natural prose suitable for publication.

STRICT RULES:
1. Names and world-building: follow the project glossary exactly. Do not translate proper names unless the glossary explicitly provides a target form.
2. Fidelity: omit no sentence, add no commentary, and never repeat a paragraph.
3. Structural integrity: preserve the supplied HTML tags (<p>, <i>, <b>, and others) exactly.
4. Direct answer: return only the translated text. Do not add a preface, explanation, internal reasoning, or <think> tags.`;

const PROVIDERS = [
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

export default function Settings({
  initialSubTab = 'providers',
  settings,
  onSaveSettings,
  availableModels = [],
  setAvailableModels,
  lang = 'en',
  setLang,
  theme = 'system',
  setTheme,
  presets = [],
  activePresetId = '',
  onApplyPreset,
  onSavePreset,
  onDeletePreset
}) {
  const [activeSubTab, setActiveSubTab] = useState(initialSubTab); // 'providers', 'translation', 'global', 'presets'

  const [apiType, setApiType] = useState(settings.apiType || 'openai');
  const [endpoint, setEndpoint] = useState(settings.endpoint);
  const [apiKey, setApiKey] = useState(settings.apiKey || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [model, setModel] = useState(settings.model);
  const [sourceLang, setSourceLang] = useState(settings.sourceLang || 'en');
  const [targetLang, setTargetLang] = useState(settings.targetLang || 'fr');
  const [concurrency, setConcurrency] = useState(settings.concurrency || 1);
  const [temperature, setTemperature] = useState(settings.temperature !== undefined ? settings.temperature : 0.15);
  const [chunkSize, setChunkSize] = useState(settings.chunkSize || 1000);
  const [systemPrompt, setSystemPrompt] = useState(settings.systemPrompt || DEFAULT_LITERARY_PROMPT);
  const [enableProofreading, setEnableProofreading] = useState(settings.enableProofreading || false);

  // Auto-fetched models state
  const [fetchedModels, setFetchedModels] = useState([]);
  const [modelSearch, setModelSearch] = useState('');
  const [fetchingModels, setFetchingModels] = useState(false);

  const [customPromptPresets, setCustomPromptPresets] = useState(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem('tradoc_custom_presets') || '{}');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      localStorage.removeItem('tradoc_custom_presets');
      return {};
    }
  });
  
  const [providerConfigs, setProviderConfigs] = useState(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem('tradoc_provider_configs') || '{}');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      const sanitized = sanitizeProviderConfigs(parsed);
      localStorage.setItem('tradoc_provider_configs', JSON.stringify(sanitized));
      return sanitized;
    } catch {
      localStorage.removeItem('tradoc_provider_configs');
      return {};
    }
  });

  const [selectedPromptKey, setSelectedPromptKey] = useState('literary');
  const [newPromptName, setNewPromptName] = useState('');
  const [newPresetNameInput, setNewPresetNameInput] = useState('');

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const activeProvider = PROVIDERS.find(p => p.id === apiType) || PROVIDERS[0];
  const isLocal = ['lm-studio', 'ollama'].includes(apiType);

  // Sync settings when external settings update (e.g. preset applied)
  useEffect(() => {
    setApiType(settings.apiType || 'openai');
    setEndpoint(settings.endpoint);
    setApiKey(settings.apiKey || '');
    setModel(settings.model);
    setSourceLang(settings.sourceLang || 'en');
    setTargetLang(settings.targetLang || 'fr');
    setConcurrency(settings.concurrency || 1);
    setTemperature(settings.temperature !== undefined ? settings.temperature : 0.15);
    setChunkSize(settings.chunkSize || 1000);
    setSystemPrompt(settings.systemPrompt || DEFAULT_LITERARY_PROMPT);
    setEnableProofreading(!!settings.enableProofreading);
  }, [
    settings.apiType,
    settings.endpoint,
    settings.apiKey,
    settings.model,
    settings.sourceLang,
    settings.targetLang,
    settings.concurrency,
    settings.temperature,
    settings.chunkSize,
    settings.systemPrompt,
    settings.enableProofreading
  ]);

  // Trigger auto-detect when apiKey/endpoint changes
  useEffect(() => {
    setFetchingModels(true);
    const timer = setTimeout(async () => {
      try {
        const res = await testConnection(endpoint, apiKey, apiType);
        if (res.success && res.models && res.models.length > 0) {
          setFetchedModels(res.models);
          if (setAvailableModels) setAvailableModels(res.models);
        } else {
          setFetchedModels([]);
        }
      } catch (e) {
        console.error("Auto-detect models failed: ", e);
      } finally {
        setFetchingModels(false);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [apiKey, apiType, endpoint]);

  const handleProviderSelect = (prov) => {
    // 1. Save current provider config if it has values
    const updatedConfigs = {
      ...providerConfigs,
      [apiType]: {
        endpoint,
        model,
        concurrency,
        chunkSize
      }
    };

    setProviderConfigs(updatedConfigs);
    localStorage.setItem('tradoc_provider_configs', JSON.stringify(sanitizeProviderConfigs(updatedConfigs)));

    // 2. Load target provider config if saved previously
    const targetConfig = updatedConfigs[prov.id];
    const targetIsLocal = ['lm-studio', 'ollama'].includes(prov.id);
    const targetChunkMin = 200;
    const targetChunkMax = 10000;
    const targetChunkRecommended = targetIsLocal ? 1000 : 7000;
    setApiType(prov.id);
    if (targetConfig) {
      setEndpoint(targetConfig.endpoint || prov.defaultUrl);
      setApiKey('');
      setModel(targetConfig.model || prov.defaultModel);
      setConcurrency(targetConfig.concurrency !== undefined ? targetConfig.concurrency : (['lm-studio', 'ollama'].includes(prov.id) ? 1 : 4));
      setChunkSize(Math.max(targetChunkMin, Math.min(targetChunkMax, targetConfig.chunkSize || targetChunkRecommended)));
    } else {
      setEndpoint(prov.defaultUrl);
      setApiKey('');
      setModel(prov.defaultModel);
      setConcurrency(targetIsLocal ? 1 : 4);
      setChunkSize(targetChunkRecommended);
    }
    setFetchedModels([]);
    setModelSearch('');
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testConnection(endpoint, apiKey, apiType);
      setTestResult(res);
    } catch (e) {
      setTestResult({ success: false, message: `Erreur: ${e.message}` });
    } finally {
      setTesting(false);
    }
  };

  const handlePromptPresetChange = (key) => {
    setSelectedPromptKey(key);
    if (key === 'literary') {
      setSystemPrompt(DEFAULT_LITERARY_PROMPT);
    } else if (customPromptPresets[key]) {
      setSystemPrompt(customPromptPresets[key]);
    }
  };

  const handleSavePromptPreset = () => {
    if (!newPromptName.trim()) return;
    const updated = { ...customPromptPresets, [newPromptName.trim()]: systemPrompt };
    setCustomPromptPresets(updated);
    localStorage.setItem('tradoc_custom_presets', JSON.stringify(updated));
    setSelectedPromptKey(newPromptName.trim());
    setNewPromptName('');
  };

  const handleDeletePromptPreset = (key) => {
    const updated = { ...customPromptPresets };
    delete updated[key];
    setCustomPromptPresets(updated);
    localStorage.setItem('tradoc_custom_presets', JSON.stringify(updated));
    setSelectedPromptKey('literary');
    setSystemPrompt(DEFAULT_LITERARY_PROMPT);
  };

  const handleSaveConfigPreset = () => {
    if (!newPresetNameInput.trim()) return;
    const presetObj = {
      id: 'preset-' + Date.now(),
      name: newPresetNameInput.trim(),
      apiType,
      endpoint,
      model,
      sourceLang,
      targetLang,
      concurrency,
      temperature,
      chunkSize,
      systemPrompt,
      enableProofreading,
      enablePromptCaching: !!settings.enablePromptCaching,
    };
    if (onSavePreset) onSavePreset(presetObj);
    setNewPresetNameInput('');
  };

  const handleSaveAll = async (e) => {
    if (e) e.preventDefault();
    try {
      await saveProviderCredentials(apiType, apiKey.trim() || undefined, endpoint);
    } catch (error) {
      alert(error.message);
      return;
    }

    const updatedConfigs = {
      ...providerConfigs,
      [apiType]: {
        endpoint,
        model,
        concurrency,
        chunkSize
      }
    };
    setProviderConfigs(updatedConfigs);
    localStorage.setItem('tradoc_provider_configs', JSON.stringify(sanitizeProviderConfigs(updatedConfigs)));

    onSaveSettings({
      endpoint,
      apiKey: '',
      apiType,
      model,
      sourceLang,
      targetLang,
      concurrency,
      temperature,
      chunkSize,
      systemPrompt,
      enableProofreading,
      enablePromptCaching: !!settings.enablePromptCaching,
    });
    alert(t('settings.saveAllSuccess', lang));
  };

  const availableModelsList = fetchedModels.length > 0 ? fetchedModels : activeProvider.staticModels;
  const filteredModels = availableModelsList.filter(m => 
    m.toLowerCase().includes(modelSearch.toLowerCase())
  );

  const subTabs = [
    { id: 'providers', label: t('settings.tabProviders', lang) },
    { id: 'translation', label: t('settings.tabTranslation', lang) },
    { id: 'global', label: t('settings.tabGlobal', lang) },
    { id: 'presets', label: t('settings.tabPresets', lang) },
  ];
  const interfaceLanguages = [
    ['en', t('settings.langEnglish', lang).replace(/\s*\(.*\)$/, '')],
    ['fr', t('settings.langFrench', lang)],
    ['es', t('settings.langSpanish', lang)],
    ['de', t('settings.langGerman', lang)],
  ];
  const appearanceOptions = [
    ['system', l(lang, 'System', 'Système', 'Sistema', 'System')],
    ['light', l(lang, 'Light', 'Clair', 'Claro', 'Hell')],
    ['dark', l(lang, 'Dark', 'Sombre', 'Oscuro', 'Dunkel')],
  ];
  const swapDefaultLanguages = () => {
    if (sourceLang === 'auto') return;
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
  };
  const keyDisabled = isDemoMode || (isLocal && apiType !== 'lm-studio');

  return (
    <div className="page page-narrow">
      <div className="page-head">
        <div>
          <h1>{t('nav.settings', lang)}</h1>
          <p>{t('settings.subtitle', lang)}</p>
        </div>
        <button type="submit" form="settings-form" className="btn btn-primary">{t('settings.saveAllSettings', lang)}</button>
      </div>

      <div className="seg seg-outline seg-scroll self-start" role="tablist" aria-label={l(lang, 'Settings sections', 'Sections des réglages', 'Secciones de ajustes', 'Einstellungsbereiche')}>
        {subTabs.map((tab) => (
          <button key={tab.id} type="button" role="tab" aria-selected={activeSubTab === tab.id} onClick={() => setActiveSubTab(tab.id)}>{tab.label}</button>
        ))}
      </div>

      <form id="settings-form" onSubmit={handleSaveAll}>
        {activeSubTab === 'providers' && (
          <section aria-label={t('settings.tabProviders', lang)} className="card flex flex-col gap-[22px] p-6">
            <div className="flex flex-col gap-2.5">
              <h2 className="section-title">{t('settings.chooseProvider', lang)}</h2>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,160px),1fr))] gap-2">
                {PROVIDERS.map((provider) => (
                  <button key={provider.id} type="button" className="tile text-[13px] font-medium" aria-pressed={apiType === provider.id} onClick={() => handleProviderSelect(provider)}>
                    <span className="grid size-7 flex-none place-items-center overflow-hidden rounded-lg bg-[#18181b]">
                      <img src={provider.logoUrl} alt="" className="size-5 object-contain" />
                    </span>
                    <span className="min-w-0 leading-tight">{provider.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {testResult && (
              <div role="status" className="notice">
                {testResult.success ? <CheckCircle2 className="text-good" aria-hidden="true" /> : <AlertCircle aria-hidden="true" />}
                <div className="min-w-0">
                  <p className="m-0 font-medium">{testResult.message}</p>
                  {testResult.models?.length > 0 && (
                    <p className="m-0 mt-1 break-words text-[12px] text-sec">
                      {l(lang, 'Available models', 'Modèles disponibles', 'Modelos disponibles', 'Verfügbare Modelle')}: {testResult.models.slice(0, 8).join(', ')}{testResult.models.length > 8 ? '…' : ''}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-3.5">
              <div className="field">
                <span className="field-label">
                  <label htmlFor="settings-model">{t('settings.activeModel', lang)}</label>
                  {fetchingModels && <span className="text-accent-text">{t('settings.detectingModels', lang)}</span>}
                </span>
                {availableModelsList.length > 5 && (
                  <input
                    type="search"
                    className="input"
                    value={modelSearch}
                    onChange={(event) => setModelSearch(event.target.value)}
                    placeholder={t('settings.searchModelPlaceholder', lang)}
                    aria-label={t('settings.searchModelPlaceholder', lang)}
                  />
                )}
                <select id="settings-model" className="input" value={model} onChange={(event) => setModel(event.target.value)}>
                  {!filteredModels.includes(model) && model && <option value={model}>{model} (Custom)</option>}
                  {filteredModels.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
              <label className="field">
                <span className="field-label">{t('settings.customEndpoint', lang)}</span>
                <input className="input" type="text" value={endpoint} onChange={(event) => setEndpoint(event.target.value)} disabled={isDemoMode || !isLocal} />
              </label>
              <div className="field col-span-full">
                <label className="field-label" htmlFor="settings-api-key">{t('settings.apiKey', lang)}</label>
                <div className="flex gap-2">
                  <input
                    id="settings-api-key"
                    className="input min-w-0 flex-1"
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    placeholder={isDemoMode ? l(lang, 'Disabled in demo', 'Désactivée dans la démo', 'Desactivada en la demo', 'In der Demo deaktiviert') : (isLocal ? t('settings.notRequired', lang) : t('settings.apiKeyPlaceholder', lang))}
                    disabled={keyDisabled}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="btn btn-secondary !h-10 !rounded-xl"
                    onClick={() => setShowApiKey(!showApiKey)}
                    aria-pressed={showApiKey}
                  >
                    {showApiKey ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                    {showApiKey
                      ? l(lang, 'Hide API key', 'Masquer la clé API', 'Ocultar la clave API', 'API-Schlüssel ausblenden')
                      : l(lang, 'Show API key', 'Afficher la clé API', 'Mostrar la clave API', 'API-Schlüssel anzeigen')}
                  </button>
                </div>
                {!isLocal && <span className="hint">{l(lang, 'Leave blank to reuse the key already stored on the server.', 'Laissez vide pour réutiliser la clé déjà stockée côté serveur.', 'Déjalo vacío para reutilizar la clave guardada en el servidor.', 'Leer lassen, um den bereits auf dem Server gespeicherten Schlüssel zu verwenden.')}</span>}
              </div>
            </div>

            <div className="well flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
              <span className="setting-copy">
                <strong>{l(lang, 'Automatic model detection', 'Détection automatique des modèles', 'Detección automática de modelos', 'Automatische Modellerkennung')}</strong>
                <span>{isLocal
                  ? l(lang, 'Enter your local server endpoint and TraDoc will automatically detect the available models.', 'Renseignez l’endpoint de votre serveur local : TraDoc détectera automatiquement les modèles disponibles.', 'Introduce el endpoint del servidor local y TraDoc detectará los modelos disponibles.', 'Gib den Endpunkt deines lokalen Servers ein; TraDoc erkennt die verfügbaren Modelle automatisch.')
                  : l(lang, 'Enter your API key and TraDoc will automatically detect the available cloud models.', 'Renseignez votre clé API : TraDoc détectera automatiquement les modèles cloud disponibles.', 'Introduce tu clave API y TraDoc detectará los modelos disponibles en la nube.', 'Gib deinen API-Schlüssel ein; TraDoc erkennt die verfügbaren Cloud-Modelle automatisch.')}</span>
              </span>
              <button type="button" className="btn btn-secondary bg-card" onClick={handleTestConnection} disabled={testing}>
                {testing && <RefreshCw className="animate-spin" aria-hidden="true" />}
                {testing ? t('settings.testingConnection', lang) : t('settings.testConnection', lang)}
              </button>
            </div>
          </section>
        )}

        {activeSubTab === 'translation' && (
          <section aria-label={t('settings.tabTranslation', lang)} className="card px-6 py-2">
            <label className="setting-row">
              <span className="setting-copy">
                <strong>{t('settings.chunkSizeLabel', lang, { count: chunkSize.toLocaleString() })}</strong>
                <span>{l(lang, 'Local: 500–2,500', 'Local : 500–2 500', 'Local: 500–2.500', 'Lokal: 500–2.500')} ({l(lang, '1,000 recommended', '1 000 recommandé', '1.000 recomendado', '1.000 empfohlen')}) · {l(lang, 'Cloud: 2,500–10,000', 'Cloud : 2 500–10 000', 'Nube: 2.500–10.000', 'Cloud: 2.500–10.000')} ({l(lang, '7,000 recommended', '7 000 recommandé', '7.000 recomendado', '7.000 empfohlen')})</span>
              </span>
              <input type="range" min={200} max={10000} step={100} value={chunkSize} onChange={(event) => setChunkSize(parseInt(event.target.value, 10))} className="flex-[1_1_200px]" />
            </label>
            <label className="setting-row">
              <span className="setting-copy">
                <strong>{t('settings.temperatureLabel', lang, { val: temperature.toFixed(2) })}</strong>
                <span>{t('settings.temperatureAdvice', lang)}</span>
              </span>
              <input type="range" min={0} max={1.5} step={0.05} value={temperature} onChange={(event) => setTemperature(parseFloat(event.target.value))} className="flex-[1_1_200px]" />
            </label>
            <label className="setting-row">
              <span className="setting-copy">
                <strong>{t('settings.concurrencyLabel', lang, { val: concurrency })}</strong>
                <span>{t('settings.concurrencyAdvice', lang)}</span>
              </span>
              <input type="range" min={1} max={16} value={concurrency} onChange={(event) => setConcurrency(parseInt(event.target.value, 10))} className="flex-[1_1_200px]" />
            </label>
            <div className="setting-row">
              <span className="setting-copy">
                <strong id="settings-proofreading">{l(lang, 'Editorial proofreading', 'Relecture éditoriale', 'Revisión editorial', 'Redaktionelle Überarbeitung')}</strong>
                <span>{l(lang, 'Automatic second pass (2 calls per segment)', 'Deuxième passe automatique (2 appels par segment)', 'Segunda pasada automática (2 llamadas por segmento)', 'Automatischer zweiter Durchgang (2 Aufrufe je Segment)')}</span>
              </span>
              <button type="button" role="switch" aria-checked={enableProofreading} aria-labelledby="settings-proofreading" className="switch" onClick={() => setEnableProofreading(!enableProofreading)} />
            </div>
            <div className="flex flex-col gap-2.5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{t('settings.systemPromptTitle', lang)}</span>
                <div className="flex items-center gap-1.5">
                  <select aria-label={t('settings.systemPromptTitle', lang)} className="chip-select !pr-2 font-medium text-fg" value={selectedPromptKey} onChange={(event) => handlePromptPresetChange(event.target.value)}>
                    <option value="literary">{l(lang, 'Literary default prompt', 'Prompt littéraire par défaut', 'Prompt literario predeterminado', 'Standardprompt für literarische Texte')}</option>
                    {Object.keys(customPromptPresets).map((key) => <option key={key} value={key}>{key}</option>)}
                  </select>
                  {selectedPromptKey !== 'literary' && (
                    <button type="button" className="icon-btn is-plain" onClick={() => handleDeletePromptPreset(selectedPromptKey)} aria-label={t('settings.deletePresetBtn', lang)}>
                      <Trash2 aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
              <textarea className="input text-[13px]" rows={8} value={systemPrompt} onChange={(event) => setSystemPrompt(event.target.value)} aria-label={t('settings.systemPromptTitle', lang)} />
              <div className="flex flex-wrap gap-2">
                <input className="input min-w-0 flex-[1_1_200px] !h-9 !rounded-full" type="text" value={newPromptName} onChange={(event) => setNewPromptName(event.target.value)} placeholder={t('settings.customPresetName', lang)} aria-label={t('settings.customPresetName', lang)} />
                <button type="button" className="btn btn-secondary" onClick={handleSavePromptPreset} disabled={!newPromptName.trim()}>{t('settings.createPresetBtn', lang)}</button>
              </div>
            </div>
          </section>
        )}

        {activeSubTab === 'global' && (
          <section aria-label={t('settings.tabGlobal', lang)} className="card px-6 py-2">
            <div className="setting-row">
              <span className="setting-copy"><strong>{t('settings.languageTitle', lang)}</strong><span>{t('settings.languageDesc', lang)}</span></span>
              <div className="seg" role="group" aria-label={t('settings.languageTitle', lang)}>
                {interfaceLanguages.map(([code, label]) => (
                  <button key={code} type="button" aria-pressed={lang === code} onClick={() => setLang(code)}>{label}</button>
                ))}
              </div>
            </div>
            {setTheme && (
              <div className="setting-row">
                <span className="setting-copy">
                  <strong>{l(lang, 'Appearance', 'Apparence', 'Apariencia', 'Darstellung')}</strong>
                  <span>{l(lang, 'Follow the system, or force light or dark.', 'Suivre le système, ou forcer le thème clair ou sombre.', 'Seguir el sistema o forzar el tema claro u oscuro.', 'Dem System folgen oder hell bzw. dunkel erzwingen.')}</span>
                </span>
                <div className="seg" role="group" aria-label={l(lang, 'Appearance', 'Apparence', 'Apariencia', 'Darstellung')}>
                  {appearanceOptions.map(([value, label]) => (
                    <button key={value} type="button" aria-pressed={theme === value} onClick={() => setTheme(value)}>{label}</button>
                  ))}
                </div>
              </div>
            )}
            <div className="setting-row">
              <span className="setting-copy">
                <strong>{l(lang, 'Default translation languages', 'Langues de traduction par défaut', 'Idiomas de traducción predeterminados', 'Standardsprachen der Übersetzung')}</strong>
                <span>{l(lang, 'Pre-selected for every new document.', 'Présélectionnées pour chaque nouveau document.', 'Preseleccionados para cada documento nuevo.', 'Für jedes neue Dokument vorausgewählt.')}</span>
              </span>
              <div className="chip-select !px-1">
                <select aria-label={l(lang, 'Default source language', 'Langue source par défaut', 'Idioma de origen predeterminado', 'Standard-Ausgangssprache')} value={sourceLang} onChange={(event) => setSourceLang(event.target.value)}>
                  {AVAILABLE_LANGUAGES.map((language) => <option key={language.code} value={language.code}>{languageLabel(language.code, lang)}</option>)}
                </select>
                <button type="button" className="icon-btn is-plain !size-7" onClick={swapDefaultLanguages} aria-label={l(lang, 'Swap languages', 'Inverser les langues', 'Intercambiar idiomas', 'Sprachen tauschen')}>
                  <ArrowLeftRight className="!size-3.5" aria-hidden="true" />
                </button>
                <select aria-label={l(lang, 'Default target language', 'Langue cible par défaut', 'Idioma de destino predeterminado', 'Standard-Zielsprache')} value={targetLang} onChange={(event) => setTargetLang(event.target.value)}>
                  {AVAILABLE_LANGUAGES.filter((language) => language.code !== 'auto').map((language) => <option key={language.code} value={language.code}>{languageLabel(language.code, lang)}</option>)}
                </select>
              </div>
            </div>
          </section>
        )}

        {activeSubTab === 'presets' && (
          <section aria-label={t('settings.tabPresets', lang)} className="card flex flex-col gap-[18px] p-6">
            <div className="flex flex-col gap-2.5">
              <div>
                <h2 className="section-title">{l(lang, 'Save the current configuration', 'Enregistrer la configuration actuelle', 'Guardar la configuración actual', 'Aktuelle Konfiguration speichern')}</h2>
                <p className="m-0 mt-0.5 text-[13px] text-sec">{l(lang, 'Create a shortcut with the active provider, model and settings.', 'Créez un raccourci avec le fournisseur, le modèle et les réglages actifs.', 'Crea un acceso rápido con el proveedor, el modelo y los ajustes activos.', 'Erstelle ein Profil mit dem aktiven Anbieter, Modell und den aktuellen Einstellungen.')}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <input className="input min-w-0 flex-[1_1_220px] !rounded-full !px-4" type="text" value={newPresetNameInput} onChange={(event) => setNewPresetNameInput(event.target.value)} placeholder={t('settings.presetNamePlaceholder', lang)} aria-label={t('settings.presetNamePlaceholder', lang)} />
                <button type="button" className="btn btn-solid btn-lg" onClick={handleSaveConfigPreset} disabled={!newPresetNameInput.trim()}>{t('settings.savePresetBtn', lang)}</button>
              </div>
            </div>

            {presets.length === 0 ? (
              <div className="well flex flex-col items-center gap-1 px-4 py-8 text-center">
                <strong className="font-medium">{l(lang, 'No saved profiles', 'Aucun profil enregistré', 'No hay perfiles guardados', 'Keine Profile gespeichert')}</strong>
                <span className="text-[13px] text-sec">{l(lang, 'Name the current configuration to find it here.', 'Donnez un nom à la configuration actuelle pour la retrouver ici.', 'Ponle un nombre a la configuración actual para encontrarla aquí.', 'Gib der aktuellen Konfiguration einen Namen, damit sie hier erscheint.')}</span>
              </div>
            ) : (
              <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-3 p-0">
                {presets.map((preset) => {
                  const isActive = activePresetId === preset.id;
                  return (
                    <li key={preset.id} className={`flex flex-col gap-3 rounded-2xl border p-4 ${isActive ? 'border-[var(--accent-btn)] bg-[var(--accent-soft)]' : 'border-line'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <strong className="min-w-0 truncate font-semibold" title={preset.name}>{preset.name}</strong>
                        {isActive && <span className="status is-running">{l(lang, 'Profile in use', 'Profil utilisé', 'Perfil en uso', 'Profil in Verwendung')}</span>}
                      </div>
                      <dl className="m-0 grid grid-cols-2 gap-x-3 gap-y-1 text-[13px]">
                        <dt className="text-sec">{l(lang, 'Provider', 'Fournisseur', 'Proveedor', 'Anbieter')}</dt><dd className="m-0 truncate">{preset.apiType || '—'}</dd>
                        <dt className="text-sec">{l(lang, 'Model', 'Modèle', 'Modelo', 'Modell')}</dt><dd className="m-0 truncate" title={preset.model}>{preset.model || '—'}</dd>
                        <dt className="text-sec">{l(lang, 'Concurrency', 'Concurrence', 'Concurrencia', 'Parallelität')}</dt><dd className="m-0">{preset.concurrency ?? '—'}</dd>
                        <dt className="text-sec">{l(lang, 'Segment', 'Segment', 'Segmento', 'Segment')}</dt><dd className="m-0">{preset.chunkSize || 1000} tokens</dd>
                      </dl>
                      <div className="flex items-center gap-1.5">
                        {!isActive && (
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onApplyPreset && onApplyPreset(preset.id)}>
                            <Check aria-hidden="true" />{t('settings.activatePresetBtn', lang)}
                          </button>
                        )}
                        <button
                          type="button"
                          className="icon-btn is-plain ml-auto"
                          onClick={() => {
                            if (window.confirm(t('settings.confirmDeletePreset', lang, { name: preset.name }))) {
                              if (onDeletePreset) onDeletePreset(preset.id);
                            }
                          }}
                          aria-label={`${t('settings.deletePresetBtn', lang)} — ${preset.name}`}
                        >
                          <Trash2 aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </form>
    </div>
  );
}
