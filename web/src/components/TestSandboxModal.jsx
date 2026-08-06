import React, { useState, useRef } from 'react';
import { TestTube, Play, Clock, AlertCircle, RefreshCw, Upload, Sparkles, BookOpen, Copy, Check, RotateCcw } from 'lucide-react';
import { testTranslation, extractSandboxSample } from '../api';
import { t } from '../i18n/translations';

// Universal Classic Literary Excerpt (Pride and Prejudice by Jane Austen)
const DEFAULT_UNIVERSAL_SAMPLE = `<p class="chapter-title">CHAPTER I</p>

<p class="paragraph">It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.</p>

<p class="paragraph">However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered the rightful property of some one or other of their daughters.</p>

<p class="dialogue">"My dear Mr. Bennet," said his lady to him one day, "have you heard that Netherfield Park is let at last?"</p>`;

export default function TestSandboxModal({ settings, availableModels, lang = 'en', onSelectModel }) {
  const [sampleText, setSampleText] = useState(DEFAULT_UNIVERSAL_SAMPLE);
  const [selectedModel, setSelectedModel] = useState(settings.model || '');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  const fileInputRef = useRef(null);

  React.useEffect(() => {
    if (settings.model) {
      setSelectedModel(settings.model);
    }
  }, [settings.model]);

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
        temperature: settings.temperature !== undefined ? settings.temperature : 1.5
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
    <div className="space-y-6">
      
      {/* Top Header Card */}
      <div className="card-chill p-6 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[#60a5fa]">
            <TestTube className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white tracking-tight">{t('sandbox.title', lang)}</h1>
            <p className="text-xs text-zinc-400 mt-0.5">{t('sandbox.desc', lang)}</p>
          </div>
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

      {/* Editor & Output Grid (Symmetric Height Items Stretch) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        
        {/* Left Card: Input Text Editor */}
        <div className="card-chill p-6 space-y-4 rounded-2xl flex flex-col justify-between h-full">
          <div className="space-y-3 flex-1 flex flex-col">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-2.5">
              <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center space-x-2">
                <BookOpen className="w-3.5 h-3.5 text-zinc-400" />
                <span>{t('sandbox.sourceInputLabel', lang)}</span>
              </span>
              <span className="text-[10px] font-mono text-zinc-500">
                ~{sampleText.length} {lang === 'fr' ? 'caractères' : 'chars'}
              </span>
            </div>

            <textarea
              rows={12}
              value={sampleText}
              onChange={(e) => setSampleText(e.target.value)}
              placeholder={lang === 'fr' ? 'Saisissez un extrait ou chargez un livre...' : 'Enter an excerpt or import a book...'}
              className="w-full input-chill p-4 text-xs font-mono leading-relaxed bg-black/40 flex-1 min-h-[320px] resize-none"
            />
          </div>

          {/* Action Control Bar */}
          <div className="pt-3.5 border-t border-white/[0.08] flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center space-x-2">
              <select
                value={selectedModel || settings.model || ''}
                onChange={(e) => {
                  const m = e.target.value;
                  setSelectedModel(m);
                  if (onSelectModel) onSelectModel(m);
                }}
                className="input-chill px-3 py-1.5 text-xs text-zinc-200 font-mono max-w-[200px] truncate"
              >
                {!selectedModel && settings.model && (
                  <option value="">{t('dashboard.model', lang)}: {settings.model}</option>
                )}
                {availableModels.length > 0 ? (
                  availableModels.map((m) => <option key={m} value={m}>{m}</option>)
                ) : (
                  <option value={settings.model}>{settings.model}</option>
                )}
              </select>
              <span className="text-[10px] text-zinc-500 font-mono">Temp: {settings.temperature !== undefined ? settings.temperature : 1.5}</span>
            </div>

            <button
              onClick={handleRunTest}
              disabled={loading || !sampleText || extracting}
              className="btn-orange px-5 py-2 text-xs flex items-center space-x-2 disabled:opacity-40"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4 fill-white" />
              )}
              <span>{loading ? (lang === 'fr' ? 'Traduction en cours...' : 'Processing inference...') : t('sandbox.runInference', lang)}</span>
            </button>
          </div>
        </div>

        {/* Right Card: Translation Output Result */}
        <div className="card-chill p-6 space-y-4 rounded-2xl flex flex-col justify-between h-full">
          <div className="space-y-3 flex-1 flex flex-col">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-2.5">
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center space-x-2">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t('sandbox.resultOutputLabel', lang)}</span>
              </span>

              {result && (
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    ⚡ {(result.execution_time_ms / 1000).toFixed(2)}s
                  </span>
                  <button
                    onClick={handleCopyResult}
                    className="p-1 text-zinc-400 hover:text-white transition-colors"
                    title={t('sandbox.copyResult', lang)}
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )}
            </div>

            {/* Stretched Display Container with Centered Empty State */}
            <div className="w-full input-chill p-4 text-xs font-mono leading-relaxed bg-black/40 flex-1 min-h-[320px] overflow-y-auto flex flex-col">
              {result ? (
                <div className="text-zinc-100 whitespace-pre-wrap w-full text-left">{result.translated_text}</div>
              ) : (
                <div className="flex-1 w-full flex flex-col items-center justify-center text-center p-8 text-zinc-500 space-y-3 my-auto">
                  <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-zinc-500">
                    <TestTube className="w-6 h-6 stroke-1" />
                  </div>
                  <p className="text-xs text-zinc-400 max-w-xs leading-relaxed">
                    {lang === 'fr' ? (
                      <>Cliquez sur <strong className="text-white">« Tester le Modèle »</strong> pour générer l'aperçu en direct.</>
                    ) : (
                      <>Click <strong className="text-white">"Run Test Inference"</strong> to generate a live preview.</>
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Footer Bar (Symmetric height match) */}
          <div className="pt-3.5 border-t border-white/[0.08] text-[10px] text-zinc-500 font-mono flex items-center justify-between h-[38px]">
            {result ? (
              <>
                <span>{t('dashboard.model', lang)}: <strong className="text-zinc-300">{result.model_used}</strong></span>
                <span>{t('dashboard.provider', lang)}: <strong className="text-zinc-300">{settings.apiType || 'OpenAI API'}</strong></span>
              </>
            ) : (
              <span className="text-zinc-600 text-center w-full">{lang === 'fr' ? 'En attente de génération...' : 'Waiting for inference...'}</span>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
