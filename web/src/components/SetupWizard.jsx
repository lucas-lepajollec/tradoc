import React, { useState, useEffect } from 'react';
import { Cpu, Cloud, BookOpen, FileText, Library, Bookmark, CheckCircle2, Sparkles, ArrowRight, ShieldCheck, Zap, Sliders, TrendingDown } from 'lucide-react';
import { t } from '../i18n/translations';

export default function SetupWizard({ settings, onSaveSettings, setActiveTab, lang = 'en' }) {
  // Mode selection: 'local' (Free & Private) or 'cloud' (Fast API)
  const [mode, setMode] = useState('local');
  
  // Book size in pages (up to 3000 pages)
  const [pages, setPages] = useState(350);

  // Advanced customizable parameters
  const [chunkSize, setChunkSize] = useState(1000);
  const [concurrency, setConcurrency] = useState(1);
  const [inputPrice, setInputPrice] = useState(0.14);
  const [outputPrice, setOutputPrice] = useState(0.28);
  const [enableCaching, setEnableCaching] = useState(true);

  // Auto-tune default recommended parameters when mode changes
  useEffect(() => {
    if (mode === 'local') {
      setChunkSize(1000);
      setConcurrency(1);
    } else {
      setChunkSize(6000);
      setConcurrency(6);
    }
  }, [mode]);

  // Calculations
  const wordsCount = pages * 275;
  const totalTokens = Math.round(wordsCount * 1.35);
  const totalRequests = Math.max(1, Math.ceil(totalTokens / chunkSize));

  // Prompt Caching Math: System Prompt + Glossary + Literary Guidelines (~4,500 tokens per chunk)
  const promptPrefixPerChunk = 4500;
  const baseInputTokens = (totalRequests * promptPrefixPerChunk) + totalTokens;
  const rawInputCost = (baseInputTokens / 1000000) * inputPrice;

  let computedInputCost = rawInputCost;

  if (enableCaching && mode === 'cloud' && totalRequests > 1) {
    const firstChunkContent = totalTokens / totalRequests;
    const firstRequestTokens = promptPrefixPerChunk + firstChunkContent;
    const firstRequestCost = (firstRequestTokens / 1000000) * inputPrice;

    const remainingContentTokens = totalTokens - firstChunkContent;
    const remainingCachedPromptTokens = (totalRequests - 1) * promptPrefixPerChunk;

    const remainingContentCost = (remainingContentTokens / 1000000) * inputPrice;
    const remainingCachedPromptCost = (remainingCachedPromptTokens / 1000000) * inputPrice * 0.10;

    computedInputCost = firstRequestCost + remainingContentCost + remainingCachedPromptCost;
  }

  const computedOutputCost = (totalTokens / 1000000) * outputPrice;
  const totalCostNumber = computedInputCost + computedOutputCost;
  const totalCost = totalCostNumber.toFixed(2);

  const rawTotalCostNumber = rawInputCost + computedOutputCost;
  const cachingSavings = Math.max(0, rawTotalCostNumber - totalCostNumber).toFixed(2);

  const handleApplySettings = () => {
    if (onSaveSettings && settings) {
      onSaveSettings({
        ...settings,
        chunkSize: Number(chunkSize),
        concurrency: Number(concurrency)
      });
    }
    if (setActiveTab) {
      setActiveTab('dashboard');
    }
  };

  return (
    <div className="space-y-5">
      
      {/* Perfectly Balanced Bento Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Left Column: Configuration Controls (7 Cols) */}
        <div className="lg:col-span-7 space-y-5 flex flex-col justify-between">
          
          {/* Bento Box 1: Mode Switcher */}
          <div className="card-chill p-6 lg:p-7 space-y-4 rounded-2xl">
            <h2 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-[#60a5fa]" />
              <span>1. Environnement d'Exécution</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              
              {/* Local Card */}
              <div
                onClick={() => setMode('local')}
                className={`p-4 rounded-xl cursor-pointer transition-all duration-150 border flex flex-col justify-between space-y-3 ${
                  mode === 'local'
                    ? 'bg-white/[0.08] border-white/30 text-white shadow-sm'
                    : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:bg-white/[0.05] hover:border-white/[0.14]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[#60a5fa]">
                    <Cpu className="w-4 h-4" />
                  </div>
                  {mode === 'local' && (
                    <span className="text-[9px] font-bold font-mono px-2.5 py-0.5 rounded bg-white/10 text-white border border-white/20 uppercase">
                      Actif
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-white">Serveur GPU Local</h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5 leading-normal">Ollama, LM Studio, Qwen 3.5</p>
                </div>
                <div className="pt-2.5 border-t border-white/[0.06] text-[11px] text-emerald-400 font-mono font-semibold flex items-center space-x-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>100% Gratuit & Privé</span>
                </div>
              </div>

              {/* Cloud Card */}
              <div
                onClick={() => setMode('cloud')}
                className={`p-4 rounded-xl cursor-pointer transition-all duration-150 border flex flex-col justify-between space-y-3 ${
                  mode === 'cloud'
                    ? 'bg-white/[0.08] border-white/30 text-white shadow-sm'
                    : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:bg-white/[0.05] hover:border-white/[0.14]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
                    <Cloud className="w-4 h-4" />
                  </div>
                  {mode === 'cloud' && (
                    <span className="text-[9px] font-bold font-mono px-2.5 py-0.5 rounded bg-white/10 text-white border border-white/20 uppercase">
                      Actif
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-white">API Cloud en Ligne</h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5 leading-normal">DeepSeek, OpenAI, Claude</p>
                </div>
                <div className="pt-2.5 border-t border-white/[0.06] text-[11px] text-purple-300 font-mono font-semibold flex items-center space-x-1">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Haute Vitesse par Chapitres</span>
                </div>
              </div>

            </div>
          </div>

          {/* Bento Box 2: Ultra-Pro Book Pages Selection Bar */}
          <div className="card-chill p-6 lg:p-7 space-y-4 rounded-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center space-x-2">
                <BookOpen className="w-4 h-4 text-[#60a5fa]" />
                <span>2. Taille du Livre</span>
              </h2>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min="20"
                  max="3000"
                  value={pages}
                  onChange={(e) => setPages(Math.max(20, Math.min(3000, parseInt(e.target.value, 10) || 20)))}
                  className="w-20 input-chill px-2.5 py-1 text-center text-xs font-mono text-white font-bold"
                />
                <span className="text-xs text-zinc-400 font-medium">pages</span>
              </div>
            </div>

            {/* Pro Range Slider */}
            <div className="space-y-1.5 py-1">
              <input
                type="range"
                min={20}
                max={3000}
                step={10}
                value={pages}
                onChange={(e) => setPages(parseInt(e.target.value, 10))}
                className="w-full cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                <span>20 p.</span>
                <span>1 500 p.</span>
                <span>3 000 p.</span>
              </div>
            </div>

            {/* Pro Preset Icon Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                type="button"
                onClick={() => setPages(50)}
                className={`py-2 px-3 rounded-xl text-xs font-medium border flex items-center justify-center space-x-1.5 transition-all ${
                  pages === 50
                    ? 'bg-white/10 text-white border-white/20 font-semibold'
                    : 'bg-white/[0.02] text-zinc-400 border-white/[0.06] hover:bg-white/[0.05] hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-zinc-400" />
                <span>Nouvelle (50 p.)</span>
              </button>

              <button
                type="button"
                onClick={() => setPages(300)}
                className={`py-2 px-3 rounded-xl text-xs font-medium border flex items-center justify-center space-x-1.5 transition-all ${
                  pages === 300
                    ? 'bg-white/10 text-white border-white/20 font-semibold'
                    : 'bg-white/[0.02] text-zinc-400 border-white/[0.06] hover:bg-white/[0.05] hover:text-white'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 text-zinc-400" />
                <span>Roman (300 p.)</span>
              </button>

              <button
                type="button"
                onClick={() => setPages(800)}
                className={`py-2 px-3 rounded-xl text-xs font-medium border flex items-center justify-center space-x-1.5 transition-all ${
                  pages === 800
                    ? 'bg-white/10 text-white border-white/20 font-semibold'
                    : 'bg-white/[0.02] text-zinc-400 border-white/[0.06] hover:bg-white/[0.05] hover:text-white'
                }`}
              >
                <Library className="w-3.5 h-3.5 text-zinc-400" />
                <span>Pavé (800 p.)</span>
              </button>

              <button
                type="button"
                onClick={() => setPages(2500)}
                className={`py-2 px-3 rounded-xl text-xs font-medium border flex items-center justify-center space-x-1.5 transition-all ${
                  pages === 2500
                    ? 'bg-white/10 text-white border-white/20 font-semibold'
                    : 'bg-white/[0.02] text-zinc-400 border-white/[0.06] hover:bg-white/[0.05] hover:text-white'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5 text-zinc-400" />
                <span>Intégrale (2500 p.)</span>
              </button>
            </div>
          </div>

          {/* Bento Box 3: Advanced Parameters */}
          <div className="card-chill p-6 lg:p-7 space-y-4 rounded-2xl">
            <h2 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-zinc-400" />
              <span>3. Réglages Fins & Tarifs API</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Chunk Size */}
              <div className="space-y-1">
                <label className="block text-[10px] text-zinc-400 uppercase font-semibold">Taille de Chunk (Tokens)</label>
                <input
                  type="number"
                  step="250"
                  value={chunkSize}
                  onChange={(e) => setChunkSize(parseInt(e.target.value, 10) || 1000)}
                  className="w-full input-chill px-3.5 py-2 text-xs font-mono"
                />
              </div>

              {/* Concurrency */}
              <div className="space-y-1">
                <label className="block text-[10px] text-zinc-400 uppercase font-semibold">Concurrence (Slots)</label>
                <input
                  type="number"
                  min="1"
                  max="16"
                  value={concurrency}
                  onChange={(e) => setConcurrency(parseInt(e.target.value, 10) || 1)}
                  className="w-full input-chill px-3.5 py-2 text-xs font-mono"
                />
              </div>

              {/* API Prices if Cloud */}
              {mode === 'cloud' && (
                <>
                  <div className="space-y-1">
                    <label className="block text-[10px] text-zinc-400 uppercase font-semibold">Prix Input ($/1M tks)</label>
                    <input
                      type="number"
                      step="0.05"
                      value={inputPrice}
                      onChange={(e) => setInputPrice(parseFloat(e.target.value) || 0)}
                      className="w-full input-chill px-3.5 py-2 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] text-zinc-400 uppercase font-semibold">Prix Output ($/1M tks)</label>
                    <input
                      type="number"
                      step="0.05"
                      value={outputPrice}
                      onChange={(e) => setOutputPrice(parseFloat(e.target.value) || 0)}
                      className="w-full input-chill px-3.5 py-2 text-xs font-mono"
                    />
                  </div>

                  <div className="sm:col-span-2 pt-1 border-t border-white/[0.06]">
                    <label className="flex items-center space-x-2.5 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={enableCaching}
                        onChange={(e) => setEnableCaching(e.target.checked)}
                        className="accent-[#2563eb] w-4 h-4"
                      />
                      <span className="text-zinc-200 text-xs">Activer la réduction Prompt Caching (-90%)</span>
                    </label>
                  </div>
                </>
              )}

            </div>
          </div>

        </div>

        {/* Right Column: Live Results Hero Card (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col justify-between">
          
          <div className="card-chill p-6 lg:p-7 rounded-2xl flex flex-col justify-between h-full space-y-6 border border-white/[0.12]">
            
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <h2 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-[#60a5fa]" />
                  <span>Résultats & Projections</span>
                </h2>
                <span className="text-xs font-mono text-zinc-400 bg-white/[0.06] px-2.5 py-1 rounded-lg border border-white/[0.08]">
                  {totalRequests} chunks
                </span>
              </div>

              {/* Volume Metrics */}
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-2 border-b border-white/[0.06]">
                  <span className="text-zinc-400">Volume estimé :</span>
                  <span className="text-white font-mono font-bold">~{wordsCount.toLocaleString()} mots</span>
                </div>
                <div className="flex justify-between py-2 border-b border-white/[0.06]">
                  <span className="text-zinc-400">Total Tokens :</span>
                  <span className="text-white font-mono font-bold">~{totalTokens.toLocaleString()} tokens</span>
                </div>
              </div>

              {/* Cost Highlight Hero Box */}
              <div className="p-6 rounded-2xl bg-black/50 border border-white/[0.1] text-center space-y-2">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">Coût Estimé du Livre</span>
                <span className="text-3xl font-extrabold text-emerald-400 font-mono block tracking-tight">
                  {mode === 'local' ? '0.00 €' : `$${totalCost}`}
                </span>
                <span className="text-xs text-zinc-400 block pt-0.5">
                  {mode === 'local' ? '100% Gratuit sur votre GPU' : `Prix API officiel (${inputPrice}$ in / ${outputPrice}$ out)`}
                </span>

                {mode === 'cloud' && enableCaching && parseFloat(cachingSavings) > 0 && (
                  <div className="pt-2">
                    <span className="inline-flex items-center space-x-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                      <TrendingDown className="w-3.5 h-3.5" />
                      <span>Économie Prompt Caching : -${cachingSavings}</span>
                    </span>
                  </div>
                )}
              </div>

              {/* Architecture Tip */}
              <div className="p-4 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-300 text-xs flex items-start space-x-2.5 leading-relaxed">
                <CheckCircle2 className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                <span className="text-xs">
                  {mode === 'local'
                    ? 'Réglage idéal pour préserver la mémoire GPU et maintenir une excellente fluidité littéraire.'
                    : 'Grands blocs de texte avec Prompt Caching actif pour une traduction ultra-rapide par chapitres.'}
                </span>
              </div>
            </div>

            {/* Disclaimer & Apply Action Button */}
            <div className="pt-4 border-t border-white/[0.08] space-y-2.5">
              <p className="text-[11px] text-zinc-500 italic text-center leading-normal">
                * Note : Ces valeurs sont des estimations calculées sur des moyennes littéraires (~275 mots/page) et sont données à titre indicatif.
              </p>
              <button
                type="button"
                onClick={handleApplySettings}
                className="w-full btn-orange py-3.5 text-xs font-semibold flex items-center justify-center space-x-2"
              >
                <span>Appliquer ces réglages au projet</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
