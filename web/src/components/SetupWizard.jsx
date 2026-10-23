import React, { useState, useEffect } from 'react';
import { l, localeTag, t } from '../i18n/translations';

export default function SetupWizard({ settings, onSaveSettings, setActiveTab, lang = 'en' }) {
  const [mode, setMode] = useState('local');
  const [pages, setPages] = useState(350);
  const [chunkSize, setChunkSize] = useState(1000);
  const [concurrency, setConcurrency] = useState(1);
  const [inputPrice, setInputPrice] = useState(0.14);
  const [outputPrice, setOutputPrice] = useState(0.28);
  const [enableCaching, setEnableCaching] = useState(true);

  useEffect(() => {
    if (mode === 'local') {
      setChunkSize(1000);
      setConcurrency(1);
    } else {
      setChunkSize(6000);
      setConcurrency(6);
    }
  }, [mode]);

  const wordsCount = pages * 275;
  const totalTokens = Math.round(wordsCount * 1.35);
  const totalRequests = Math.max(1, Math.ceil(totalTokens / chunkSize));
  const promptPrefixPerChunk = Math.max(150, Math.ceil((settings?.systemPrompt?.length || 2200) / 3.8));
  const baseInputTokens = (totalRequests * promptPrefixPerChunk) + totalTokens;
  const rawInputCost = (baseInputTokens / 1000000) * inputPrice;
  let computedInputCost = rawInputCost;

  const cachingSupported = ['claude', 'anthropic'].includes(settings?.apiType);
  const cachingEligible = cachingSupported && promptPrefixPerChunk >= 1024;
  if (enableCaching && cachingEligible && mode === 'cloud' && totalRequests > 1) {
    const firstChunkContent = totalTokens / totalRequests;
    const firstRequestCost = ((promptPrefixPerChunk + firstChunkContent) / 1000000) * inputPrice;
    const remainingContentCost = ((totalTokens - firstChunkContent) / 1000000) * inputPrice;
    const remainingCachedPromptCost = (((totalRequests - 1) * promptPrefixPerChunk) / 1000000) * inputPrice * 0.10;
    computedInputCost = firstRequestCost + remainingContentCost + remainingCachedPromptCost;
  }

  const computedOutputCost = (totalTokens / 1000000) * outputPrice;
  const totalCostNumber = computedInputCost + computedOutputCost;
  const totalCost = totalCostNumber.toFixed(2);
  const cachingSavings = Math.max(0, rawInputCost + computedOutputCost - totalCostNumber).toFixed(2);

  const handleApplySettings = () => {
    if (onSaveSettings && settings) onSaveSettings({
      ...settings,
      chunkSize: Math.max(200, Math.min(10000, Number(chunkSize))),
      concurrency: Number(concurrency),
      enablePromptCaching: mode === 'cloud' && enableCaching && cachingSupported,
    });
    if (setActiveTab) setActiveTab('dashboard');
  };

  const presets = [
    { pages: 50, label: t('wizard.novella', lang) },
    { pages: 300, label: t('wizard.novel', lang) },
    { pages: 800, label: t('wizard.thickBook', lang) },
    { pages: 2500, label: t('wizard.fullSeries', lang) },
  ];
  const modes = [
    { id: 'local', title: l(lang, 'On your machine', 'Sur votre machine', 'En tu equipo', 'Auf deinem Rechner'), detail: `${t('wizard.localDesc', lang)} · ${t('wizard.localBadge', lang)}` },
    { id: 'cloud', title: l(lang, 'Through a provider', 'Via un fournisseur', 'Mediante un proveedor', 'Über einen Anbieter'), detail: `${t('wizard.cloudDesc', lang)} · ${t('wizard.cloudBadge', lang)}` },
  ];
  const cachingHint = cachingEligible
    ? l(lang, 'Explicit Anthropic caching for the repeated system prompt', 'Cache Anthropic explicite sur le prompt système répété', 'Caché explícito de Anthropic para el prompt de sistema repetido', 'Expliziter Anthropic-Cache für den wiederholten Systemprompt')
    : cachingSupported
      ? l(lang, 'Prompt too short to guarantee a cache hit', 'Prompt trop court pour garantir une mise en cache', 'El prompt es demasiado corto para garantizar el uso de la caché', 'Prompt zu kurz für einen garantierten Cache-Treffer')
      : l(lang, 'Available with an Anthropic provider', 'Disponible avec un fournisseur Anthropic', 'Disponible con un proveedor Anthropic', 'Mit einem Anthropic-Anbieter verfügbar');

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{l(lang, 'Estimate a translation', 'Estimer une traduction', 'Estimar una traducción', 'Übersetzung schätzen')}</h1>
          <p>{l(lang, 'Configure your document and instantly get a clear volume and cost estimate.', 'Configurez votre ouvrage et obtenez immédiatement une estimation lisible du volume et du coût.', 'Configura el documento y obtén de inmediato una estimación clara del volumen y el coste.', 'Konfiguriere dein Dokument und erhalte sofort eine verständliche Umfangs- und Kostenschätzung.')}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
          <section aria-labelledby="estimate-env" className="card flex flex-col gap-3.5 px-6 py-5">
            <h2 id="estimate-env" className="section-title">{l(lang, 'Where will it run?', 'Où sera-t-elle exécutée ?', '¿Dónde se ejecutará?', 'Wo läuft sie?')}</h2>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-2.5">
              {modes.map((item) => (
                <button key={item.id} type="button" aria-pressed={mode === item.id} onClick={() => setMode(item.id)} className="tile flex-col !items-start gap-1 !rounded-2xl p-4">
                  <span className="font-semibold">{item.title}</span>
                  <span className="text-[13px] text-sec">{item.detail}</span>
                </button>
              ))}
            </div>
          </section>

          <section aria-labelledby="estimate-length" className="card flex flex-col gap-3.5 px-6 py-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="estimate-length" className="section-title">{l(lang, 'Document length', 'Longueur du document', 'Longitud del documento', 'Dokumentlänge')}</h2>
              <span className="text-[13px] text-sec">~{wordsCount.toLocaleString(localeTag(lang))} {l(lang, 'estimated words', 'mots estimés', 'palabras estimadas', 'geschätzte Wörter')}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((preset) => (
                <button
                  key={preset.pages}
                  type="button"
                  aria-pressed={pages === preset.pages}
                  onClick={() => setPages(preset.pages)}
                  className={`btn btn-sm ${pages === preset.pages ? 'btn-solid' : 'btn-secondary'}`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3.5">
              <input type="range" min={20} max={3000} step={10} value={pages} onChange={(event) => setPages(parseInt(event.target.value, 10))} className="flex-1" aria-label={l(lang, 'Document length', 'Longueur du document', 'Longitud del documento', 'Dokumentlänge')} />
              <label className="flex items-center gap-1.5 font-semibold tabular-nums">
                <input
                  type="number"
                  min="20"
                  max="3000"
                  value={pages}
                  onChange={(event) => setPages(Math.max(20, Math.min(3000, parseInt(event.target.value, 10) || 20)))}
                  className="input !h-9 !w-20 text-right"
                />
                {t('wizard.pagesUnit', lang)}
              </label>
            </div>
          </section>

          <section aria-labelledby="estimate-plan" className="card flex flex-col gap-3.5 px-6 py-5">
            <div>
              <h2 id="estimate-plan" className="section-title">{l(lang, 'Planning', 'Planification', 'Planificación', 'Planung')}</h2>
              <p className="m-0 mt-0.5 text-[13px] text-sec">{l(lang, 'Adjust only if you know your model limits.', 'Ajustez uniquement si vous connaissez les limites de votre modèle.', 'Ajusta estos valores solo si conoces los límites del modelo.', 'Passe diese Werte nur an, wenn du die Grenzen deines Modells kennst.')}</p>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-3">
              <label className="field"><span className="field-label">{t('wizard.chunkSize', lang)}</span><input className="input" type="number" min="200" max="10000" step="250" value={chunkSize} onChange={(event) => setChunkSize(Math.max(200, Math.min(10000, parseInt(event.target.value, 10) || 1000)))} /></label>
              <label className="field"><span className="field-label">{t('wizard.concurrencySlots', lang)}</span><input className="input" type="number" min="1" max="16" value={concurrency} onChange={(event) => setConcurrency(parseInt(event.target.value, 10) || 1)} /></label>
              {mode === 'cloud' && <>
                <label className="field"><span className="field-label">{t('wizard.inputPrice', lang)}</span><input className="input" type="number" step="0.05" value={inputPrice} onChange={(event) => setInputPrice(parseFloat(event.target.value) || 0)} /></label>
                <label className="field"><span className="field-label">{t('wizard.outputPrice', lang)}</span><input className="input" type="number" step="0.05" value={outputPrice} onChange={(event) => setOutputPrice(parseFloat(event.target.value) || 0)} /></label>
              </>}
            </div>
            {mode === 'cloud' && (
              <div className="well flex items-center justify-between gap-3 px-3.5 py-3">
                <span className="setting-copy"><strong id="prompt-caching-label">Prompt caching</strong><span>{cachingHint}</span></span>
                <button type="button" role="switch" aria-checked={enableCaching} aria-labelledby="prompt-caching-label" className="switch" onClick={() => setEnableCaching(!enableCaching)} />
              </div>
            )}
          </section>
        </div>

        <aside aria-labelledby="estimate-result" className="card flex min-w-0 flex-[1_1_320px] flex-col gap-[18px] p-6">
          <h2 id="estimate-result" className="section-title">{t('wizard.resultsTitle', lang)}</h2>
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] text-sec">{t('wizard.estimatedCost', lang)}</span>
            <span className="text-[40px] font-semibold leading-[1.1] tracking-[-0.04em] tabular-nums">{mode === 'local' ? '0,00 €' : `$${totalCost}`}</span>
            <span className="text-[13px] text-sec">{mode === 'local' ? t('wizard.freeLocal', lang) : `${inputPrice}$ input · ${outputPrice}$ output`}</span>
          </div>
          <dl className="m-0 flex flex-col">
            {[
              [t('wizard.estimatedVolume', lang), `~${wordsCount.toLocaleString(localeTag(lang))} ${l(lang, 'words', 'mots', 'palabras', 'Wörter')}`],
              [t('wizard.totalTokens', lang), `~${totalTokens.toLocaleString(localeTag(lang))}`],
              [t('wizard.chunksUnit', lang), totalRequests.toLocaleString(localeTag(lang))],
              [l(lang, 'Execution', 'Exécution', 'Ejecución', 'Ausführung'), mode === 'local' ? t('wizard.localServer', lang) : t('wizard.cloudApi', lang)],
            ].map(([rawLabel, value]) => {
              const label = rawLabel.replace(/\s*:\s*$/, '');
              return (
              <div key={label} className="flex justify-between gap-3 border-t border-line py-2.5">
                <dt className="text-sec">{label.charAt(0).toUpperCase() + label.slice(1)}</dt>
                <dd className="m-0 text-right font-medium tabular-nums">{value}</dd>
              </div>
              );
            })}
          </dl>
          {mode === 'cloud' && enableCaching && cachingEligible && parseFloat(cachingSavings) > 0 && (
            <p className="m-0 text-[13px] text-good">{l(lang, 'Estimated savings', 'Économie estimée', 'Ahorro estimado', 'Geschätzte Ersparnis')}: {cachingSavings}$</p>
          )}
          <button type="button" onClick={handleApplySettings} className="btn btn-primary btn-lg">{t('wizard.applySettings', lang)}</button>
          <p className="m-0 text-[12px] text-sec">{t('wizard.disclaimer', lang)}</p>
        </aside>
      </div>
    </div>
  );
}
