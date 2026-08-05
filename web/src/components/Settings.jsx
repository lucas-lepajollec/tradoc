import React, { useState, useEffect } from 'react';
import { Server, Cpu, Sliders, CheckCircle2, AlertCircle, RefreshCw, Save, Trash2, Plus, Key, Link, Search, Globe, Bookmark, Check, ShieldCheck, ArrowLeftRight, Eye, EyeOff, Lock } from 'lucide-react';
import { testConnection } from '../api';
import { t, AVAILABLE_LANGUAGES } from '../i18n/translations';

const DEFAULT_LITERARY_PROMPT = `Tu es un traducteur littéraire professionnel expert en Anglais-Français. 
Ta tâche est de traduire le texte anglais fourni en un français fluide, naturel et élégant, digne d'une maison d'édition francophone.

RÈGLES STRICTES :
1. Conservation des noms propres et de l'univers : Ne traduis PAS les noms propres de lieux, de personnages ou les termes spécifiques à l'univers (ex: "Crimson" = "Cramoisi", "Temple" dans le contexte anatomique = "Tempe").
2. Fidélité au texte : Ne saute AUCUNE phrase, n'ajoute AUCUN commentaire, et ne répète JAMAIS de paragraphe.
3. Intégrité des balises : Conserve exactement la structure des balises HTML (<p>, <i>, <b>, etc.) fournies dans le texte.
4. Réponse directe : Renvoie STRICTEMENT ET UNIQUEMENT la traduction du texte. Pas de bavardage, pas de préambule, pas d'explication. N'écris aucune réflexion interne ni balise <think>.`;

