import React, { useState, useEffect } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import JobsInspector from './components/JobsInspector';
import Settings from './components/Settings';
import GlossaryManager from './components/GlossaryManager';
import TestSandboxModal from './components/TestSandboxModal';
import { testConnection, updateJobConfig } from './api';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('tradoc_settings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved settings", e);
      }
    }
    return {
      endpoint: 'http://192.168.0.201:1234/v1',
      apiKey: 'lm-studio',
      apiType: 'openai',
      model: 'qwen3.5-9b',
      concurrency: 1,
      temperature: 1.5,
      chunkSize: 1000,
      systemPrompt: ''
    };
  });

  const [endpointStatus, setEndpointStatus] = useState(false);
  const [availableModels, setAvailableModels] = useState([]);

  useEffect(() => {
    checkEndpointHealth();
  }, []);

  const checkEndpointHealth = async () => {
    // 1. Try currently configured endpoint first
    try {
      const res = await testConnection(settings.endpoint, settings.apiKey, settings.apiType);
      if (res.success) {
        setEndpointStatus(true);
        if (res.models && res.models.length > 0) setAvailableModels(res.models);
        return;
      }
    } catch (e) {}

    // 2. Only auto-detect other local servers if the currently stored settings are default or empty
    const isDefaultEndpoint = settings.endpoint === 'http://192.168.0.201:1234/v1';
    if (isDefaultEndpoint) {
      try {
        const resLocal = await testConnection('http://127.0.0.1:1234/v1', 'lm-studio', 'openai');
        if (resLocal.success) {
          const updated = { ...settings, endpoint: 'http://127.0.0.1:1234/v1', apiType: 'openai' };
          setSettings(updated);
          localStorage.setItem('tradoc_settings', JSON.stringify(updated));
          setEndpointStatus(true);
          if (resLocal.models && resLocal.models.length > 0) setAvailableModels(resLocal.models);
          return;
        }
      } catch (e) {}

      try {
        const resOllama = await testConnection('http://127.0.0.1:11434', '', 'ollama');
        if (resOllama.success) {
          const updated = { ...settings, endpoint: 'http://127.0.0.1:11434', apiType: 'ollama' };
          setSettings(updated);
          localStorage.setItem('tradoc_settings', JSON.stringify(updated));
          setEndpointStatus(true);
          if (resOllama.models && resOllama.models.length > 0) setAvailableModels(resOllama.models);
          return;
        }
      } catch (e) {}
    }

    setEndpointStatus(false);
  };

  const updateSettings = (newSettings) => {
    setSettings(newSettings);
    localStorage.setItem('tradoc_settings', JSON.stringify(newSettings));
    
    if (selectedJobId) {
      updateJobConfig(selectedJobId, {
        temperature: newSettings.temperature,
        concurrency: newSettings.concurrency,
        model: newSettings.model,
      }).catch(e => console.error(e));
    }

    // Explicitly test connection with new settings
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

  return (
    <div className="min-h-screen flex bg-[#0b0c10] text-zinc-100 font-sans relative overflow-x-hidden selection:bg-orange-500/30 selection:text-orange-200">
      
      {/* Ambient Chill Background Halo Orbs */}
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
      />

      {/* Main Right Content Area */}
      <div className="flex-1 min-w-0 flex flex-col z-10">
        
        {/* Top Bar */}
        <header className="h-16 px-4 sm:px-8 border-b border-white/5 bg-[#0b0c10]/80 backdrop-blur-xl flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center space-x-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 text-zinc-300 hover:text-white rounded-lg hover:bg-white/5 transition-colors -ml-1 flex-shrink-0"
              aria-label="Ouvrir le menu"
            >
              <Menu className="w-5 h-5 text-orange-400" />
            </button>

            <h1 className="font-heading font-extrabold text-sm sm:text-base text-white capitalize tracking-tight truncate">
              {activeTab === 'dashboard' && 'Tableau de Bord & Nouveaux Projets'}
              {activeTab === 'jobs' && 'Inspecteur de Segments'}
              {activeTab === 'sandbox' && 'Bac à sable (Aperçu)'}
              {activeTab === 'settings' && 'Configuration du Serveur'}
              {activeTab === 'glossary' && 'Glossaires Littéraires'}
            </h1>
          </div>

          <div className="flex items-center space-x-2 text-xs flex-shrink-0 ml-2">
            <span className="font-mono text-orange-300 bg-orange-500/10 px-2.5 py-1 rounded-full border border-orange-500/20 font-medium text-[11px] sm:text-xs truncate max-w-[130px] sm:max-w-none">
              {settings.model || 'qwen3.5-9b'}
            </span>
          </div>
        </header>

        {/* Main Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-10 max-w-7xl w-full mx-auto space-y-8">
          <div className={activeTab === 'dashboard' ? 'block' : 'hidden'}>
            <Dashboard
              onSelectJob={setSelectedJobId}
              settings={settings}
              endpointStatus={endpointStatus}
              availableModels={availableModels}
              setActiveTab={setActiveTab}
            />
          </div>

          <div className={activeTab === 'jobs' ? 'block' : 'hidden'}>
            <JobsInspector
              selectedJobId={selectedJobId}
              onSelectJob={setSelectedJobId}
              settings={settings}
            />
          </div>

          <div className={activeTab === 'sandbox' ? 'block' : 'hidden'}>
            <TestSandboxModal settings={settings} availableModels={availableModels} />
          </div>

          <div className={activeTab === 'settings' ? 'block' : 'hidden'}>
            <Settings
              settings={settings}
              onSaveSettings={updateSettings}
              endpointStatus={endpointStatus}
              availableModels={availableModels}
              setAvailableModels={setAvailableModels}
            />
          </div>

          <div className={activeTab === 'glossary' ? 'block' : 'hidden'}>
            <GlossaryManager />
          </div>
        </main>

      </div>

    </div>
  );
}
