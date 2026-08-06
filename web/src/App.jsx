import React, { useState, useEffect } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import JobsInspector from './components/JobsInspector';
import Settings from './components/Settings';
import GlossaryManager from './components/GlossaryManager';
import TestSandboxModal from './components/TestSandboxModal';
import SetupWizard from './components/SetupWizard';
import { testConnection, updateJobConfig } from './api';
import { t } from './i18n/translations';

const DEFAULT_PRESETS = [];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    const saved = localStorage.getItem('tradoc_presets');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse presets:', e);
      }
    }
    return DEFAULT_PRESETS;
  });

  const [activePresetId, setActivePresetId] = useState(() => {
    return localStorage.getItem('tradoc_active_preset_id') || '';
  });
  
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('tradoc_settings');
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
      enableProofreading: true
    };
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...defaults, ...parsed };
      } catch (e) {
        console.error("Failed to parse saved settings", e);
      }
    }
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
    localStorage.setItem('tradoc_settings', JSON.stringify(newSettings));

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
      apiKey: target.apiKey !== undefined ? target.apiKey : settings.apiKey,
      model: target.model,
      concurrency: target.concurrency || 1,
      temperature: target.temperature !== undefined ? target.temperature : 0.15,
      chunkSize: target.chunkSize || 1000,
      enableProofreading: !!target.enableProofreading,
      systemPrompt: target.systemPrompt || settings.systemPrompt,
    };
    updateSettings(newSettings);
  };

  const handleSavePreset = (presetObj) => {
    let updated;
    const existingIndex = presets.findIndex(p => p.id === presetObj.id);
    if (existingIndex >= 0) {
      updated = [...presets];
      updated[existingIndex] = presetObj;
    } else {
      updated = [...presets, presetObj];
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
    <div className="min-h-screen flex bg-black text-[#ededed] font-sans relative overflow-x-hidden selection:bg-white/10 selection:text-white">
      
      {/* Ambient Subtle Background Halo Orbs */}
      <div className="halo-bg-1" />
      <div className="halo-bg-2" />

      {/* Fixed Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        endpointStatus={endpointStatus}
        endpointUrl={settings.endpoint}
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
      <div className="flex-1 min-w-0 min-h-screen flex flex-col z-10 lg:pl-60">
        
        {/* Mobile Header Bar (Sans démarcation) */}
        <div className="lg:hidden flex items-center justify-between px-6 pt-5 pb-1">
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
        <main className="w-full max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-10 pt-4 sm:pt-6 lg:pt-16 pb-14 lg:pb-20">
          <div className={activeTab === 'dashboard' ? 'block' : 'hidden'}>
            <Dashboard
              onSelectJob={setSelectedJobId}
              settings={settings}
              endpointStatus={endpointStatus}
              availableModels={availableModels}
              setActiveTab={setActiveTab}
              lang={lang}
              onSelectModel={handleSelectModel}
            />
          </div>

          <div className={activeTab === 'jobs' ? 'block' : 'hidden'}>
            <JobsInspector
              selectedJobId={selectedJobId}
              onSelectJob={setSelectedJobId}
              settings={settings}
              availableModels={availableModels}
              lang={lang}
              onSelectModel={handleSelectModel}
            />
          </div>

          <div className={activeTab === 'sandbox' ? 'block' : 'hidden'}>
            <TestSandboxModal settings={settings} availableModels={availableModels} lang={lang} onSelectModel={handleSelectModel} />
          </div>

          <div className={activeTab === 'wizard' ? 'block' : 'hidden'}>
            <SetupWizard lang={lang} />
          </div>

          <div className={activeTab === 'settings' ? 'block' : 'hidden'}>
            <Settings
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

          <div className={activeTab === 'glossary' ? 'block' : 'hidden'}>
            <GlossaryManager lang={lang} />
          </div>
        </main>

      </div>

    </div>
  );
}