// Premium Inline Logo Components (SVG)
const OpenAiIcon = () => (
  <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

const ClaudeIcon = () => (
  <svg className="w-5 h-5 text-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5-9 5zm0 0l5 9m-5-9l-5 9" />
  </svg>
);

const GeminiIcon = () => (
  <svg className="w-5 h-5 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L9 9l-7 3 7 3 3 7 3-7 7-3-7-3-3-7z" />
  </svg>
);

const DeepseekIcon = () => (
  <svg className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6c0 5.25 4 9.75 9 10 5-.25 9-4.75 9-10z" />
  </svg>
);

const OpenRouterIcon = () => (
  <svg className="w-5 h-5 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="3" />
    <circle cx="12" cy="4" r="2" />
    <circle cx="5" cy="18" r="2" />
    <circle cx="19" cy="18" r="2" />
    <path d="M12 6v3M6.5 16.5l2.5-2M17.5 16.5l-2.5-2" />
  </svg>
);

const MinimaxIcon = () => (
  <svg className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M9 17V9l6 8V9" />
  </svg>
);

const KimiIcon = () => (
  <svg className="w-5 h-5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v8M8 12h8" />
  </svg>
);

const GlmIcon = () => (
  <svg className="w-5 h-5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
  </svg>
);

const LocalIcon = () => (
  <svg className="w-5 h-5 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="M6 8l4 4-4 4M12 16h6" />
  </svg>
);

const PROVIDERS = [
  { id: 'openai', name: 'OpenAI', icon: OpenAiIcon, defaultModel: 'gpt-5.6-luna', defaultUrl: 'https://api.openai.com/v1', staticModels: ['gpt-5.6-sol', 'gpt-5.6-luna', 'gpt-4o', 'o1', 'o3-mini'] },
  { id: 'claude', name: 'Claude (Anthropic)', icon: ClaudeIcon, defaultModel: 'claude-fable-5', defaultUrl: 'https://api.anthropic.com/v1', staticModels: ['claude-fable-5', 'claude-opus-5', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'] },
  { id: 'gemini', name: 'Gemini (Google)', icon: GeminiIcon, defaultModel: 'gemini-3.1-flash', defaultUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/v1', staticModels: ['gemini-3.1-flash', 'gemini-3.1-pro', 'gemini-2.5-flash', 'gemini-2.5-pro'] },
  { id: 'deepseek', name: 'DeepSeek', icon: DeepseekIcon, defaultModel: 'deepseek-chat', defaultUrl: 'https://api.deepseek.com/v1', staticModels: ['deepseek-chat', 'deepseek-reasoner', 'deepseek-v4-flash'] },
  { id: 'openrouter', name: 'OpenRouter', icon: OpenRouterIcon, defaultModel: 'openai/gpt-5.6-luna', defaultUrl: 'https://openrouter.ai/api/v1', staticModels: ['openai/gpt-5.6-luna', 'anthropic/claude-fable-5', 'google/gemini-3.1-flash', 'deepseek/deepseek-v4-flash'] },
  { id: 'minimax', name: 'Minimax', icon: MinimaxIcon, defaultModel: 'abab7-chat', defaultUrl: 'https://api.minimax.chat/v1', staticModels: ['abab7-chat', 'abab6.5-chat'] },
  { id: 'kimi', name: 'Kimi (Moonshot)', icon: KimiIcon, defaultModel: 'kimi-k3', defaultUrl: 'https://api.moonshot.cn/v1', staticModels: ['kimi-k3', 'kimi-k2.6', 'moonshot-v1-32k'] },
  { id: 'glm', name: 'GLM (Zhipu AI)', icon: GlmIcon, defaultModel: 'glm-5.2', defaultUrl: 'https://open.bigmodel.cn/api/paas/v4', staticModels: ['glm-5.2', 'glm-4.7', 'glm-4-flash'] },
  { id: 'lm-studio', name: 'LM Studio / Local', icon: LocalIcon, defaultModel: 'qwen3.5-instruct', defaultUrl: 'http://localhost:1234/v1', staticModels: ['qwen3.5-instruct', 'translategemma-12b-it'] },
  { id: 'ollama', name: 'Ollama / Local', icon: LocalIcon, defaultModel: 'qwen2.5:7b', defaultUrl: 'http://localhost:11434', staticModels: ['qwen2.5:7b', 'llama3:8b'] },
];

export default function Settings({
  settings,
  onSaveSettings,
  availableModels = [],
  setAvailableModels,
  lang = 'en',
  setLang,
  presets = [],
  activePresetId = '',
  onApplyPreset,
  onSavePreset,
  onDeletePreset
}) {
  const [activeSubTab, setActiveSubTab] = useState('providers'); // 'providers', 'translation', 'global', 'presets'

  const [apiType, setApiType] = useState(settings.apiType || 'openai');
  const [endpoint, setEndpoint] = useState(settings.endpoint);
  const [apiKey, setApiKey] = useState(settings.apiKey || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [appSecret, setAppSecret] = useState(() => localStorage.getItem('tradoc_app_secret') || '');
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
    const saved = localStorage.getItem('tradoc_custom_presets');
    return saved ? JSON.parse(saved) : {};
  });
  
  const [providerConfigs, setProviderConfigs] = useState(() => {
    const saved = localStorage.getItem('tradoc_provider_configs');
    const parsed = saved ? JSON.parse(saved) : {};
    if (settings?.apiType && settings?.apiKey && !parsed[settings.apiType]) {
      parsed[settings.apiType] = {
        endpoint: settings.endpoint,
        apiKey: settings.apiKey,
        model: settings.model,
        concurrency: settings.concurrency,
        chunkSize: settings.chunkSize
      };
    }
    return parsed;
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
  }, [settings]);

  // Trigger auto-detect when apiKey/endpoint changes
  useEffect(() => {
    const isLocalProvider = ['lm-studio', 'ollama'].includes(apiType);
    if (!isLocalProvider && apiKey.length < 6) {
      setFetchedModels([]);
      return;
    }

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
        apiKey,
        model,
        concurrency,
        chunkSize
      }
    };

    // If active settings had an API key for target provider, preserve it
    if (settings?.apiType === prov.id && settings?.apiKey && !updatedConfigs[prov.id]?.apiKey) {
      updatedConfigs[prov.id] = {
        endpoint: settings.endpoint || prov.defaultUrl,
        apiKey: settings.apiKey,
        model: settings.model || prov.defaultModel,
        concurrency: settings.concurrency || 4,
        chunkSize: settings.chunkSize || 1000
      };
    }

    setProviderConfigs(updatedConfigs);
    localStorage.setItem('tradoc_provider_configs', JSON.stringify(updatedConfigs));

    // 2. Load target provider config if saved previously
    const targetConfig = updatedConfigs[prov.id];
    setApiType(prov.id);
    if (targetConfig) {
      setEndpoint(targetConfig.endpoint || prov.defaultUrl);
      setApiKey(targetConfig.apiKey !== undefined ? targetConfig.apiKey : '');
      setModel(targetConfig.model || prov.defaultModel);
      setConcurrency(targetConfig.concurrency !== undefined ? targetConfig.concurrency : (['lm-studio', 'ollama'].includes(prov.id) ? 1 : 4));
      if (targetConfig.chunkSize) setChunkSize(targetConfig.chunkSize);
    } else {
      setEndpoint(prov.defaultUrl);
      setApiKey('');
      setModel(prov.defaultModel);
      setConcurrency(['lm-studio', 'ollama'].includes(prov.id) ? 1 : 4);
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
      if (res.models && res.models.length > 0) {
        setFetchedModels(res.models);
        if (setAvailableModels) setAvailableModels(res.models);
        if (!res.models.includes(model)) {
          setModel(res.models[0]);
        }
      }
    } catch (err) {
      setTestResult({ success: false, message: err.message, models: [] });
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
    const name = newPromptName.trim();
    const updated = { ...customPromptPresets, [name]: systemPrompt };
    setCustomPromptPresets(updated);
    localStorage.setItem('tradoc_custom_presets', JSON.stringify(updated));
    setSelectedPromptKey(name);
    setNewPromptName('');
  };

  const handleDeletePromptPreset = (name) => {
    if (name === 'literary') return;
    const updated = { ...customPromptPresets };
    delete updated[name];
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
      apiKey,
      model,
      sourceLang,
      targetLang,
      concurrency,
      temperature,
      chunkSize,
      systemPrompt,
      enableProofreading,
    };
    if (onSavePreset) onSavePreset(presetObj);
    setNewPresetNameInput('');
  };

  const handleSaveAll = (e) => {
    if (e) e.preventDefault();
    if (appSecret.trim()) {
      localStorage.setItem('tradoc_app_secret', appSecret.trim());
    } else {
      localStorage.removeItem('tradoc_app_secret');
    }

    const updatedConfigs = {
      ...providerConfigs,
      [apiType]: {
        endpoint,
        apiKey,
        model,
        concurrency,
        chunkSize
      }
    };
    setProviderConfigs(updatedConfigs);
    localStorage.setItem('tradoc_provider_configs', JSON.stringify(updatedConfigs));

    onSaveSettings({
      endpoint,
      apiKey,
      apiType,
      model,
      sourceLang,
      targetLang,
      concurrency,
      temperature,
      chunkSize,
      systemPrompt,
      enableProofreading,
    });
    alert(t('settings.saveAllSuccess', lang));
  };

  const availableModelsList = fetchedModels.length > 0 ? fetchedModels : activeProvider.staticModels;
  const filteredModels = availableModelsList.filter(m => 
    m.toLowerCase().includes(modelSearch.toLowerCase())
  );

  const subTabs = [
    { id: 'providers', label: t('settings.tabProviders', lang), icon: Server },
    { id: 'translation', label: t('settings.tabTranslation', lang), icon: Sliders },
    { id: 'global', label: t('settings.tabGlobal', lang), icon: Globe },
    { id: 'presets', label: t('settings.tabPresets', lang), icon: Bookmark },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex items-center space-x-3 border-b border-white/[0.08] pb-4">
        <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white flex items-center justify-center">
          <Server className="w-5 h-5 text-[#60a5fa]" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white tracking-tight">{t('settings.title', lang)}</h1>
          <p className="text-xs text-[#888]">{t('settings.subtitle', lang)}</p>
        </div>
      </div>

      {/* Main Settings Layout with Internal Sidebar Navigation */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
        
        {/* Internal Sub-Navigation Sidebar */}
        <div className="card-chill p-2.5 space-y-1 md:col-span-1">
          {subTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id)}
                className={`w-full flex items-center space-x-3 px-3.5 py-3 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-white/[0.08] text-white font-semibold border border-white/[0.1]'
                    : 'text-[#888] hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#60a5fa]' : 'text-zinc-500'}`} />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Settings Tab Content Area */}
        <div className="md:col-span-3 card-chill p-6 sm:p-8 space-y-6">
          <form onSubmit={handleSaveAll} className="space-y-6">

            {/* TAB 1: PROVIDERS & MODELS */}
            {activeSubTab === 'providers' && (
              <div className="space-y-6">
                <div className="border-b border-white/[0.08] pb-3">
                  <h2 className="text-sm font-semibold text-white flex items-center space-x-2">
                    <Server className="w-4 h-4 text-[#60a5fa]" />
                    <span>{t('settings.tabProviders', lang)}</span>
                  </h2>
                  <p className="text-xs text-[#888] mt-0.5">{t('settings.chooseProvider', lang)}</p>
                </div>

                {/* Grid of Providers */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {PROVIDERS.map((prov) => {
                    const isSelected = apiType === prov.id;
                    const Icon = prov.icon;
                    return (
                      <button
                        key={prov.id}
                        type="button"
                        onClick={() => handleProviderSelect(prov)}
                        className={`p-3.5 rounded-xl border text-center flex flex-col items-center justify-center space-y-2 transition-all ${
                          isSelected
                            ? 'bg-white/[0.08] border-white/[0.18] text-white font-semibold'
                            : 'bg-black/30 border-white/[0.08] text-[#888] hover:text-[#ededed] hover:bg-white/[0.02]'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isSelected ? 'bg-white/[0.08]' : 'bg-white/5'}`}>
                          <Icon />
                        </div>
                        <span className="text-[11px] font-semibold tracking-tight truncate w-full">{prov.name}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Connection Status Banner */}
                {testResult && (
                  <div className={`p-4 rounded-xl border text-xs flex items-start space-x-3 text-zinc-200 ${
                    testResult.success ? 'bg-emerald-500/10 border-emerald-500/20 border-l-4 border-l-emerald-500' : 'bg-rose-500/10 border-rose-500/20 border-l-4 border-l-rose-500'
                  }`}>
                    {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0" />}
                    <div>
                      <p className="font-semibold text-white">{testResult.message}</p>
                      {testResult.models?.length > 0 && (
                        <p className="text-[10px] font-mono mt-1 text-[#00d4aa]">
                          Available models: {testResult.models.slice(0, 8).join(', ')} {testResult.models.length > 8 ? '...' : ''}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Form Parameters */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* API Key */}
                  <div>
                    <label className="block text-[10px] font-semibold text-[#888] uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                      <Key className="w-3.5 h-3.5 text-[#444]" />
                      <span>{t('settings.apiKey', lang)}</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={isLocal ? t('settings.notRequired', lang) : t('settings.apiKeyPlaceholder', lang)}
                        disabled={isLocal && apiType !== 'lm-studio'}
                        className="w-full input-chill px-3 py-2 text-xs font-mono disabled:opacity-40 pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                        title={showApiKey ? "Masquer la clé" : "Afficher la clé"}
                      >
                        {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Model Name Selector */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-semibold text-[#888] uppercase tracking-wider flex items-center justify-between">
                      <span className="flex items-center space-x-1.5">
                        <Cpu className="w-3.5 h-3.5 text-[#444]" />
                        <span>{t('settings.activeModel', lang)}</span>
                      </span>
                      {fetchingModels && (
                        <span className="text-[10px] text-[#60a5fa] font-semibold animate-pulse">{t('settings.detectingModels', lang)}</span>
                      )}
                    </label>

                    <div className="space-y-2">
                      {availableModelsList.length > 5 && (
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
                          <input
                            type="text"
                            value={modelSearch}
                            onChange={(e) => setModelSearch(e.target.value)}
                            placeholder={t('settings.searchModelPlaceholder', lang)}
                            className="w-full input-chill pl-9 pr-3 py-1.5 text-[10px] font-mono border-white/[0.08] bg-[#030303]"
                          />
                        </div>
                      )}
                      
                      <select
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        className="w-full input-chill px-3 py-2 text-xs font-mono"
                      >
                        {!filteredModels.includes(model) && model && (
                          <option value={model}>{model} (Custom)</option>
                        )}
                        {filteredModels.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Endpoint URL */}
                  <div>
                    <label className="block text-[10px] font-semibold text-[#888] uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                      <Link className="w-3.5 h-3.5 text-[#444]" />
                      <span>{t('settings.customEndpoint', lang)}</span>
                    </label>
                    <input
                      type="text"
                      value={endpoint}
                      onChange={(e) => setEndpoint(e.target.value)}
                      disabled={!isLocal}
                      className="w-full input-chill px-3 py-2 text-xs font-mono disabled:opacity-50"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testing}
                    className="btn-chill px-4 py-2 text-xs flex items-center space-x-2"
                  >
                    {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Cpu className="w-3.5 h-3.5" />}
                    <span>{testing ? t('settings.testingConnection', lang) : t('settings.testConnection', lang)}</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: TRANSLATION ENGINE */}
            {activeSubTab === 'translation' && (
              <div className="space-y-6">
                <div className="border-b border-white/[0.08] pb-3">
                  <h2 className="text-sm font-semibold text-white flex items-center space-x-2">
                    <Sliders className="w-4 h-4 text-[#60a5fa]" />
                    <span>{t('settings.tabTranslation', lang)}</span>
                  </h2>
                  <p className="text-xs text-[#888] mt-0.5">Configure default languages, segment sizes, LLM temperature, concurrency, and editorial passes.</p>
                </div>

                {/* Default Languages Configuration Box */}
                <div className="p-4 rounded-xl bg-black/40 border border-white/[0.08] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white uppercase tracking-wider flex items-center space-x-2">
                      <Globe className="w-4 h-4 text-[#60a5fa]" />
                      <span>{lang === 'fr' ? 'Langues de Traduction par Défaut' : 'Default Translation Languages'}</span>
                    </span>
                    <span className="text-[11px] font-mono text-[#60a5fa] font-bold">
                      {sourceLang.toUpperCase()} ➔ {targetLang.toUpperCase()}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 items-center">
                    <div>
                      <label className="block text-[10px] font-semibold text-[#888] uppercase tracking-wider mb-1">
                        {lang === 'fr' ? 'Langue Source par Défaut' : 'Default Source Language'}
                      </label>
                      <select
                        value={sourceLang}
                        onChange={(e) => setSourceLang(e.target.value)}
                        className="w-full input-chill px-3 py-2 text-xs text-zinc-200 cursor-pointer"
                      >
                        {AVAILABLE_LANGUAGES.map((l) => (
                          <option key={l.code} value={l.code}>
                            {l.flag} {lang === 'fr' ? l.label : l.labelEn}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center justify-center sm:pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          if (sourceLang !== 'auto') {
                            const temp = sourceLang;
                            setSourceLang(targetLang);
                            setTargetLang(temp);
                          }
                        }}
                        className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-400 hover:text-white transition-all"
                        title={lang === 'fr' ? 'Inverser les langues' : 'Swap languages'}
                      >
                        <ArrowLeftRight className="w-4 h-4" />
                      </button>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-[#888] uppercase tracking-wider mb-1">
                        {lang === 'fr' ? 'Langue Cible par Défaut' : 'Default Target Language'}
                      </label>
                      <select
                        value={targetLang}
                        onChange={(e) => setTargetLang(e.target.value)}
                        className="w-full input-chill px-3 py-2 text-xs text-zinc-200 cursor-pointer"
                      >
                        {AVAILABLE_LANGUAGES.filter(l => l.code !== 'auto').map((l) => (
                          <option key={l.code} value={l.code}>
                            {l.flag} {lang === 'fr' ? l.label : l.labelEn}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Chunk Size */}
                  <div>
                    <label className="block text-[10px] font-semibold text-[#888] uppercase tracking-wider mb-2">
                      {t('settings.chunkSizeLabel', lang, { count: chunkSize })}
                    </label>
                    <input
                      type="number"
                      min={200}
                      max={15000}
                      step={100}
                      value={chunkSize}
                      onChange={(e) => setChunkSize(parseInt(e.target.value) || 1000)}
                      className="w-full input-chill px-3 py-1.5 text-xs font-mono"
                    />
                    <span className="text-[10px] text-[#666] font-mono mt-1 block">{t('settings.chunkSizeAdvice', lang)}</span>
                  </div>

                  {/* Temperature */}
                  <div>
                    <label className="block text-[10px] font-semibold text-[#888] uppercase tracking-wider mb-2">
                      {t('settings.temperatureLabel', lang, { val: temperature.toFixed(2) })}
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={1.5}
                      step={0.05}
                      value={temperature}
                      onChange={(e) => setTemperature(parseFloat(e.target.value))}
                      className="w-full accent-[#2563eb] mt-2"
                    />
                    <span className="text-[10px] text-[#666] font-mono mt-1 block">{t('settings.temperatureAdvice', lang)}</span>
                  </div>

                  {/* Concurrency */}
                  <div>
                    <label className="block text-[10px] font-semibold text-[#888] uppercase tracking-wider mb-2">
                      {t('settings.concurrencyLabel', lang, { val: concurrency })}
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={16}
                      value={concurrency}
                      onChange={(e) => setConcurrency(parseInt(e.target.value))}
                      className="w-full accent-[#2563eb] mt-2"
                    />
                    <span className="text-[10px] text-[#666] font-mono mt-1 block">{t('settings.concurrencyAdvice', lang)}</span>
                  </div>
                </div>

                {/* Proofreading Toggle */}
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.08] backdrop-blur-md flex items-center justify-between">
                  <div className="space-y-0.5 pr-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-semibold text-white uppercase tracking-wider">{t('settings.proofreadingTitle', lang)}</span>
                      <span className="text-[9px] font-mono text-[#888] bg-white/[0.06] px-1.5 py-0.5 rounded border border-white/[0.08] font-bold">{t('settings.proofreadingBadge', lang)}</span>
                    </div>
                    <p className="text-xs text-[#888]">{t('settings.proofreadingDesc', lang)}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={enableProofreading}
                      onChange={(e) => setEnableProofreading(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2563eb]"></div>
                  </label>
                </div>

                {/* System Prompt Presets & Editor */}
                <div className="space-y-4 pt-4 border-t border-white/[0.08]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <label className="block text-[10px] font-semibold text-[#888] uppercase tracking-wider">{t('settings.systemPromptTitle', lang)}</label>
                      <p className="text-[10px] text-[#666] mt-0.5">{t('settings.systemPromptDesc', lang)}</p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <select
                        value={selectedPromptKey}
                        onChange={(e) => handlePromptPresetChange(e.target.value)}
                        className="input-chill px-3 py-1.5 text-xs text-zinc-200"
                      >
                        <option value="literary">Literary Default Prompt</option>
                        {Object.keys(customPromptPresets).map((k) => (
                          <option key={k} value={k}>{k}</option>
                        ))}
                      </select>

                      {selectedPromptKey !== 'literary' && (
                        <button
                          type="button"
                          onClick={() => handleDeletePromptPreset(selectedPromptKey)}
                          className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg transition-all"
                          title="Delete prompt preset"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <textarea
                    rows={8}
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    className="w-full input-chill p-4 text-xs font-mono leading-relaxed bg-[#030303]"
                  />

                  <div className="flex items-center space-x-3 p-3 bg-white/[0.02] rounded-xl border border-white/[0.08]">
                    <input
                      type="text"
                      value={newPromptName}
                      onChange={(e) => setNewPromptName(e.target.value)}
                      placeholder={t('settings.customPresetName', lang)}
                      className="input-chill px-3 py-1.5 text-xs flex-grow font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleSavePromptPreset}
                      disabled={!newPromptName.trim()}
                      className="btn-chill px-4 py-1.5 text-xs flex items-center space-x-2 disabled:opacity-40"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t('settings.createPresetBtn', lang)}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: GLOBAL SETTINGS & LANGUAGE */}
            {activeSubTab === 'global' && (
              <div className="space-y-6">
                <div className="border-b border-white/[0.08] pb-3">
                  <h2 className="text-sm font-semibold text-white flex items-center space-x-2">
                    <Globe className="w-4 h-4 text-[#60a5fa]" />
                    <span>{t('settings.tabGlobal', lang)}</span>
                  </h2>
                  <p className="text-xs text-[#888] mt-0.5">{t('settings.languageDesc', lang)}</p>
                </div>

                <div className="space-y-4">
                  <label className="block text-[10px] font-semibold text-[#888] uppercase tracking-wider">
                    {t('settings.languageTitle', lang)}
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setLang('en')}
                      className={`p-5 rounded-2xl border flex items-center justify-between text-left transition-all ${
                        lang === 'en'
                          ? 'bg-white/[0.08] border-[#60a5fa] text-white'
                          : 'bg-black/30 border-white/[0.08] text-zinc-400 hover:text-white hover:bg-white/[0.03]'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">🇬🇧</span>
                        <div>
                          <p className="text-xs font-semibold text-white">{t('settings.langEnglish', lang)}</p>
                          <p className="text-[10px] text-zinc-500">Default application language</p>
                        </div>
                      </div>
                      {lang === 'en' && <Check className="w-4 h-4 text-[#60a5fa]" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setLang('fr')}
                      className={`p-5 rounded-2xl border flex items-center justify-between text-left transition-all ${
                        lang === 'fr'
                          ? 'bg-white/[0.08] border-[#60a5fa] text-white'
                          : 'bg-black/30 border-white/[0.08] text-zinc-400 hover:text-white hover:bg-white/[0.03]'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">🇫🇷</span>
                        <div>
                          <p className="text-xs font-semibold text-white">{t('settings.langFrench', lang)}</p>
                          <p className="text-[10px] text-zinc-500">Interface entièrement traduite en Français</p>
                        </div>
                      </div>
                      {lang === 'fr' && <Check className="w-4 h-4 text-[#60a5fa]" />}
                    </button>
                  </div>
                </div>

                {/* Security & Authentication Box */}
                <div className="pt-6 border-t border-white/[0.08] space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-white uppercase tracking-wider flex items-center space-x-2">
                      <Lock className="w-4 h-4 text-[#60a5fa]" />
                      <span>{lang === 'fr' ? 'Sécurité & Jeton d\'Authentification App' : 'Security & App Token Authentication'}</span>
                    </label>
                    <p className="text-[11px] text-[#888] mt-1">
                      {lang === 'fr' 
                        ? 'Si la variable APP_SECRET est configurée sur votre serveur Docker, entrez votre mot de passe secret ci-dessous pour autoriser les requêtes API.'
                        : 'If APP_SECRET is configured on your Docker server, enter your secret token below to authorize API requests.'}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-black/40 border border-white/[0.08] space-y-3">
                    <label className="block text-[10px] font-semibold text-[#888] uppercase tracking-wider">
                      {lang === 'fr' ? 'Clé Secrète de l\'Application (X-App-Secret)' : 'Application Secret Token (X-App-Secret)'}
                    </label>
                    <input
                      type="password"
                      value={appSecret}
                      onChange={(e) => setAppSecret(e.target.value)}
                      placeholder={lang === 'fr' ? 'Ex: MonSecretUltraSecurise2026' : 'Ex: MySuperSecretToken2026'}
                      className="w-full input-chill px-3 py-2 text-xs font-mono"
                    />
                    <span className="text-[10px] text-zinc-500 block">
                      {lang === 'fr' 
                        ? 'Ce jeton est stocké localement et envoyé dans les en-têtes HTTP de chaque requête vers le conteneur TraDoc.'
                        : 'This token is stored locally and sent in HTTP headers for each request to your TraDoc container.'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: CONFIG PRESETS MANAGER */}
            {activeSubTab === 'presets' && (
              <div className="space-y-6">
                <div className="border-b border-white/[0.08] pb-3">
                  <h2 className="text-sm font-semibold text-white flex items-center space-x-2">
                    <Bookmark className="w-4 h-4 text-[#60a5fa]" />
                    <span>{t('settings.presetsManagerTitle', lang)}</span>
                  </h2>
                  <p className="text-xs text-[#888] mt-0.5">{t('settings.presetsManagerDesc', lang)}</p>
                </div>

                {/* Create New Preset Form */}
                <div className="p-4 bg-white/[0.02] border border-white/[0.08] rounded-xl space-y-3">
                  <label className="block text-[10px] font-semibold text-[#888] uppercase tracking-wider">
                    {t('settings.saveCurrentAsPreset', lang)}
                  </label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="text"
                      value={newPresetNameInput}
                      onChange={(e) => setNewPresetNameInput(e.target.value)}
                      placeholder={t('settings.presetNamePlaceholder', lang)}
                      className="input-chill px-3 py-2 text-xs flex-1 font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleSaveConfigPreset}
                      disabled={!newPresetNameInput.trim()}
                      className="btn-chill px-4 py-2 text-xs flex items-center space-x-2 disabled:opacity-40"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t('settings.savePresetBtn', lang)}</span>
                    </button>
                  </div>
                </div>

                {/* List of Saved Presets */}
                <div className="space-y-3">
                  <label className="block text-[10px] font-semibold text-[#888] uppercase tracking-wider">
                    {t('settings.savedPresetsList', lang)}
                  </label>

                  <div className="grid grid-cols-1 gap-3">
                    {presets.map((preset) => {
                      const isActive = activePresetId === preset.id;
                      return (
                        <div
                          key={preset.id}
                          className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
                            isActive
                              ? 'bg-white/[0.06] border-[#60a5fa]/40 text-white'
                              : 'bg-black/30 border-white/[0.08] text-zinc-300'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-semibold text-xs text-white">{preset.name}</span>
                              {isActive && (
                                <span className="text-[9px] font-mono text-[#60a5fa] bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 font-bold">
                                  {t('settings.activeBadge', lang)}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] font-mono text-zinc-500">
                              Provider: <span className="text-zinc-300">{preset.apiType}</span> | Model: <span className="text-zinc-300">{preset.model}</span> | Concurrency: <span className="text-zinc-300">{preset.concurrency}</span>
                            </p>
                          </div>

                          <div className="flex items-center space-x-2">
                            {!isActive && (
                              <button
                                type="button"
                                onClick={() => onApplyPreset && onApplyPreset(preset.id)}
                                className="btn-chill px-3 py-1.5 text-xs flex items-center space-x-1.5"
                              >
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span>{t('settings.activatePresetBtn', lang)}</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(t('settings.confirmDeletePreset', lang, { name: preset.name }))) {
                                  if (onDeletePreset) onDeletePreset(preset.id);
                                }
                              }}
                              className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg transition-all"
                              title={t('settings.deletePresetBtn', lang)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            )}

            {/* Bottom Save All Bar */}
            <div className="flex justify-end pt-4 border-t border-white/[0.08]">
              <button
                type="submit"
                className="btn-orange px-6 py-2.5 text-xs flex items-center space-x-2 shadow-none"
              >
                <Save className="w-4 h-4 fill-white" />
                <span>{t('settings.saveAllSettings', lang)}</span>
              </button>
            </div>

          </form>
        </div>

      </div>

    </div>
  );
}
