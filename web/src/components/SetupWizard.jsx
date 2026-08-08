import React, { useState, useEffect } from 'react';
import { Cpu, Cloud, BookOpen, FileText, Library, Bookmark, Sparkles, ArrowRight, TrendingDown } from 'lucide-react';
import { t } from '../i18n/translations';

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
  const promptPrefixPerChunk = 4500;
  const baseInputTokens = (totalRequests * promptPrefixPerChunk) + totalTokens;
  const rawInputCost = (baseInputTokens / 1000000) * inputPrice;
  let computedInputCost = rawInputCost;

  if (enableCaching && mode === 'cloud' && totalRequests > 1) {
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
    if (onSaveSettings && settings) onSaveSettings({ ...settings, chunkSize: Number(chunkSize), concurrency: Number(concurrency) });
    if (setActiveTab) setActiveTab('dashboard');
  };

  const presets = [
    { pages: 50, label: t('wizard.novella', lang), icon: FileText },
    { pages: 300, label: t('wizard.novel', lang), icon: BookOpen },
    { pages: 800, label: t('wizard.thickBook', lang), icon: Library },
    { pages: 2500, label: t('wizard.fullSeries', lang), icon: Bookmark },
  ];

  return (
    <div className="estimator-page page-stack">
      <header className="page-intro">
        <p className="page-kicker">{lang === 'fr' ? 'Planification' : 'Planning'}</p>
        <h1>{lang === 'fr' ? 'Estimer une traduction' : 'Estimate a translation'}</h1>
        <p>{lang === 'fr' ? 'Configurez votre ouvrage et obtenez immédiatement une estimation lisible du volume et du coût.' : 'Configure your document and instantly get a clear volume and cost estimate.'}</p>
      </header>

      <div className="estimator-shell">
        <div className="estimator-form">
          <section className="form-section">
            <div className="section-heading"><span>01</span><div><h2>{t('wizard.executionEnv', lang)}</h2><p>{lang === 'fr' ? 'Choisissez où la traduction sera exécutée.' : 'Choose where translation will run.'}</p></div></div>
            <div className="choice-grid">
              <button type="button" onClick={() => setMode('local')} className={`choice-card ${mode === 'local' ? 'is-selected' : ''}`}>
                <span className="choice-icon"><Cpu /></span><div><em>{lang === 'fr' ? 'Sur votre machine' : 'On your machine'}</em><strong>{t('wizard.localServer', lang)}</strong><small>{t('wizard.localDesc', lang)}</small></div><span className="choice-foot"><i />{t('wizard.localBadge', lang)}</span>
              </button>
              <button type="button" onClick={() => setMode('cloud')} className={`choice-card ${mode === 'cloud' ? 'is-selected' : ''}`}>
                <span className="choice-icon"><Cloud /></span><div><em>{lang === 'fr' ? 'Via un fournisseur' : 'Through a provider'}</em><strong>{t('wizard.cloudApi', lang)}</strong><small>{t('wizard.cloudDesc', lang)}</small></div><span className="choice-foot"><i />{t('wizard.cloudBadge', lang)}</span>
              </button>
            </div>
          </section>

          <section className="form-section">
            <div className="section-heading"><span>02</span><div><h2>{t('wizard.bookSizeTitle', lang)}</h2><p>{lang === 'fr' ? 'Indiquez la longueur approximative du document.' : 'Set the approximate document length.'}</p></div></div>
            <div className="page-control">
              <div className="page-amount">
                <span>{lang === 'fr' ? 'Longueur du document' : 'Document length'}</span>
                <div><input type="number" min="20" max="3000" value={pages} style={{ width: `${Math.max(3, String(pages).length) * 15}px` }} onChange={(e) => setPages(Math.max(20, Math.min(3000, parseInt(e.target.value, 10) || 20)))} /><strong>{t('wizard.pagesUnit', lang)}</strong></div>
                <small>~{wordsCount.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} {lang === 'fr' ? 'mots estimés' : 'estimated words'}</small>
              </div>
              <div className="page-slider">
                <input type="range" min={20} max={3000} step={10} value={pages} onChange={(e) => setPages(parseInt(e.target.value, 10))} />
                <div><span>20 p.</span><span>3 000 p.</span></div>
              </div>
            </div>
            <div className="preset-row">
              {presets.map(({ pages: presetPages, label, icon: Icon }) => (
                <button type="button" key={presetPages} onClick={() => setPages(presetPages)} className={pages === presetPages ? 'is-selected' : ''}><Icon /><span>{label}</span><small>{presetPages} p.</small></button>
              ))}
            </div>
          </section>

          <section className="form-section">
            <div className="section-heading"><span>03</span><div><h2>{t('wizard.fineTuningTitle', lang)}</h2><p>{lang === 'fr' ? 'Ajustez uniquement si vous connaissez les limites de votre modèle.' : 'Adjust only if you know your model limits.'}</p></div></div>
            <div className="field-grid">
              <label><span>{t('wizard.chunkSize', lang)}</span><input type="number" step="250" value={chunkSize} onChange={(e) => setChunkSize(parseInt(e.target.value, 10) || 1000)} /></label>
              <label><span>{t('wizard.concurrencySlots', lang)}</span><input type="number" min="1" max="16" value={concurrency} onChange={(e) => setConcurrency(parseInt(e.target.value, 10) || 1)} /></label>
              {mode === 'cloud' && <>
                <label><span>{t('wizard.inputPrice', lang)}</span><input type="number" step="0.05" value={inputPrice} onChange={(e) => setInputPrice(parseFloat(e.target.value) || 0)} /></label>
                <label><span>{t('wizard.outputPrice', lang)}</span><input type="number" step="0.05" value={outputPrice} onChange={(e) => setOutputPrice(parseFloat(e.target.value) || 0)} /></label>
                <button type="button" role="switch" aria-checked={enableCaching} className={`cache-toggle-card ${enableCaching ? 'is-active' : ''}`} onClick={() => setEnableCaching(!enableCaching)}>
                  <span className="cache-icon"><Sparkles /></span>
                  <span className="cache-copy"><strong>{lang === 'fr' ? 'Prompt Caching' : 'Prompt Caching'}</strong><small>{t('wizard.enableCaching', lang)} · {lang === 'fr' ? 'jusqu’à 90 % d’économie sur les prompts répétés' : 'up to 90% savings on repeated prompts'}</small></span>
                  <span className="cache-switch"><i /></span>
                </button>
              </>}
            </div>
          </section>
        </div>

        <aside className="estimate-receipt">
          <div className="receipt-heading"><Sparkles /><span>{t('wizard.resultsTitle', lang)}</span></div>
          <div className="cost-display"><small>{t('wizard.estimatedCost', lang)}</small><strong>{mode === 'local' ? '0,00 €' : `$${totalCost}`}</strong><p>{mode === 'local' ? t('wizard.freeLocal', lang) : `${inputPrice}$ input · ${outputPrice}$ output`}</p></div>
          <dl>
            <div><dt>{t('wizard.estimatedVolume', lang)}</dt><dd>~{wordsCount.toLocaleString()} {lang === 'fr' ? 'mots' : 'words'}</dd></div>
            <div><dt>{t('wizard.totalTokens', lang)}</dt><dd>~{totalTokens.toLocaleString()}</dd></div>
            <div><dt>{t('wizard.chunksUnit', lang)}</dt><dd>{totalRequests}</dd></div>
            <div><dt>{lang === 'fr' ? 'Exécution' : 'Execution'}</dt><dd>{mode === 'local' ? t('wizard.localServer', lang) : t('wizard.cloudApi', lang)}</dd></div>
          </dl>
          {mode === 'cloud' && enableCaching && parseFloat(cachingSavings) > 0 && <div className="saving-note"><TrendingDown />{lang === 'fr' ? 'Économie estimée' : 'Estimated savings'}: {cachingSavings}$</div>}
          <p className="receipt-note">{t('wizard.disclaimer', lang)}</p>
          <button type="button" onClick={handleApplySettings} className="primary-button">{t('wizard.applySettings', lang)}<ArrowRight /></button>
        </aside>
      </div>
    </div>
  );
}
