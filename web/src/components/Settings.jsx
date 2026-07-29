import React, { useState, useEffect } from 'react';
import { Server, Cpu, Sliders, CheckCircle2, AlertCircle, RefreshCw, Save, Trash2, Plus } from 'lucide-react';
import { testConnection } from '../api';

const DEFAULT_LITERARY_PROMPT = `Tu es un traducteur littéraire professionnel expert en Anglais-Français. 
Ta tâche est de traduire le texte anglais fourni en un français fluide, naturel et élégant, digne d'une maison d'édition francophone.

RÈGLES STRICTES :
1. Conservation des noms propres et de l'univers : Ne traduis PAS les noms propres de lieux, de personnages ou les termes spécifiques à l'univers (ex: "Crimson" = "Cramoisi", "Temple" dans le contexte anatomique = "Tempe").
2. Fidélité au texte : Ne saute AUCUNE phrase, n'ajoute AUCUN commentaire, et ne répète JAMAIS de paragraphe.
3. Intégrité des balises : Conserve exactement la structure des balises HTML (<p>, <i>, <b>, etc.) fournies dans le texte.
4. Réponse directe : Renvoie STRICTEMENT ET UNIQUEMENT la traduction du texte. Pas de bavardage, pas de préambule, pas d'explication. N'écris aucune réflexion interne ni balise <think>.`;

