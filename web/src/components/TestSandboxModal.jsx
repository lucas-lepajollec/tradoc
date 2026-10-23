import React, { useState, useRef } from 'react';
import { AlertCircle, ArrowRight, RefreshCw, Upload, Copy, Check, RotateCcw } from 'lucide-react';
import { testTranslation, extractSandboxSample } from '../api';
import { AVAILABLE_LANGUAGES, l, languageLabel, localeTag, t } from '../i18n/translations';
import { readableSegment } from '../utils/readableSegment';
import { decodeModelChoice } from '../providers';
import ModelSelect from './ModelSelect';

// Universal Classic Literary Excerpt (Pride and Prejudice by Jane Austen)
const DEFAULT_UNIVERSAL_SAMPLE = `<p class="chapter-title">CHAPTER I</p>

<p class="paragraph">It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.</p>

<p class="paragraph">However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered the rightful property of some one or other of their daughters.</p>

<p class="dialogue">"My dear Mr. Bennet," said his lady to him one day, "have you heard that Netherfield Park is let at last?"</p>`;

const estimateTokens = (text = '') => {
  if (!text) return 0;
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(Math.floor(text.length / 3.8), Math.floor(words * 1.3));
};

export default function TestSandboxModal({ settings, modelGroups = [], lang = 'en', onSelectModel }) {
  const [sampleText, setSampleText] = useState(DEFAULT_UNIVERSAL_SAMPLE);
  const [selectedModel, setSelectedModel] = useState(settings.model || '');
  const [selectedTemperature, setSelectedTemperature] = useState(settings.temperature !== undefined ? settings.temperature : 1.5);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const [showRawText, setShowRawText] = useState(false);

  const fileInputRef = useRef(null);
  const sourceCode = settings.sourceLang || 'en';
  const targetCode = settings.targetLang || 'fr';
  const sourceLanguage = AVAILABLE_LANGUAGES.find((item) => item.code === sourceCode);
  const targetLanguage = AVAILABLE_LANGUAGES.find((item) => item.code === targetCode);
  const sourceLanguageName = sourceLanguage ? languageLabel(sourceLanguage.code, lang) : sourceCode.toUpperCase();
  const targetLanguageName = targetLanguage ? languageLabel(targetLanguage.code, lang) : targetCode.toUpperCase();
  const sourceTokens = estimateTokens(sampleText);
  const resultText = result?.translated_text || '';
  const targetTokens = estimateTokens(resultText);
  const displayedSourceText = showRawText ? sampleText : readableSegment(sampleText);
  const displayedResultText = showRawText ? resultText : readableSegment(resultText);

  React.useEffect(() => {
    if (settings.model) {
      setSelectedModel(settings.model);
    }
    if (settings.temperature !== undefined) {
      setSelectedTemperature(settings.temperature);
    }
  }, [settings.model, settings.temperature]);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExtracting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('limit_tokens', settings.chunkSize || 1000);

      const res = await extractSandboxSample(formData);
      if (res.text) {
        setSampleText(res.text);
      } else {
        throw new Error("Aucun texte n'a pu être extrait du livre.");
      }
    } catch (err) {
      setError(`Erreur d'extraction : ${err.message}`);
    } finally {
      setExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRunTest = async () => {
    if (!sampleText) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await testTranslation({
        text: sampleText,
        model: selectedModel || settings.model,
        endpoint: settings.endpoint,
        apiKey: settings.apiKey,
        api_type: settings.apiType,
        system_prompt: settings.systemPrompt,
        temperature: selectedTemperature
      });
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyResult = () => {
    if (!result?.translated_text) return;
    navigator.clipboard.writeText(result.translated_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resultStatus = loading
    ? { label: l(lang, 'Processing', 'En cours', 'En curso', 'In Arbeit'), className: 'is-running' }
    : result
      ? { label: l(lang, 'Translated', 'Traduit', 'Traducido', 'Übersetzt'), className: 'is-done' }
      : { label: l(lang, 'Waiting', 'En attente', 'En espera', 'Wartet'), className: '' };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{t('nav.sandbox', lang)}</h1>
          <p>{t('sandbox.desc', lang)}</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="file" accept=".epub" ref={fileInputRef} onChange={handleFileUpload} className="sr-only" tabIndex={-1} aria-hidden="true" />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={extracting}
            title={l(lang, 'Import the first excerpt from an .epub file', 'Importer le premier extrait d’un fichier .epub', 'Importar el primer fragmento de un archivo .epub', 'Ersten Auszug aus einer .epub-Datei importieren')}
          >
            {extracting ? <RefreshCw className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
            {extracting ? l(lang, 'Extracting…', 'Extraction…', 'Extrayendo…', 'Wird extrahiert…') : l(lang, 'Import EPUB', 'Importer un EPUB', 'Importar EPUB', 'EPUB importieren')}
          </button>
          <button type="button" className="icon-btn" onClick={() => setSampleText(DEFAULT_UNIVERSAL_SAMPLE)} aria-label={t('sandbox.resetExcerpt', lang)} title={t('sandbox.resetExcerpt', lang)}>
            <RotateCcw aria-hidden="true" />
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="notice">
          <AlertCircle aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <div className="card card-lg overflow-hidden">
        <div className="pane-grid">
          <section className="pane" aria-label={l(lang, 'Source text', 'Texte source', 'Texto de origen', 'Ausgangstext')}>
            <div className="pane-head">
              <span><strong className="font-medium text-fg">{sourceLanguageName}</strong> · {sourceCode.toUpperCase()}</span>
              <span>{sourceTokens.toLocaleString(localeTag(lang))} {l(lang, 'tokens sent', 'tokens envoyés', 'tokens enviados', 'gesendete Tokens')}</span>
            </div>
            <textarea
              rows={12}
              value={displayedSourceText}
              onChange={(event) => setSampleText(event.target.value)}
              placeholder={l(lang, 'Enter an excerpt or import a book…', 'Saisissez un extrait ou chargez un livre…', 'Escribe un fragmento o importa un libro…', 'Auszug eingeben oder Buch importieren…')}
              aria-label={l(lang, 'Source text', 'Texte source', 'Texto de origen', 'Ausgangstext')}
              className="pane-text"
            />
            <div className="pane-foot">{displayedSourceText.length.toLocaleString(localeTag(lang))} {l(lang, 'characters', 'caractères', 'caracteres', 'Zeichen')}</div>
          </section>

          <section className="pane" aria-label={l(lang, 'Translation', 'Traduction', 'Traducción', 'Übersetzung')}>
            <div className="pane-head">
              <span className="flex flex-wrap items-center gap-2.5">
                <span><strong className="font-medium text-fg">{targetLanguageName}</strong> · {targetCode.toUpperCase()}</span>
                <span className={`status ${resultStatus.className}`} aria-live="polite">{resultStatus.label}</span>
              </span>
              <span className="flex items-center gap-2.5">
                {targetTokens.toLocaleString(localeTag(lang))} {l(lang, 'tokens received', 'tokens reçus', 'tokens recibidos', 'empfangene Tokens')}
                {result && (
                  <button type="button" className="btn btn-secondary !h-7 !px-2.5 !text-[12px]" onClick={handleCopyResult}>
                    {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                    {copied ? t('inspector.copied', lang) : t('sandbox.copyResult', lang)}
                  </button>
                )}
              </span>
            </div>
            <div className={`pane-text sandbox-document-output ${result ? '' : 'is-empty'}`}>
              {result ? displayedResultText : l(lang, 'Waiting for translation…', 'En attente de traduction…', 'Esperando la traducción…', 'Warte auf die Übersetzung…')}
            </div>
            <div className="pane-foot">{displayedResultText.length.toLocaleString(localeTag(lang))} {l(lang, 'characters', 'caractères', 'caracteres', 'Zeichen')}</div>
          </section>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-line bg-toolbar p-2.5">
          <label className="chip-select">
            {t('dashboard.model', lang)}
            <ModelSelect
              aria-label={t('dashboard.model', lang)}
              groups={modelGroups}
              provider={settings.apiType}
              model={selectedModel || settings.model || ''}
              onChange={(choice) => {
                setSelectedModel(decodeModelChoice(choice, settings.apiType).model);
                if (onSelectModel) onSelectModel(choice);
              }}
            />
          </label>
          <label className="chip-select gap-2.5 !pr-3.5">
            {l(lang, 'Temperature', 'Température', 'Temperatura', 'Temperatur')}
            <input type="range" min="0" max="2" step="0.05" value={selectedTemperature} onChange={(event) => setSelectedTemperature(parseFloat(event.target.value))} className="w-[120px]" />
            <span className="min-w-8 font-medium tabular-nums text-fg">{Number(selectedTemperature).toFixed(2)}</span>
          </label>
          <button type="button" className="switch-row px-3" role="switch" aria-checked={showRawText} onClick={() => setShowRawText(!showRawText)}>
            {l(lang, 'Raw text', 'Texte brut', 'Texto sin procesar', 'Rohtext')}
            <span className="switch" aria-checked={showRawText} aria-hidden="true" />
          </button>
          <span className="flex-1" />
          <button type="button" className="btn btn-primary" onClick={handleRunTest} disabled={loading || !sampleText || extracting}>
            {loading ? <RefreshCw className="animate-spin" aria-hidden="true" /> : null}
            {loading ? l(lang, 'Processing…', 'Traduction en cours…', 'Procesando…', 'Wird verarbeitet…') : l(lang, 'Run test', 'Lancer le test', 'Ejecutar prueba', 'Test ausführen')}
            {!loading && <ArrowRight aria-hidden="true" />}
          </button>
        </div>
      </div>
    </div>
  );
}
