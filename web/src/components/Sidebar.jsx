import React from 'react';
import { BookOpen, LayoutDashboard, Settings as SettingsIcon, BookMarked, Cpu, TestTube, X, Sliders, ChevronDown } from 'lucide-react';
import { l, t } from '../i18n/translations';

export default function Sidebar({
  activeTab,
  setActiveTab,
  endpointStatus,
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
  const navGroups = [
    {
      label: l(lang, 'Translate', 'Traduire', 'Traducir', 'Übersetzen'),
      items: [
        { id: 'dashboard', label: t('nav.projects', lang), icon: LayoutDashboard },
        { id: 'jobs', label: t('nav.inspector', lang), icon: BookOpen },
        { id: 'sandbox', label: t('nav.sandbox', lang), icon: TestTube },
      ]
    },
    {
      label: l(lang, 'Tools', 'Outils', 'Herramientas', 'Werkzeuge'),
      items: [
        { id: 'glossary', label: t('nav.glossaries', lang), icon: BookMarked },
        { id: 'wizard', label: t('nav.vram', lang), icon: Cpu },
        { id: 'settings', label: t('nav.settings', lang), icon: SettingsIcon },
      ]
    }
  ];

  const handleNavClick = (id) => {
    setActiveTab(id);
    if (onClose) onClose();
  };

  const activePresetName = presets.find((preset) => preset.id === activePresetId)?.name
    || l(lang, 'No profile', 'Aucun profil', 'Sin perfil', 'Kein Profil');

  const renderContent = (isMobile = false) => (
    <>
      {/* Top Brand & Navigation */}
      <div className="space-y-8">
        
        {/* Brand Logo */}
        <div className="flex items-center justify-between px-2 pt-2">
          <div className="flex items-center space-x-2.5 cursor-pointer" onClick={() => handleNavClick('dashboard')}>
            <img src="/logo.svg" alt="TraDoc Logo" className="brand-mark w-10 h-10" />
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-semibold text-[15px] text-white tracking-tight">{t('nav.appName', lang)}</span>
                <span className="edition-badge text-[9px] px-1.5 py-0.5 rounded font-bold">Pro</span>
              </div>
              <p className="text-[10px] text-[#868a93] mt-0.5">{t('nav.appSubtitle', lang)}</p>
            </div>
          </div>

          {isMobile && (
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
              aria-label={l(lang, 'Close menu', 'Fermer le menu', 'Cerrar menú', 'Menü schließen')}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="space-y-6">
          {navGroups.map((group) => (
            <div key={group.label} className="space-y-1">
              <p className="nav-eyebrow text-[9px] font-semibold uppercase tracking-[0.16em] px-3 mb-2">{group.label}</p>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`nav-item w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 group ${isActive ? 'nav-item-active text-white font-semibold' : 'text-[#9a9ca3] hover:text-[#f4f2ec]'}`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-[#8eb8ff]' : 'text-[#747984] group-hover:text-zinc-300'}`} />
                      <span>{item.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* Bottom: active preset and model */}
      <div className="sidebar-tools">
        <div className="sidebar-runtime-heading">
          <span>{l(lang, 'Active configuration', 'Configuration active', 'Configuración activa', 'Aktive Konfiguration')}</span>
          <span className={`sidebar-service-state ${endpointStatus ? 'is-online' : ''}`}>
            <i />{endpointStatus ? l(lang, 'Ready', 'Prêt', 'Listo', 'Bereit') : l(lang, 'Offline', 'Hors ligne', 'Sin conexión', 'Offline')}
          </span>
        </div>

        {onSelectPreset && (
          <label className="sidebar-select-card">
            <span className="sidebar-select-icon"><Sliders /></span>
            <span className="sidebar-select-copy">
              <small>{t('nav.presetSelect', lang)}</small>
              <strong>{activePresetName}</strong>
              <select aria-label={t('nav.presetSelect', lang)} value={activePresetId || ''} onChange={(e) => onSelectPreset(e.target.value)}>
                <option value="">{l(lang, 'No profile', 'Aucun profil', 'Sin perfil', 'Kein Profil')}</option>
                {presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </span>
            <ChevronDown className="sidebar-select-chevron" />
          </label>
        )}

        {onSelectModel && (
          <label className="sidebar-select-card">
            <span className="sidebar-select-icon"><Cpu /></span>
            <span className="sidebar-select-copy">
              <small>{l(lang, 'Active model', 'Modèle actif', 'Modelo activo', 'Aktives Modell')}</small>
              <strong className="is-model">{currentModel || l(lang, 'No model', 'Aucun modèle', 'Sin modelo', 'Kein Modell')}</strong>
              <select aria-label={l(lang, 'Active model', 'Modèle actif', 'Modelo activo', 'Aktives Modell')} value={currentModel} onChange={(e) => onSelectModel(e.target.value)}>
                {availableModels.length > 0
                  ? availableModels.map((m) => <option key={m} value={m}>{m}</option>)
                  : <option value={currentModel}>{currentModel || l(lang, 'No model', 'Aucun modèle', 'Sin modelo', 'Kein Modell')}</option>}
              </select>
            </span>
            <ChevronDown className="sidebar-select-chevron" />
          </label>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar (hidden on mobile, visible on lg screens) */}
      <aside className="sidebar-shell w-[272px] h-screen hidden lg:flex flex-col justify-between p-5 fixed top-0 left-0 z-40">
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
        className={`sidebar-shell fixed inset-y-0 left-0 w-[272px] flex flex-col justify-between p-5 z-50 transform transition-transform duration-200 ease-in-out lg:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {renderContent(true)}
      </aside>
    </>
  );
}
