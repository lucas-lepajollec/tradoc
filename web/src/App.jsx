import React, { useState, useEffect, useCallback } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import JobsInspector from './components/JobsInspector';
import Settings from './components/Settings';
import GlossaryManager from './components/GlossaryManager';
import TestSandboxModal from './components/TestSandboxModal';
import SetupWizard from './components/SetupWizard';
import { testConnection } from './api';
import { t } from './i18n/translations';

const DEFAULT_PRESETS = [];

const withoutSecrets = (value) => {
  if (!value || typeof value !== 'object') return value;
  const { apiKey, ...safe } = value;
  return safe;
};

const parseStoredArray = (key) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    const sanitized = Array.isArray(parsed) ? parsed.map(withoutSecrets) : [];
    localStorage.setItem(key, JSON.stringify(sanitized));
    return sanitized;
  } catch {
    localStorage.removeItem(key);
    return [];
  }
};

export default function App() {
  const [settingsInitialTab, setSettingsInitialTab] = useState('providers');
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const showAuthenticationSettings = () => {
      setSettingsInitialTab('global');
      setActiveTab('settings');
      localStorage.setItem('tradoc_active_tab', 'settings');
    };
    window.addEventListener('tradoc:auth-required', showAuthenticationSettings);
    return () => window.removeEventListener('tradoc:auth-required', showAuthenticationSettings);
  }, []);

  // App Language State (Default English)
  const [lang, setLang] = useState(() => {
    const savedLang = localStorage.getItem('tradoc_lang');
    return savedLang || 'en';
  });

  const handleSetLang = (newLang) => {
    setLang(newLang);
    localStorage.setItem('tradoc_lang', newLang);
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
        let safe = withoutSecrets(parsed);
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
    localStorage.setItem('tradoc_settings', JSON.stringify(withoutSecrets(newSettings)));

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
      updated[existingIndex] = withoutSecrets(presetObj);
    } else {
      updated = [...presets, withoutSecrets(presetObj)];
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
    <div className="app-shell min-h-screen flex text-[#e8e6df] font-sans relative overflow-x-hidden selection:bg-blue-500/20 selection:text-white">
      
      {/* Ambient Subtle Background Halo Orbs */}
      <div className="halo-bg-1" />
      <div className="halo-bg-2" />

      {/* Fixed Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleSetActiveTab}
        endpointStatus={endpointStatus}
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        lang={lang}
        presets={presets}
        activePresetId={activePresetId}
        onSelectPreset={handleApplyPreset}
        currentModel={settings.model}
        availableModels={availableModels}
        onSelectModel={handleSelectModel}
      />

      {/* Main Right Content Area */}
      <div className="flex-1 min-w-0 min-h-screen flex flex-col z-10 lg:pl-[272px]">
        
        {/* Mobile Header Bar (Sans démarcation) */}
        <div className="mobile-header lg:hidden flex items-center justify-between px-5 py-4 sticky top-0 z-30">
          <div className="flex items-center space-x-2.5">
            <img src="/logo.svg" alt="TraDoc Logo" className="w-7 h-7 rounded-lg border border-white/[0.08]" />
            <span className="font-semibold text-sm text-white tracking-tight">
              {activeTab === 'dashboard' && t('nav.projects', lang)}
              {activeTab === 'jobs' && t('nav.inspector', lang)}
              {activeTab === 'wizard' && t('nav.vram', lang)}
              {activeTab === 'sandbox' && t('nav.sandbox', lang)}
              {activeTab === 'glossary' && t('nav.glossaries', lang)}
              {activeTab === 'settings' && t('nav.settings', lang)}
            </span>
          </div>

          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 bg-white/[0.04] hover:bg-white/[0.08] text-white rounded-xl border border-white/[0.08] transition-colors"
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {/* Main Body */}
        <main className="workspace w-full max-w-[1380px] mx-auto px-4 sm:px-7 lg:px-9 pt-5 sm:pt-8 lg:pt-12 pb-14 lg:pb-20">
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

      </div>

    </div>
  );
}
