import React from 'react';
import { BookOpen, LayoutDashboard, Settings as SettingsIcon, BookMarked, Cpu, TestTube, X, Sliders } from 'lucide-react';
import { t } from '../i18n/translations';

export default function Sidebar({
  activeTab,
  setActiveTab,
  endpointStatus,
  endpointUrl,
  isOpen,
  onClose,
  lang = 'en',
  presets = [],
  activePresetId = '',
  onSelectPreset,
  currentModel = '',
  availableModels = [],
  onSelectModel
}) {
  const navItems = [
    { id: 'dashboard', label: t('nav.projects', lang), icon: LayoutDashboard },
    { id: 'jobs', label: t('nav.inspector', lang), icon: BookOpen },
    { id: 'wizard', label: t('nav.vram', lang), icon: Cpu },
    { id: 'sandbox', label: t('nav.sandbox', lang), icon: TestTube },
    { id: 'glossary', label: t('nav.glossaries', lang), icon: BookMarked },
    { id: 'settings', label: t('nav.settings', lang), icon: SettingsIcon },
  ];

  const handleNavClick = (id) => {
    setActiveTab(id);
    if (onClose) onClose();
  };

  const renderContent = (isMobile = false) => (
    <>
      {/* Top Brand & Navigation */}
      <div className="space-y-6">
        
        {/* Brand Logo */}
        <div className="flex items-center justify-between px-2 pt-1">
          <div className="flex items-center space-x-2.5 cursor-pointer" onClick={() => handleNavClick('dashboard')}>
            <img src="/logo.svg" alt="TraDoc Logo" className="w-9 h-9 rounded-xl border border-white/[0.08]" />
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-semibold text-sm text-white tracking-tight">{t('nav.appName', lang)}</span>
                <span className="text-[9px] font-mono text-[#888] bg-white/[0.06] px-1.5 py-0.5 rounded border border-white/[0.08] font-bold">Pro</span>
              </div>
              <p className="text-[10px] text-[#666]">{t('nav.appSubtitle', lang)}</p>
            </div>
          </div>

          {isMobile && (
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
              aria-label="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-[#444] px-2 mb-2">
            {lang === 'fr' ? 'Menu Principal' : 'Main Menu'}
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 group ${
                  isActive
                    ? 'bg-white/[0.08] text-white font-semibold'
                    : 'text-[#888] hover:text-[#ededed] hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-[#60a5fa]' : 'text-[#666] group-hover:text-zinc-400'}`} />
                  <span>{item.label}</span>
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom: Presets Switcher & Model Switcher */}
      <div className="pt-3 border-t border-white/[0.08] space-y-2.5">
        {/* Preset Selector Dropdown with Status Dot */}
        {onSelectPreset && (
          <div className="px-2 space-y-1">
            <div className="flex items-center justify-between text-[10px] text-[#666] font-medium">
              <span className="flex items-center space-x-1">
                <Sliders className="w-3 h-3 text-[#666]" />
                <span>{t('nav.presetSelect', lang)}</span>
              </span>
              <div
                className={`w-1.5 h-1.5 rounded-full ${endpointStatus ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-rose-500 shadow-sm shadow-rose-500/50'}`}
                title={endpointStatus ? t('nav.gpuOnline', lang) : t('nav.gpuOffline', lang)}
              />
            </div>
            <select
              value={activePresetId || ''}
              onChange={(e) => onSelectPreset(e.target.value)}
              className="w-full input-chill text-[11px] text-zinc-200 py-1.5 px-2.5 font-medium cursor-pointer"
            >
              <option value="">-- Aucun preset --</option>
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Model Quick Switcher Dropdown */}
        {onSelectModel && (
          <div className="px-2 space-y-1">
            <div className="flex items-center justify-between text-[10px] text-[#666] font-medium">
              <span className="flex items-center space-x-1">
                <Cpu className="w-3 h-3 text-[#666]" />
                <span>{lang === 'fr' ? 'Modèle Actif' : 'Active Model'}</span>
              </span>
            </div>
            <select
              value={currentModel}
              onChange={(e) => onSelectModel(e.target.value)}
              className="w-full input-chill text-[11px] text-zinc-200 py-1.5 px-2.5 font-mono cursor-pointer truncate"
            >
              {availableModels.length > 0 ? (
                availableModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))
              ) : (
                <option value={currentModel}>{currentModel || 'Model'}</option>
              )}
            </select>
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar (hidden on mobile, visible on lg screens) */}
      <aside className="w-60 h-screen bg-black/40 backdrop-blur-xl border-r border-white/[0.08] hidden lg:flex flex-col justify-between p-4 fixed top-0 left-0 z-40">
        {renderContent(false)}
      </aside>

      {/* Mobile Drawer & Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-50 lg:hidden transition-opacity duration-200"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 w-64 bg-black/80 backdrop-blur-xl border-r border-white/[0.08] flex flex-col justify-between p-4 z-50 transform transition-transform duration-200 ease-in-out lg:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {renderContent(true)}
      </aside>
    </>
  );
}