export default function Settings({ settings, onSaveSettings, availableModels = [], setAvailableModels }) {
  const [endpoint, setEndpoint] = useState(settings.endpoint);
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [apiType, setApiType] = useState(settings.apiType || 'openai');
  const [model, setModel] = useState(settings.model);
  const [concurrency, setConcurrency] = useState(settings.concurrency || 1);
  const [temperature, setTemperature] = useState(settings.temperature !== undefined ? settings.temperature : 1.5);
  const [chunkSize, setChunkSize] = useState(settings.chunkSize || 1000);
  const [systemPrompt, setSystemPrompt] = useState(settings.systemPrompt || DEFAULT_LITERARY_PROMPT);

  // Dynamic Custom Presets management
  const [customPresets, setCustomPresets] = useState(() => {
    const saved = localStorage.getItem('tradoc_custom_presets');
    return saved ? JSON.parse(saved) : {};
  });
  
  const [selectedPresetKey, setSelectedPresetKey] = useState('literary');
  const [newPresetName, setNewPresetName] = useState('');

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const res = await testConnection(endpoint, apiKey, apiType);
      setTestResult(res);
      if (res.models && res.models.length > 0 && setAvailableModels) {
        setAvailableModels(res.models);
        if (!res.models.includes(model)) {
          setModel(res.models[0]);
        }
      }
    } catch (err) {
      setTestResult({ success: false, message: err.message, models: [] });
    } finally {
      setTesting(false);
    }
  };

  const handlePresetChange = (key) => {
    setSelectedPresetKey(key);
    if (key === 'literary') {
      setSystemPrompt(DEFAULT_LITERARY_PROMPT);
    } else if (customPresets[key]) {
      setSystemPrompt(customPresets[key]);
    }
  };

  const handleSavePreset = () => {
    if (!newPresetName.trim()) return;
    const name = newPresetName.trim();
    const updated = { ...customPresets, [name]: systemPrompt };
    setCustomPresets(updated);
    localStorage.setItem('tradoc_custom_presets', JSON.stringify(updated));
    setSelectedPresetKey(name);
    setNewPresetName('');
    alert(`Preset "${name}" enregistré avec succès !`);
  };

  const handleDeletePreset = (name) => {
    if (name === 'literary') return;
    if (!window.confirm(`Supprimer le preset "${name}" ?`)) return;
    
    const updated = { ...customPresets };
    delete updated[name];
    setCustomPresets(updated);
    localStorage.setItem('tradoc_custom_presets', JSON.stringify(updated));
    
    setSelectedPresetKey('literary');
    setSystemPrompt(DEFAULT_LITERARY_PROMPT);
  };

  const handleSave = (e) => {
    e.preventDefault();
    onSaveSettings({
      endpoint,
      apiKey,
      apiType,
      model,
      concurrency,
      temperature,
      chunkSize,
      systemPrompt,
    });
    alert('Paramètres enregistrés avec succès !');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      <div className="card-chill p-6 sm:p-8 space-y-6">
        
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400 flex items-center justify-center font-bold">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight">Configuration Serveur GPU & Modèles</h1>
              <p className="text-xs text-zinc-400">LM Studio, Ollama & API Spécifications OpenAI</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          
          {/* Connection Test Banner */}
          {testResult && (
            <div className={`p-4 rounded-xl border text-xs flex items-start space-x-3 ${
              testResult.success
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}>
              {testResult.success ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
              <div>
                <p className="font-semibold">{testResult.message}</p>
                {testResult.models?.length > 0 && (
                  <p className="text-[11px] font-mono mt-1 text-emerald-200">
                    Modèles détectés ({testResult.models.length}): {testResult.models.join(', ')}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Endpoint, Server Type & Active Model in Row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Endpoint URL Distant</label>
              <input
                type="text"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="http://192.168.x.x:1234/v1"
                className="w-full input-chill px-4 py-2.5 text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Type de Serveur</label>
              <select
                value={apiType}
                onChange={(e) => setApiType(e.target.value)}
                className="w-full input-chill px-4 py-2.5 text-xs"
              >
                <option value="openai">OpenAI Compatible (LM Studio, vLLM)</option>
                <option value="ollama">Ollama API Native (11434)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Modèle Actif</label>
              {availableModels && availableModels.length > 0 ? (
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full input-chill px-4 py-2.5 text-xs font-mono"
                >
                  {!availableModels.includes(model) && model && (
                    <option value={model}>{model} (Actuel)</option>
                  )}
                  {availableModels.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              ) : (
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full input-chill px-4 py-2.5 text-xs font-mono"
                >
                  <option value="qwen3.5-9b">qwen3.5-9b</option>
                  <option value="translategemma-12b-it">translategemma-12b-it</option>
                  <option value="qwen2.5-14b-instruct">qwen2.5-14b-instruct</option>
                  {model && !['qwen3.5-9b', 'translategemma-12b-it', 'qwen2.5-14b-instruct'].includes(model) && (
                    <option value={model}>{model}</option>
                  )}
                </select>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing}
              className="btn-chill px-4 py-2 text-xs flex items-center space-x-2"
            >
              {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Cpu className="w-3.5 h-3.5 text-orange-400" />}
              <span>{testing ? 'Test en cours...' : 'Tester la Connexion'}</span>
            </button>
          </div>

          {/* Segment Size, Temperature & Concurrency in Row 2 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-white/5">
            
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Taille du segment ({chunkSize} tokens)</label>
              <input
                type="number"
                min={200}
                max={4000}
                step={50}
                value={chunkSize}
                onChange={(e) => setChunkSize(parseInt(e.target.value) || 1000)}
                className="w-full input-chill px-4 py-2 text-xs font-mono"
              />
              <span className="text-[10px] text-zinc-500 font-mono">Recommandé : 1000 par défaut</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">
                Température ({temperature.toFixed(2)})
              </label>
              <input
                type="range"
                min={0}
                max={2.0}
                step={0.05}
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full accent-orange-500 mt-2"
              />
              <span className="text-[10px] text-zinc-500 font-mono">1.50 = Par défaut</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">
                Concurrence Parallèle ({concurrency})
              </label>
              <input
                type="range"
                min={1}
                max={4}
                value={concurrency}
                onChange={(e) => setConcurrency(parseInt(e.target.value))}
                className="w-full accent-orange-500 mt-2"
              />
              <span className="text-[10px] text-zinc-500 font-mono">1 = Vitesse GPU Maximale sans latence</span>
            </div>

          </div>

          {/* System Prompt Presets & Editor */}
          <div className="space-y-4 pt-4 border-t border-white/5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest">Gestionnaire de Presets de Prompt</label>
                <p className="text-[10px] text-zinc-500 mt-0.5">Sélectionnez, modifiez ou créez vos propres presets système</p>
              </div>

              <div className="flex items-center space-x-2">
                <select
                  value={selectedPresetKey}
                  onChange={(e) => handlePresetChange(e.target.value)}
                  className="input-chill px-3 py-1.5 text-xs text-zinc-200"
                >
                  <option value="literary">Preset Littéraire (Par défaut)</option>
                  {Object.keys(customPresets).map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>

                {selectedPresetKey !== 'literary' && (
                  <button
                    type="button"
                    onClick={() => handleDeletePreset(selectedPresetKey)}
                    className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl transition-all"
                    title="Supprimer ce preset"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Editor Textarea */}
            <div className="space-y-2">
              <textarea
                rows={8}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="w-full input-chill p-4 text-xs font-mono leading-relaxed bg-[#0c0d12]"
              />
            </div>

            {/* Create New Preset form */}
            <div className="flex items-center space-x-3 p-3 bg-white/5 rounded-xl border border-white/5">
              <input
                type="text"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                placeholder="Nom du nouveau preset..."
                className="input-chill px-3 py-1.5 text-xs flex-grow font-mono"
              />
              <button
                type="button"
                onClick={handleSavePreset}
                disabled={!newPresetName.trim()}
                className="btn-chill px-4 py-1.5 text-xs flex items-center space-x-2 disabled:opacity-40"
              >
                <Plus className="w-3.5 h-3.5 text-orange-400" />
                <span>Créer Preset</span>
              </button>
            </div>

          </div>

          {/* Save Configuration Button */}
          <div className="flex justify-end pt-4 border-t border-white/5">
            <button
              type="submit"
              className="btn-orange px-6 py-3 text-xs flex items-center space-x-2"
            >
              <Save className="w-4 h-4 fill-white" />
              <span>Enregistrer la Configuration</span>
            </button>
          </div>

        </form>

      </div>

    </div>
  );
}
