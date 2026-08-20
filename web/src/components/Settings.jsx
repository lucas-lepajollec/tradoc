import React, { useState, useEffect } from 'react';
import { Server, Cpu, Sliders, CheckCircle2, AlertCircle, RefreshCw, Save, Trash2, Plus, Key, Link, Search, Globe, Bookmark, Check, ShieldCheck, ArrowLeftRight, Eye, EyeOff, Lock } from 'lucide-react';
import { testConnection, saveProviderCredentials, setAppSecret } from '../api';
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
  { id: 'openai', name: 'OpenAI', logoUrl: '/providers/openai.png', icon: OpenAiIcon, defaultModel: 'gpt-5.6-luna', defaultUrl: 'https://api.openai.com/v1', staticModels: ['gpt-5.6-sol', 'gpt-5.6-luna', 'gpt-4o', 'o1', 'o3-mini'] },
  { id: 'claude', name: 'Claude (Anthropic)', logoUrl: '/providers/claude.png', icon: ClaudeIcon, defaultModel: 'claude-fable-5', defaultUrl: 'https://api.anthropic.com/v1', staticModels: ['claude-fable-5', 'claude-opus-5', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'] },
  { id: 'gemini', name: 'Gemini (Google)', logoUrl: '/providers/gemini.png', icon: GeminiIcon, defaultModel: 'gemini-3.1-flash', defaultUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/v1', staticModels: ['gemini-3.1-flash', 'gemini-3.1-pro', 'gemini-2.5-flash', 'gemini-2.5-pro'] },
  { id: 'deepseek', name: 'DeepSeek', logoUrl: '/providers/deepseek.png', icon: DeepseekIcon, defaultModel: 'deepseek-chat', defaultUrl: 'https://api.deepseek.com/v1', staticModels: ['deepseek-chat', 'deepseek-reasoner', 'deepseek-v4-flash'] },
  { id: 'openrouter', name: 'OpenRouter', logoUrl: '/providers/openrouter.png', icon: OpenRouterIcon, defaultModel: 'openai/gpt-5.6-luna', defaultUrl: 'https://openrouter.ai/api/v1', staticModels: ['openai/gpt-5.6-luna', 'anthropic/claude-fable-5', 'google/gemini-3.1-flash', 'deepseek/deepseek-v4-flash'] },
  { id: 'minimax', name: 'Minimax', logoUrl: '/providers/minimax.png', icon: MinimaxIcon, defaultModel: 'abab7-chat', defaultUrl: 'https://api.minimax.chat/v1', staticModels: ['abab7-chat', 'abab6.5-chat'] },
  { id: 'kimi', name: 'Kimi (Moonshot)', logoUrl: '/providers/kimi.png', icon: KimiIcon, defaultModel: 'kimi-k3', defaultUrl: 'https://api.moonshot.cn/v1', staticModels: ['kimi-k3', 'kimi-k2.6', 'moonshot-v1-32k'] },
  { id: 'glm', name: 'GLM (Zhipu AI)', logoUrl: '/providers/glm.png', icon: GlmIcon, defaultModel: 'glm-5.2', defaultUrl: 'https://open.bigmodel.cn/api/paas/v4', staticModels: ['glm-5.2', 'glm-4.7', 'glm-4-flash'] },
  { id: 'lm-studio', name: 'LM Studio / Local', logoUrl: '/providers/lmstudio.webp', icon: LocalIcon, defaultModel: 'qwen3.5-instruct', defaultUrl: 'http://localhost:1234/v1', staticModels: ['qwen3.5-instruct', 'translategemma-12b-it'] },
  { id: 'ollama', name: 'Ollama / Local', logoUrl: '/providers/ollama.png', icon: LocalIcon, defaultModel: 'qwen2.5:7b', defaultUrl: 'http://localhost:11434', staticModels: ['qwen2.5:7b', 'llama3:8b'] },
];

export default function Settings({
  initialSubTab = 'providers',
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
  const [activeSubTab, setActiveSubTab] = useState(initialSubTab); // 'providers', 'translation', 'global', 'presets'

  const [apiType, setApiType] = useState(settings.apiType || 'openai');
  const [endpoint, setEndpoint] = useState(settings.endpoint);
  const [apiKey, setApiKey] = useState(settings.apiKey || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [appSecret, setAppSecretValue] = useState(() => sessionStorage.getItem('tradoc_app_secret') || localStorage.getItem('tradoc_app_secret') || '');
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
      const sanitized = Object.fromEntries(Object.entries(parsed).map(([key, value]) => {
        const { apiKey: _removed, ...safe } = value || {};
        return [key, safe];
      }));
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
    localStorage.setItem('tradoc_provider_configs', JSON.stringify(updatedConfigs));

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
    setAppSecret(appSecret);

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
    localStorage.setItem('tradoc_provider_configs', JSON.stringify(updatedConfigs));

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
    { id: 'providers', label: t('settings.tabProviders', lang), icon: Server },
    { id: 'translation', label: t('settings.tabTranslation', lang), icon: Sliders },
    { id: 'global', label: t('settings.tabGlobal', lang), icon: Globe },
    { id: 'presets', label: t('settings.tabPresets', lang), icon: Bookmark },
  ];

  return (
    <div className="settings-page space-y-7">
      
      {/* Header */}
      <header className="page-intro">
        <p className="page-kicker">{lang === 'fr' ? 'Préférences' : 'Preferences'}</p>
        <h1>{t('settings.title', lang)}</h1>
        <p>{t('settings.subtitle', lang)}</p>
      </header>

      {/* Main Settings Layout with Internal Sidebar Navigation */}
      <div className="settings-layout">
        
        {/* Internal Sub-Navigation Sidebar */}
        <div className="settings-tabs flex gap-1 overflow-x-auto p-1.5">
          {subTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id)}
                className={`settings-tab flex-1 min-w-max flex items-center justify-center space-x-2 px-4 py-2.5 rounded-lg text-xs font-medium transition-colors duration-100 outline-none focus:outline-none focus:ring-0 ${
                  isActive
                    ? 'bg-white/[0.08] text-white font-semibold border border-white/[0.12]'
                    : 'text-[#888] hover:text-white hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#60a5fa]' : 'text-zinc-500'}`} />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Settings Tab Content Area */}
        <div className="settings-content card-chill p-6 sm:p-8">
          <form onSubmit={handleSaveAll}>

            {/* TAB 1: PROVIDERS & MODELS */}
            <div className={activeSubTab === 'providers' ? 'space-y-6' : 'hidden'}>
              <div className="border-b border-white/[0.08] pb-3">
                <h2 className="text-sm font-semibold text-white flex items-center space-x-2">
                  <Server className="w-4 h-4 text-[#60a5fa]" />
                  <span>{t('settings.tabProviders', lang)}</span>
                </h2>
                <p className="text-xs text-[#888] mt-0.5">{t('settings.chooseProvider', lang)}</p>
              </div>

              {/* Grid of Providers */}
              <div className="provider-grid">
                {PROVIDERS.map((prov) => {
                  const isSelected = apiType === prov.id;
                  const Icon = prov.icon;
                  return (
                    <button
                      key={prov.id}
                      type="button"
                      onClick={() => handleProviderSelect(prov)}
                      className={`provider-card rounded-xl border transition-colors duration-100 outline-none focus:outline-none focus:ring-0 ${
                        isSelected
                          ? 'bg-white/[0.08] border-white/[0.18] text-white font-semibold'
                          : 'bg-black/30 border-white/[0.08] text-[#888] hover:text-[#ededed] hover:bg-white/[0.02]'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center p-1.5 overflow-hidden ${isSelected ? 'bg-white/[0.12]' : 'bg-white/5'}`}>
                        {prov.logoUrl ? (
                          <img src={prov.logoUrl} alt={prov.name} className="w-5 h-5 object-contain rounded-sm" />
                        ) : (
                          <Icon />
                        )}
                      </div>
                      <span className="provider-name text-[11px] font-semibold tracking-tight w-full">{prov.name}</span>
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
                  {!isLocal && <p className="mt-1.5 text-[10px] text-[#666]">{lang === 'fr' ? 'Laissez vide pour réutiliser la clé déjà stockée côté serveur.' : 'Leave blank to reuse the key already stored on the server.'}</p>}
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

              <div className="local-model-detection-note">
                <RefreshCw />
                <div>
                  <strong>{lang === 'fr' ? 'Détection automatique des modèles' : 'Automatic model detection'}</strong>
                  <span>{isLocal
                    ? (lang === 'fr' ? 'Renseignez l’endpoint de votre serveur local : TraDoc détectera automatiquement les modèles disponibles.' : 'Enter your local server endpoint and TraDoc will automatically detect the available models.')
                    : (lang === 'fr' ? 'Renseignez votre clé API : TraDoc détectera automatiquement les modèles Cloud disponibles.' : 'Enter your API key and TraDoc will automatically detect the available Cloud models.')}
                  </span>
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

            {/* TAB 2: TRANSLATION ENGINE */}
            <div className={activeSubTab === 'translation' ? 'space-y-6' : 'hidden'}>
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
                    type="range"
                    min={200}
                    max={10000}
                    step={100}
                    value={chunkSize}
                    onChange={(e) => setChunkSize(parseInt(e.target.value, 10))}
                    className="w-full accent-[#2563eb] mt-2"
                  />
                  <div className="segment-size-advice">
                    <span><i />Local : 500–2 500 <b>1 000 recommandé</b></span>
                    <span><i />Cloud : 2 500–10 000 <b>7 000 recommandé</b></span>
                  </div>
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
              <button type="button" role="switch" aria-checked={enableProofreading} className={`proofreading-toggle-compact ${enableProofreading ? 'is-active' : ''}`} onClick={() => setEnableProofreading(!enableProofreading)}>
                <span className="proofreading-toggle-copy">
                  <strong>{lang === 'fr' ? 'Relecture éditoriale' : 'Editorial proofreading'}</strong>
                  <small>{lang === 'fr' ? 'Deuxième passe automatique (2 appels par segment)' : 'Automatic second pass (2 calls per segment)'}</small>
                </span>
                <span className="proofreading-toggle-status">{enableProofreading ? (lang === 'fr' ? 'Activée' : 'Enabled') : (lang === 'fr' ? 'Désactivée' : 'Disabled')}</span>
                <span className="proofreading-switch"><i /></span>
              </button>

              {/* System Prompt Presets */}
              <div className="space-y-3 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="block text-[10px] font-semibold text-[#888] uppercase tracking-wider">
                    {t('settings.systemPromptTitle', lang)}
                  </label>
                  
                  <div className="flex items-center space-x-2">
                    <select
                      value={selectedPromptKey}
                      onChange={(e) => handlePromptPresetChange(e.target.value)}
                      className="input-chill px-3 py-1 text-xs text-zinc-200"
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
                        className="p-1 text-[#ff6369] hover:bg-rose-500/10 rounded transition-colors"
                        title={t('settings.deletePresetBtn', lang)}
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

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 p-3 bg-white/[0.02] rounded-xl border border-white/[0.08]">
                  <input
                    type="text"
                    value={newPromptName}
                    onChange={(e) => setNewPromptName(e.target.value)}
                    placeholder={t('settings.customPresetName', lang)}
                    className="input-chill px-3 py-1.5 text-xs flex-1 font-mono w-full"
                  />
                  <button
                    type="button"
                    onClick={handleSavePromptPreset}
                    disabled={!newPromptName.trim()}
                    className="btn-chill px-4 py-2 sm:py-1.5 text-xs flex items-center justify-center space-x-2 disabled:opacity-40 w-full sm:w-auto"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t('settings.createPresetBtn', lang)}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* TAB 3: GLOBAL SETTINGS & LANGUAGE */}
            <div className={activeSubTab === 'global' ? 'settings-global-panel' : 'hidden'}>
              <div className="settings-section-heading">
                <span className="settings-section-heading-icon"><Globe /></span>
                <div>
                  <h2>{t('settings.tabGlobal', lang)}</h2>
                  <p>{t('settings.languageDesc', lang)}</p>
                </div>
              </div>

              <section className="global-settings-section">
                <div className="global-section-copy">
                  <div>
                    <span className="section-eyebrow">Interface</span>
                    <h3>{t('settings.languageTitle', lang)}</h3>
                    <p>{lang === 'fr' ? 'Choisissez la langue utilisée dans toute l’application.' : 'Choose the language used throughout the application.'}</p>
                  </div>
                </div>
                <div className="language-choice-grid">
                  <button type="button" onClick={() => setLang('en')} className={`language-choice ${lang === 'en' ? 'is-selected' : ''}`}>
                    <span className="language-code">EN</span>
                    <span className="language-copy"><strong>{t('settings.langEnglish', lang)}</strong><small>English interface</small></span>
                    <span className="language-radio" aria-hidden="true"><i /></span>
                  </button>
                  <button type="button" onClick={() => setLang('fr')} className={`language-choice ${lang === 'fr' ? 'is-selected' : ''}`}>
                    <span className="language-code">FR</span>
                    <span className="language-copy"><strong>{t('settings.langFrench', lang)}</strong><small>Interface en français</small></span>
                    <span className="language-radio" aria-hidden="true"><i /></span>
                  </button>
                </div>
              </section>

              <section className="global-settings-section security-settings-section">
                <div className="global-section-copy">
                  <span className="global-section-icon"><Lock /></span>
                  <div>
                    <span className="section-eyebrow">{lang === 'fr' ? 'Sécurité' : 'Security'}</span>
                    <h3>{lang === 'fr' ? 'Jeton d’application' : 'Application token'}</h3>
                    <p>{lang === 'fr' ? 'Renseignez ce champ uniquement si APP_SECRET est activé sur votre serveur.' : 'Only fill this field when APP_SECRET is enabled on your server.'}</p>
                  </div>
                </div>
                <label className="secret-field">
                  <span>{lang === 'fr' ? 'Clé secrète' : 'Secret token'} <small>X-App-Secret</small></span>
                  <input type="password" value={appSecret} onChange={(e) => setAppSecretValue(e.target.value)} placeholder={lang === 'fr' ? 'Saisissez votre jeton' : 'Enter your token'} className="input-chill font-mono" />
                  <p>{lang === 'fr' ? 'Stocké localement puis envoyé avec chaque requête adressée à TraDoc.' : 'Stored locally and sent with every request made to TraDoc.'}</p>
                </label>
              </section>
            </div>

            {/* TAB 4: CONFIG PRESETS MANAGER */}
            <div className={activeSubTab === 'presets' ? 'settings-presets-panel' : 'hidden'}>
              <div className="settings-section-heading">
                <span className="settings-section-heading-icon"><Bookmark /></span>
                <div>
                  <h2>{t('settings.presetsManagerTitle', lang)}</h2>
                  <p>{t('settings.presetsManagerDesc', lang)}</p>
                </div>
              </div>

              <section className="preset-create-card">
                <span className="preset-create-icon"><Plus /></span>
                <div className="preset-create-copy">
                  <strong>{lang === 'fr' ? 'Enregistrer la configuration actuelle' : 'Save the current configuration'}</strong>
                  <p>{lang === 'fr' ? 'Créez un raccourci avec le fournisseur, le modèle et les réglages actifs.' : 'Create a shortcut with the active provider, model and settings.'}</p>
                </div>
                <div className="preset-create-controls">
                  <input type="text" value={newPresetNameInput} onChange={(e) => setNewPresetNameInput(e.target.value)} placeholder={t('settings.presetNamePlaceholder', lang)} className="input-chill" />
                  <button type="button" onClick={handleSaveConfigPreset} disabled={!newPresetNameInput.trim()} className="btn-chill">
                    <Plus /><span>{t('settings.savePresetBtn', lang)}</span>
                  </button>
                </div>
              </section>

              <section className="preset-library">
                <div className="preset-library-heading">
                  <div><span className="section-eyebrow">{lang === 'fr' ? 'Bibliothèque' : 'Library'}</span><h3>{t('settings.savedPresetsList', lang)}</h3></div>
                  <span className="preset-count">{presets.length}</span>
                </div>

                <div className="preset-card-grid">
                  {presets.length === 0 && (
                    <div className="preset-empty-state">
                      <Bookmark />
                      <strong>{lang === 'fr' ? 'Aucun preset enregistré' : 'No saved presets'}</strong>
                      <p>{lang === 'fr' ? 'Donnez un nom à la configuration actuelle pour la retrouver ici.' : 'Name the current configuration to find it here.'}</p>
                    </div>
                  )}
                  {presets.map((preset) => {
                    const isActive = activePresetId === preset.id;
                    return (
                      <article key={preset.id} className={`settings-preset-card ${isActive ? 'is-active' : ''}`}>
                        <header>
                          <div><small>Configuration</small><strong title={preset.name}>{preset.name}</strong></div>
                          <span className={`preset-state ${isActive ? 'is-active' : ''}`}><i />{isActive ? t('settings.activeBadge', lang) : (lang === 'fr' ? 'Disponible' : 'Available')}</span>
                        </header>
                        <dl>
                          <div><dt>{lang === 'fr' ? 'Fournisseur' : 'Provider'}</dt><dd>{preset.apiType || '—'}</dd></div>
                          <div><dt>{lang === 'fr' ? 'Modèle' : 'Model'}</dt><dd title={preset.model}>{preset.model || '—'}</dd></div>
                          <div><dt>{lang === 'fr' ? 'Concurrence' : 'Concurrency'}</dt><dd>{preset.concurrency ?? '—'}</dd></div>
                          <div><dt>{lang === 'fr' ? 'Segment' : 'Chunk'}</dt><dd>{preset.chunkSize || 1000} tokens</dd></div>
                        </dl>
                        <footer>
                          {!isActive ? (
                            <button type="button" onClick={() => onApplyPreset && onApplyPreset(preset.id)} className="preset-activate-button"><Check /><span>{t('settings.activatePresetBtn', lang)}</span></button>
                          ) : <span className="preset-active-copy"><Check />{lang === 'fr' ? 'Preset utilisé' : 'Preset in use'}</span>}
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(t('settings.confirmDeletePreset', lang, { name: preset.name }))) {
                                if (onDeletePreset) onDeletePreset(preset.id);
                              }
                            }}
                            className="preset-delete-button"
                            title={t('settings.deletePresetBtn', lang)}
                          >
                            <Trash2 />
                          </button>
                        </footer>
                      </article>
                    );
                  })}
                </div>
              </section>
            </div>

            {/* Bottom Save All Bar */}
            <div className="flex justify-end pt-4 border-t border-white/[0.08] mt-6">
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
