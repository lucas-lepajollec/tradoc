import React, { useEffect, useState } from 'react';
import { ChevronRight, Menu, X } from 'lucide-react';
import { l, t } from '../i18n/translations';
import ModelSelect from './ModelSelect';
import Select from './Select';

const NAV_ITEMS = [
  { id: 'dashboard', key: 'nav.projects' },
  { id: 'jobs', key: 'nav.inspector' },
  { id: 'sandbox', key: 'nav.sandbox' },
  { id: 'glossary', key: 'nav.glossaries' },
  { id: 'wizard', key: 'nav.vram' },
  { id: 'settings', key: 'nav.settings' },
];

export default function TopBar({
  activeTab,
  setActiveTab,
  endpointStatus,
  lang = 'en',
  presets = [],
  activePresetId = '',
  onSelectPreset,
  currentModel = '',
  modelGroups = [],
  currentProvider,
  onSelectModel,
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);

  const go = (id) => {
    setActiveTab(id);
    setMenuOpen(false);
  };

  const noProfile = l(lang, 'No profile', 'Aucun profil', 'Sin perfil', 'Kein Profil');
  const noModel = l(lang, 'No model', 'Aucun modèle', 'Sin modelo', 'Kein Modell');
  const profileLabel = t('nav.presetSelect', lang);
  const modelLabel = l(lang, 'Active model', 'Modèle actif', 'Modelo activo', 'Aktives Modell');
  const statusLabel = endpointStatus
    ? l(lang, 'Service ready', 'Service prêt', 'Servicio listo', 'Dienst bereit')
    : l(lang, 'Service offline', 'Service hors ligne', 'Servicio sin conexión', 'Dienst offline');

  const profileSelect = (className) => onSelectPreset && (
    <Select
      ariaLabel={profileLabel}
      className={className}
      value={activePresetId || ''}
      onChange={onSelectPreset}
      options={[{ value: '', label: noProfile }, ...presets.map((preset) => ({ value: preset.id, label: preset.name }))]}
    />
  );

  const modelSelect = (className) => onSelectModel && (
    <ModelSelect aria-label={modelLabel} className={className} groups={modelGroups} provider={currentProvider} model={currentModel} onChange={onSelectModel} />
  );

  const brand = (
    <button type="button" className="brand" onClick={() => go('dashboard')}>
      <img src="/logo.svg" alt="" />
      {t('nav.appName', lang)}
    </button>
  );

  return (
    <header className="topbar">
      <div className="topbar-desktop">
        <div>{brand}</div>
        <nav aria-label={l(lang, 'Main navigation', 'Navigation principale', 'Navegación principal', 'Hauptnavigation')} className="seg seg-outline justify-center">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-current={activeTab === item.id ? 'page' : undefined}
              onClick={() => go(item.id)}
            >
              {t(item.key, lang)}
            </button>
          ))}
        </nav>
        <div className="flex justify-end">
          <div className="runtime-chip">
            <span className={`dot mx-2 ${endpointStatus ? 'is-online' : ''}`} title={statusLabel} />
            <span className="sr-only">{statusLabel}</span>
            <span className="runtime-profile inline-flex items-center gap-0.5">
              {profileSelect('!font-normal text-sec')}
              <span className="sep" aria-hidden="true" />
            </span>
            {modelSelect('')}
          </div>
        </div>
      </div>

      <div className="topbar-mobile">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          {brand}
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 max-w-[150px] items-center gap-2 rounded-full border border-line px-3 text-[13px] font-medium">
              <span className={`dot ${endpointStatus ? 'is-online' : ''}`} />
              <span className="sr-only">{statusLabel}</span>
              <span className="truncate">{currentModel || noModel}</span>
            </span>
            <button
              type="button"
              className="icon-btn !h-11 !w-11"
              aria-expanded={menuOpen}
              aria-label={menuOpen
                ? l(lang, 'Close navigation menu', 'Fermer le menu de navigation', 'Cerrar el menú de navegación', 'Navigationsmenü schließen')
                : l(lang, 'Open navigation menu', 'Ouvrir le menu de navigation', 'Abrir el menú de navegación', 'Navigationsmenü öffnen')}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="mobile-menu">
            <nav aria-label={l(lang, 'Main navigation', 'Navigation principale', 'Navegación principal', 'Hauptnavigation')} className="flex flex-col gap-0.5">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="mobile-menu-item"
                  aria-current={activeTab === item.id ? 'page' : undefined}
                  onClick={() => go(item.id)}
                >
                  {t(item.key, lang)}
                  <ChevronRight aria-hidden="true" />
                </button>
              ))}
            </nav>
            <div className="divider mx-2 my-1.5" />
            {onSelectPreset && <label className="mobile-menu-row">{profileLabel}{profileSelect('')}</label>}
            {onSelectModel && <label className="mobile-menu-row">{modelLabel}{modelSelect('')}</label>}
          </div>
        )}
      </div>
    </header>
  );
}
