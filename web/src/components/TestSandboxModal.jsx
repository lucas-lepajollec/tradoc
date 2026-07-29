import React, { useState, useRef } from 'react';
import { TestTube, Play, Clock, AlertCircle, RefreshCw, Upload, Sparkles, BookOpen } from 'lucide-react';
import { testTranslation, extractSandboxSample } from '../api';

const DEFAULT_SAMPLE = `<p class="title"><span class="text_">CHAPTER 1: THE AWAKENING</span></p>

<p class="body">The crimson sun dipped below the horizon of Noria. "Do you hear the whispers in the fog, Master Klein?" asked Leonard, his eyes fixed upon the ancient clocktower.</p>`;

export default function TestSandboxModal({ settings, availableModels }) {
  const [sampleText, setSampleText] = useState(DEFAULT_SAMPLE);
  const [selectedModel, setSelectedModel] = useState(settings.model || '');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState(null);

  const fileInputRef = useRef(null);

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

  return (
    <div className="card-chill p-6 sm:p-8 space-y-6">
      
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400 flex items-center justify-center font-bold">
            <TestTube className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Bac à Sable d'Aperçu en Direct</h2>
            <p className="text-xs text-zinc-400">Testez vos modèles et vos prompts sur un extrait importé</p>
          </div>
        </div>

        {result && (
          <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-mono">
            ⚡ Traduit en {(result.execution_time_ms / 1000).toFixed(2)}s
          </span>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* EPUB Extraction Section */}
      <div className="p-4 rounded-xl bg-white/5 border border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <BookOpen className="w-5 h-5 text-orange-400" />
          <div>
            <p className="text-xs font-bold text-zinc-200">Importer un extrait depuis un livre</p>
            <p className="text-[10px] text-zinc-500">Extrait automatiquement les premiers {settings.chunkSize || 1000} tokens (taille réglée en configuration)</p>
          </div>
        </div>

        <div>
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
            className="btn-chill px-4 py-2 text-xs flex items-center space-x-2"
          >
            {extracting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 text-orange-400" />}
            <span>{extracting ? "Extraction..." : "Charger un livre (.epub)"}</span>
          </button>
        </div>
      </div>

      {/* Input Box */}
      <div className="space-y-2">
        <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest">Texte / Extrait HTML à Tester</label>
        <textarea
          rows={7}
          value={sampleText}
          onChange={(e) => setSampleText(e.target.value)}
          placeholder="Saisissez un extrait ou chargez un livre..."
          className="w-full input-chill p-4 text-xs font-mono leading-relaxed bg-[#0c0d12]"
        />
      </div>

      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/5 pt-4">
        <div className="flex items-center space-x-3 max-w-full min-w-0">
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="input-chill px-3 py-2.5 text-xs text-zinc-300 font-mono max-w-[200px] sm:max-w-xs truncate"
          >
            {!selectedModel && settings.model && (
              <option value="">Modèle : {settings.model}</option>
            )}
            {availableModels.length > 0 ? (
              availableModels.map((m) => <option key={m} value={m}>{m}</option>)
            ) : (
              <option value={settings.model}>{settings.model}</option>
            )}
          </select>
          <span className="text-[10px] text-zinc-500 font-mono flex-shrink-0">Temp: {settings.temperature !== undefined ? settings.temperature : 1.5}</span>
        </div>

        <button
          onClick={handleRunTest}
          disabled={loading || !sampleText || extracting}
          className="btn-orange px-6 py-3 text-xs flex items-center space-x-2 disabled:opacity-40 w-full sm:w-auto justify-center"
        >
          {loading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4 fill-white" />
          )}
          <span>{loading ? 'Traduction en cours...' : '⚡ Lancer le Test de Traduction'}</span>
        </button>
      </div>

      {/* Output Side-by-Side */}
      {result && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-white/5">
          
          <div className="bg-[#0e0f16] p-4 rounded-xl border border-white/10 space-y-2">
            <div className="flex justify-between text-[11px] text-orange-300 font-mono font-bold uppercase">
              <span>Extrait Original (EN)</span>
            </div>
            <div className="text-xs text-zinc-300 font-mono whitespace-pre-wrap leading-relaxed">
              {result.original_text}
            </div>
          </div>

          <div className="bg-[#0e0f16] p-4 rounded-xl border border-orange-500/30 space-y-2">
            <div className="flex justify-between text-[11px] text-emerald-400 font-mono font-bold uppercase">
              <span>Traduction Résultat (FR)</span>
              <span className="text-zinc-400 font-normal">{result.model_used}</span>
            </div>
            <div className="text-xs text-zinc-100 font-mono whitespace-pre-wrap leading-relaxed">
              {result.translated_text}
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
