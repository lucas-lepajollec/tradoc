import React, { useState, useEffect, useCallback } from 'react';
import DemoExperience from './components/DemoExperience';
import TopBar from './components/TopBar';
import Dashboard from './components/Dashboard';
import JobsInspector from './components/JobsInspector';
import Settings from './components/Settings';
import GlossaryManager from './components/GlossaryManager';
import TestSandboxModal from './components/TestSandboxModal';
import SetupWizard from './components/SetupWizard';
import { fetchInterfaceSettings, isDemoMode, saveInterfaceLanguage, testConnection } from './api';
import { INTERFACE_LANGUAGES, l, t } from './i18n/translations';
import { sanitizePersistedPreset, sanitizePersistedSettings } from './utils/persistence';

const DEFAULT_PRESETS = [];

const parseStoredArray = (key) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    const sanitized = Array.isArray(parsed) ? parsed.map(sanitizePersistedPreset) : [];
    localStorage.setItem(key, JSON.stringify(sanitized));
    return sanitized;
  } catch {
    localStorage.removeItem(key);
    return [];
  }
};

export default function App() {
  const [settingsInitialTab] = useState('providers');
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('tradoc_active_tab') || 'dashboard';
  });

  const handleSetActiveTab = (tab) => {
    setActiveTab(tab);
    localStorage.setItem('tradoc_active_tab', tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const [selectedJobId, setSelectedJobId] = useState(() => localStorage.getItem('tradoc_selected_job_id') || null);
  const handleSelectJob = useCallback((jobId) => {
    setSelectedJobId(jobId || null);
    if (jobId) localStorage.setItem('tradoc_selected_job_id', jobId);
    else localStorage.removeItem('tradoc_selected_job_id');
  }, []);

  // App Language State (Default English)
  const [lang, setLang] = useState(() => {
    const requestedLang = new URLSearchParams(window.location.search).get('lang');
    if (INTERFACE_LANGUAGES.includes(requestedLang)) return requestedLang;
    if (isDemoMode) {
      const savedLang = localStorage.getItem('tradoc_lang');
      if (INTERFACE_LANGUAGES.includes(savedLang)) return savedLang;
    }
    return 'en';
  });

  const handleSetLang = (newLang) => {
    if (!INTERFACE_LANGUAGES.includes(newLang)) return;
    setLang(newLang);
    if (isDemoMode) {
      localStorage.setItem('tradoc_lang', newLang);
      return;
    }
    saveInterfaceLanguage(newLang).catch(() => {
      fetchInterfaceSettings()
        .then(({ language }) => {
          if (INTERFACE_LANGUAGES.includes(language)) setLang(language);
        })
        .catch(() => setLang('en'));
    });
  };

  useEffect(() => {
    if (isDemoMode) localStorage.setItem('tradoc_lang', lang);
    document.documentElement.lang = lang;
    document.title = t('meta.title', lang);
    document.querySelector('meta[name="description"]')?.setAttribute('content', t('meta.description', lang));
  }, [lang]);

  useEffect(() => {
    const requestedLang = new URLSearchParams(window.location.search).get('lang');
    if (isDemoMode || INTERFACE_LANGUAGES.includes(requestedLang)) return;
    fetchInterfaceSettings()
      .then(({ language }) => {
        if (INTERFACE_LANGUAGES.includes(language)) setLang(language);
      })
      .catch(() => {});
  }, []);

  // Appearance is a per-browser preference: follow the system or force a theme.
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('tradoc_theme');
      return ['light', 'dark'].includes(saved) ? saved : 'system';
    } catch {
      return 'system';
    }
  });

  useEffect(() => {
    if (theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
  }, [theme]);

  const handleSetTheme = (nextTheme) => {
    const value = ['light', 'dark'].includes(nextTheme) ? nextTheme : 'system';
    setTheme(value);
    try {
      if (value === 'system') localStorage.removeItem('tradoc_theme');
      else localStorage.setItem('tradoc_theme', value);
    } catch {
      // The preference still applies for this session.
    }
  };

  // Presets Management State
  const [presets, setPresets] = useState(() => {
    return parseStoredArray('tradoc_presets').length ? parseStoredArray('tradoc_presets') : DEFAULT_PRESETS;
  });

  const [activePresetId, setActivePresetId] = useState(() => {
    return localStorage.getItem('tradoc_active_preset_id') || '';
  });
  
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('tradoc_settings');
    const proofreadingOptInMigrationKey = 'tradoc_proofreading_opt_in_v1';
    const defaults = {
      endpoint: 'https://api.openai.com/v1',
      apiKey: '',
      apiType: 'openai',
      model: 'gpt-4o',
      sourceLang: 'en',
      targetLang: 'fr',
      concurrency: 4,
      temperature: 0.15,
      chunkSize: 6000,
      systemPrompt: '',
      enableProofreading: false,
      enablePromptCaching: false
    };
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        let safe = sanitizePersistedSettings(parsed);
        // This option used to default to true while the backend ignored it.
        // It now performs a real second LLM pass, so require an explicit opt-in.
        if (localStorage.getItem(proofreadingOptInMigrationKey) !== 'done') {
          safe = { ...safe, enableProofreading: false };
          localStorage.setItem(proofreadingOptInMigrationKey, 'done');
        }
        localStorage.setItem('tradoc_settings', JSON.stringify(safe));
        return { ...defaults, ...safe, apiKey: '' };
      } catch (e) {
        console.error("Failed to parse saved settings", e);
      }
    }
    localStorage.setItem(proofreadingOptInMigrationKey, 'done');
    return defaults;
  });

  const [endpointStatus, setEndpointStatus] = useState(false);
  const [availableModels, setAvailableModels] = useState([]);

  useEffect(() => {
    checkEndpointHealth();
  }, [settings.endpoint, settings.apiKey, settings.apiType]);

  const checkEndpointHealth = async () => {
    try {
      const res = await testConnection(settings.endpoint, settings.apiKey, settings.apiType);
      if (res.success) {
        setEndpointStatus(true);
        if (res.models && res.models.length > 0) {
          setAvailableModels(res.models);
        }
        return;
      }
    } catch (e) {
      console.error('Endpoint health check failed:', e);
    }
    setEndpointStatus(false);
  };

  // Auto-match activePresetId with current settings
  useEffect(() => {
    if (!settings || presets.length === 0) {
      setActivePresetId('');
      localStorage.removeItem('tradoc_active_preset_id');
      return;
    }
    const matched = presets.find((p) => (
      p.apiType === settings.apiType &&
      p.endpoint === settings.endpoint &&
      p.model === settings.model &&
      p.concurrency === settings.concurrency &&
      p.chunkSize === settings.chunkSize
    ));
    if (matched) {
      setActivePresetId(matched.id);
      localStorage.setItem('tradoc_active_preset_id', matched.id);
    } else {
      setActivePresetId('');
      localStorage.removeItem('tradoc_active_preset_id');
    }
  }, [settings, presets]);

  const updateSettings = (newSettings) => {
    setSettings(newSettings);
    localStorage.setItem('tradoc_settings', JSON.stringify(sanitizePersistedSettings(newSettings)));

    testConnection(newSettings.endpoint, newSettings.apiKey, newSettings.apiType)
      .then(res => {
        if (res.success) {
          setEndpointStatus(true);
          if (res.models && res.models.length > 0) setAvailableModels(res.models);
        } else {
          setEndpointStatus(false);
        }
      })
      .catch(() => setEndpointStatus(false));
  };

  // Apply a selected Preset globally
  const handleApplyPreset = (presetId) => {
    if (!presetId) {
      setActivePresetId('');
      localStorage.removeItem('tradoc_active_preset_id');
      return;
    }
    const target = presets.find(p => p.id === presetId);
    if (!target) return;
    setActivePresetId(presetId);
    localStorage.setItem('tradoc_active_preset_id', presetId);

    const newSettings = {
      ...settings,
      apiType: target.apiType,
      endpoint: target.endpoint,
      model: target.model,
      concurrency: target.concurrency || 1,
      temperature: target.temperature !== undefined ? target.temperature : 0.15,
      chunkSize: target.chunkSize || 1000,
      enableProofreading: !!target.enableProofreading,
      enablePromptCaching: !!target.enablePromptCaching,
      systemPrompt: target.systemPrompt || settings.systemPrompt,
    };
    updateSettings(newSettings);
  };

  const handleSavePreset = (presetObj) => {
    let updated;
    const existingIndex = presets.findIndex(p => p.id === presetObj.id);
    if (existingIndex >= 0) {
      updated = [...presets];
      updated[existingIndex] = sanitizePersistedPreset(presetObj);
    } else {
      updated = [...presets, sanitizePersistedPreset(presetObj)];
    }
    setPresets(updated);
    localStorage.setItem('tradoc_presets', JSON.stringify(updated));
    setActivePresetId(presetObj.id);
    localStorage.setItem('tradoc_active_preset_id', presetObj.id);
  };

  const handleDeletePreset = (presetId) => {
    const updated = presets.filter(p => p.id !== presetId);
    setPresets(updated);
    localStorage.setItem('tradoc_presets', JSON.stringify(updated));
    if (activePresetId === presetId && updated.length > 0) {
      handleApplyPreset(updated[0].id);
    }
  };

  const handleSelectModel = (newModel) => {
    const updated = { ...settings, model: newModel };
    updateSettings(updated);
  };

  return (
    <div className="min-h-screen bg-bg text-fg">
      <TopBar
        activeTab={activeTab}
        setActiveTab={handleSetActiveTab}
        endpointStatus={endpointStatus}
        lang={lang}
        presets={presets}
        activePresetId={activePresetId}
        onSelectPreset={handleApplyPreset}
        currentModel={settings.model}
        availableModels={availableModels}
        onSelectModel={handleSelectModel}
      />

        {/* Main Body */}
        <main>
          {activeTab === 'dashboard' && (
          <div>
            <Dashboard
              onSelectJob={handleSelectJob}
              settings={settings}
              endpointStatus={endpointStatus}
              availableModels={availableModels}
              setActiveTab={handleSetActiveTab}
              lang={lang}
              onSelectModel={handleSelectModel}
            />
          </div>
          )}

          {activeTab === 'jobs' && (
          <div>
            <JobsInspector
              selectedJobId={selectedJobId}
              onSelectJob={handleSelectJob}
              settings={settings}
              availableModels={availableModels}
              lang={lang}
              onSelectModel={handleSelectModel}
            />
          </div>
          )}

          {activeTab === 'sandbox' && (
          <div>
            <TestSandboxModal settings={settings} availableModels={availableModels} lang={lang} onSelectModel={handleSelectModel} />
          </div>
          )}

          {activeTab === 'wizard' && (
          <div>
            <SetupWizard settings={settings} onSaveSettings={updateSettings} setActiveTab={handleSetActiveTab} lang={lang} />
          </div>
          )}

          {activeTab === 'settings' && (
          <div>
            <Settings
              initialSubTab={settingsInitialTab}
              settings={settings}
              onSaveSettings={updateSettings}
              endpointStatus={endpointStatus}
              availableModels={availableModels}
              setAvailableModels={setAvailableModels}
              lang={lang}
              setLang={handleSetLang}
              theme={theme}
              setTheme={handleSetTheme}
              presets={presets}
              activePresetId={activePresetId}
              onApplyPreset={handleApplyPreset}
              onSavePreset={handleSavePreset}
              onDeletePreset={handleDeletePreset}
            />
          </div>
          )}

          {activeTab === 'glossary' && (
          <div>
            <GlossaryManager lang={lang} />
          </div>
          )}
        </main>

      {isDemoMode && <DemoExperience lang={lang} />}
    </div>
  );
}
