import React, { useState, useRef } from 'react';
import { TestTube, Play, FileText, AlertCircle, RefreshCw, Upload, Copy, Check, RotateCcw } from 'lucide-react';
import { testTranslation, extractSandboxSample } from '../api';
import { AVAILABLE_LANGUAGES, t } from '../i18n/translations';

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

const readableSegment = (text = '') => text
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/[ \t]{2,}/g, ' ')
  .replace(/\n\s+/g, '\n')
  .trim();

export default function TestSandboxModal({ settings, availableModels, lang = 'en', onSelectModel }) {
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
  const sourceLanguageName = sourceLanguage ? (lang === 'fr' ? sourceLanguage.label : sourceLanguage.labelEn).replace(/\s*\([A-Z]+\)$/, '') : sourceCode.toUpperCase();
  const targetLanguageName = targetLanguage ? (lang === 'fr' ? targetLanguage.label : targetLanguage.labelEn).replace(/\s*\([A-Z]+\)$/, '') : targetCode.toUpperCase();
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

  return (
    <div className="sandbox-page space-y-6">
      
      {/* Top Header Card */}
      <div className="page-intro flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="page-kicker">{lang === 'fr' ? 'Essai instantané' : 'Instant test'}</p>
          <h1>{t('sandbox.title', lang)}</h1>
          <p>{t('sandbox.desc', lang)}</p>
        </div>

        {/* Quick Controls */}
        <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
          <input
            type="file"
            accept=".epub"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
          />
          
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={extracting}
            className="btn-chill px-3.5 py-1.5 text-xs flex items-center space-x-2 rounded-xl transition-all"
            title={lang === 'fr' ? "Importer le premier extrait d'un fichier .epub" : "Import first excerpt from an .epub file"}
          >
            {extracting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            <span>{extracting ? (lang === 'fr' ? "Extraction..." : "Extracting...") : (lang === 'fr' ? "Importer un EPUB" : "Import EPUB")}</span>
          </button>

          <button
            type="button"
            onClick={() => setSampleText(DEFAULT_UNIVERSAL_SAMPLE)}
            className="p-1.5 text-zinc-400 hover:text-white rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.08] transition-all"
            title={t('sandbox.resetExcerpt', lang)}
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 border-l-4 border-l-rose-500 text-zinc-200 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <section className="sandbox-settings-card">
        <div className="sandbox-settings-heading">
          <span>{lang === 'fr' ? 'Configuration du test' : 'Test configuration'}</span>
          <strong>{lang === 'fr' ? 'Paramètres du bac à sable' : 'Sandbox settings'}</strong>
        </div>

        <div className="sandbox-settings-controls">
          <label className="sandbox-model-control">
            <span>{t('dashboard.model', lang)}</span>
            <select
              value={selectedModel || settings.model || ''}
              onChange={(e) => {
                const model = e.target.value;
                setSelectedModel(model);
                if (onSelectModel) onSelectModel(model);
              }}
            >
              {!selectedModel && settings.model && <option value="">{t('dashboard.model', lang)}: {settings.model}</option>}
              {availableModels.length > 0
                ? availableModels.map((model) => <option key={model} value={model}>{model}</option>)
                : <option value={settings.model}>{settings.model}</option>}
            </select>
          </label>

          <label className="sandbox-temperature-setting">
            <span>{lang === 'fr' ? 'Température' : 'Temperature'} <b>{Number(selectedTemperature).toFixed(2)}</b></span>
            <div>
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={selectedTemperature}
                onChange={(event) => setSelectedTemperature(parseFloat(event.target.value))}
              />
            </div>
          </label>

          <button
            type="button"
            onClick={handleRunTest}
            disabled={loading || !sampleText || extracting}
            className="primary-action sandbox-run-button"
          >
            {loading ? <RefreshCw className="animate-spin" /> : <Play />}
            <span>{loading ? (lang === 'fr' ? 'Traduction en cours...' : 'Processing...') : (lang === 'fr' ? 'Lancer le test' : 'Run test')}</span>
          </button>
        </div>
      </section>

      <div className="sandbox-workbench segment-workbench">
        <div className="segment-toolbar">
          <div className="segment-workbench-title">
            <FileText />
            <div>
              <span>{lang === 'fr' ? 'Atelier de traduction' : 'Translation workspace'}</span>
              <h3>{lang === 'fr' ? 'Inspecteur de test' : 'Test inspector'}</h3>
            </div>
          </div>

          <div className="segment-toolbar-controls">
            <button
              type="button"
              className={`segment-view-toggle ${showRawText ? 'is-active' : ''}`}
              onClick={() => setShowRawText(!showRawText)}
              aria-pressed={showRawText}
            >
              <span className="segment-toggle-track"><i /></span>
              <span>{lang === 'fr' ? 'Texte brut' : 'Raw text'}</span>
            </button>
          </div>
        </div>

        <div className="segment-compare sandbox-compare">
          <section className="translation-pane source-pane sandbox-pane">
            <header className="translation-pane-header">
              <div className="translation-language">
                <span>{lang === 'fr' ? 'Texte source' : 'Source text'}</span>
                <strong>{sourceLanguageName}<small>{sourceCode.toUpperCase()}</small></strong>
              </div>
              <div className="translation-pane-meta">
                <span className="translation-token-count">{sourceTokens.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} {lang === 'fr' ? 'tokens envoyés' : 'tokens sent'}</span>
              </div>
            </header>

            <textarea
              rows={12}
              value={displayedSourceText}
              onChange={(e) => setSampleText(e.target.value)}
              placeholder={lang === 'fr' ? 'Saisissez un extrait ou chargez un livre...' : 'Enter an excerpt or import a book...'}
              className="document-text sandbox-document-editor"
            />

            <footer className="translation-pane-footer sandbox-pane-footer">
              <span>{displayedSourceText.length.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} {lang === 'fr' ? 'caractères' : 'characters'}</span>
            </footer>
          </section>

          <section className="translation-pane target-pane sandbox-pane">
            <header className="translation-pane-header">
              <div className="translation-language">
                <span>{lang === 'fr' ? 'Traduction' : 'Translation'}</span>
                <strong>{targetLanguageName}<small>{targetCode.toUpperCase()}</small></strong>
              </div>
              <div className="translation-pane-meta">
                <span className={`translation-status ${result ? 'status-done' : loading ? 'status-processing' : ''}`}>
                  <i />
                  {loading ? (lang === 'fr' ? 'En cours' : 'Processing') : result ? (lang === 'fr' ? 'Traduit' : 'Translated') : (lang === 'fr' ? 'En attente' : 'Waiting')}
                </span>
                <span className="translation-token-count">{targetTokens.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} {lang === 'fr' ? 'tokens reçus' : 'tokens received'}</span>
                {result && (
                  <button
                    type="button"
                    onClick={handleCopyResult}
                    className="translation-copy"
                    title={t('sandbox.copyResult', lang)}
                  >
                    {copied ? <Check /> : <Copy />}
                  </button>
                )}
              </div>
            </header>

            <div className="document-text sandbox-document-output">
              {result ? displayedResultText : (
                <span className="translation-empty">
                  {lang === 'fr' ? 'En attente de traduction...' : 'Waiting for translation...'}
                </span>
              )}
            </div>

            <footer className="translation-pane-footer sandbox-pane-footer">
              <span>{displayedResultText.length.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} {lang === 'fr' ? 'caractères' : 'characters'}</span>
            </footer>
          </section>
        </div>
      </div>

    </div>
  );
}
