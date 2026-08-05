import React, { useState, useEffect } from 'react';
import { UploadCloud, BookOpen, Play, Pause, RefreshCw, Download, Trash2, ChevronRight, AlertCircle, Cpu, ArrowRight, TestTube, Layers, Globe, ArrowLeftRight } from 'lucide-react';
import { uploadBook, startJob, pauseJob, retryJob, deleteJob, fetchJobs, fetchGlossaries, cloneJobForProofread } from '../api';
import { t, AVAILABLE_LANGUAGES } from '../i18n/translations';

const PROVIDER_NAMES = {
  openai: 'OpenAI',
  claude: 'Claude (Anthropic)',
  gemini: 'Gemini (Google)',
  deepseek: 'DeepSeek',
  openrouter: 'OpenRouter',
  minimax: 'Minimax',
  kimi: 'Kimi (Moonshot)',
  glm: 'GLM (Zhipu AI)',
  'lm-studio': 'LM Studio (Local)',
  ollama: 'Ollama (Local)',
};

export default function Dashboard({ onSelectJob, settings, endpointStatus, availableModels, setActiveTab, lang = 'en', onSelectModel }) {
  const [jobMode, setJobMode] = useState('translation'); // 'translation' or 'proofreading'
  const [proofreadSourceType, setProofreadSourceType] = useState('existing'); // 'existing' or 'upload'
  const [selectedExistingJobId, setSelectedExistingJobId] = useState('');
  
  const [file, setFile] = useState(null);
  const [sourceLang, setSourceLang] = useState('en');
  const [targetLang, setTargetLang] = useState('fr');
  const [selectedModel, setSelectedModel] = useState(settings.model || '');
  const [selectedGlossary, setSelectedGlossary] = useState('');
  const [glossaries, setGlossaries] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadJobs();
    loadGlossariesList();

    const eventSource = new EventSource('/api/events');
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'job_started' || data.type === 'job_paused' || data.type === 'job_auto_paused' || data.type === 'job_completed' || data.type === 'job_created') {
          loadJobs();
        }
      } catch (e) {
        console.error(e);
      }
    };

    const timer = setInterval(() => {
      loadJobs();
    }, 3500);
    return () => {
      eventSource.close();
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (settings.model) {
      setSelectedModel(settings.model);
    } else if (availableModels.length > 0 && !selectedModel) {
      setSelectedModel(availableModels[0]);
    }
  }, [settings.model, availableModels]);

  const loadJobs = async () => {
    try {
      const data = await fetchJobs();
      setJobs(data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadGlossariesList = async () => {
    try {
      const list = await fetchGlossaries();
      setGlossaries(list);
    } catch (e) {
      console.error(e);
    }
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const f = e.dataTransfer.files[0];
      if (f.name.endsWith('.epub') || f.name.endsWith('.pdf')) {
        setFile(f);
        setError(null);
      } else {
        setError('Seuls les fichiers .epub et .pdf sont acceptés.');
      }
    }
  };

  const handleUploadSubmit = async (e, autoStart = true) => {
    if (e) e.preventDefault();
    setUploading(true);
    setError(null);

    try {
      let newJob;

      if (jobMode === 'proofreading' && proofreadSourceType === 'existing') {
        if (!selectedExistingJobId) {
          setError('Veuillez sélectionner un livre existant dans la base.');
          setUploading(false);
          return;
        }
        const chosenModel = selectedModel || settings.model;
        newJob = await cloneJobForProofread(selectedExistingJobId, chosenModel);
      } else {
        if (!file) {
          setError('Veuillez sélectionner un fichier (EPUB, PDF, DOCX, MD, TXT).');
          setUploading(false);
          return;
        }
        const chosenModel = selectedModel || settings.model;
        const formData = new FormData();
        formData.append('file', file);
        formData.append('source_lang', sourceLang);
        formData.append('target_lang', targetLang);
        formData.append('model', chosenModel);
        formData.append('chunk_size', settings.chunkSize || 1000);
        formData.append('temperature', jobMode === 'proofreading' ? 0.15 : (settings.temperature !== undefined ? settings.temperature : 0.15));
        formData.append('concurrency', settings.concurrency || 1);
        formData.append('job_type', jobMode);
        if (settings.systemPrompt) {
          formData.append('system_prompt', settings.systemPrompt);
        }
        if (selectedGlossary) formData.append('glossary_name', selectedGlossary);

        newJob = await uploadBook(formData);
      }

      if (autoStart && newJob) {
        const chosenModel = selectedModel || settings.model;
        await startJob(newJob.id, {
          endpoint: settings.endpoint,
          apiKey: settings.apiKey,
          apiType: settings.apiType,
          model: chosenModel,
          concurrency: settings.concurrency || 1,
          temperature: jobMode === 'proofreading' ? 0.15 : settings.temperature
        });
      }

      setFile(null);
      await loadJobs();
      onSelectJob(newJob.id);
      setActiveTab('jobs');
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleStartResumeJob = async (e, jobId) => {
    e.stopPropagation();
    setJobs((prev) => prev.map((j) => j.id === jobId ? { ...j, status: 'PROCESSING' } : j));
    try {
      await startJob(jobId, {
        endpoint: settings.endpoint,
        apiKey: settings.apiKey,
        apiType: settings.apiType,
        model: settings.model,
        concurrency: settings.concurrency,
        temperature: settings.temperature,
        enableProofreading: settings.enableProofreading
      });
    } catch (err) {
      console.error(err);
    }
    await loadJobs();
  };

  const handlePauseJob = async (e, jobId) => {
    e.stopPropagation();
    setJobs((prev) => prev.map((j) => j.id === jobId ? { ...j, status: 'PAUSED' } : j));
    try {
      await pauseJob(jobId);
    } catch (err) {
      console.error(err);
    }
    await loadJobs();
  };

  const handleRetryJob = async (e, jobId) => {
    e.stopPropagation();
    setJobs((prev) => prev.map((j) => j.id === jobId ? { ...j, status: 'PROCESSING' } : j));
    try {
      await retryJob(jobId);
      await startJob(jobId, {
        endpoint: settings.endpoint,
        apiKey: settings.apiKey,
        concurrency: settings.concurrency,
        temperature: settings.temperature
      });
    } catch (err) {
      console.error(err);
    }
    await loadJobs();
  };

  const handleDeleteJob = async (e, jobId, fileName) => {
    e.stopPropagation();
    if (!window.confirm(`Supprimer définitivement le projet "${fileName}" ?`)) return;
    setJobs((prev) => prev.filter((j) => j.id !== jobId));
    deleteJob(jobId).catch(console.error);
  };

  return (
    <div className="space-y-8">
      
      {/* Connection Warning Banner */}
      {!endpointStatus && (
        <div className="card-chill p-4 border border-rose-500/30 border-l-4 border-l-rose-500 bg-rose-500/5 text-zinc-200 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
            <span>
              <strong className="text-white">{t('nav.unreachableBanner', lang)}</strong> {t('nav.checkServerUrl', lang)} <code className="bg-black/50 px-2 py-0.5 rounded text-zinc-300 font-mono">{settings.endpoint}</code>.
            </span>
          </div>
          <button
            onClick={() => setActiveTab('settings')}
            className="btn-chill px-3 py-1 text-[11px] font-bold text-zinc-200 hover:text-white"
          >
            {t('nav.configureIp', lang)}
          </button>
        </div>
      )}

      {/* Main Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Upload Card (2 cols) */}
        <div className="lg:col-span-2 card-chill p-6 sm:p-8 space-y-6">
          
          <div className="flex items-start justify-between flex-wrap gap-2">
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-base text-white tracking-tight flex items-center space-x-2 truncate">
                <UploadCloud className="w-5 h-5 text-white flex-shrink-0" />
                <span className="truncate">Importer un document</span>
              </h2>
              <p className="text-xs text-[#888] mt-0.5">Glissez-déposez votre fichier EPUB, PDF, DOCX, MD ou TXT</p>
            </div>
            <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-[#888] bg-white/[0.04] px-2.5 py-1 rounded-md border border-white/[0.08] flex-shrink-0">
              EPUB / PDF / DOCX / MD / TXT
            </span>
          </div>

          {error && (
            <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 border-l-4 border-l-rose-500 text-zinc-200 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Mode Switcher Tabs */}
          <div className="p-1 rounded-xl bg-black/40 border border-white/[0.08] grid grid-cols-2 gap-1 text-xs">
            <button
              type="button"
              onClick={() => setJobMode('translation')}
              className={`py-2 px-4 rounded-lg font-medium transition-colors duration-100 flex items-center justify-center space-x-2 border ${
                jobMode === 'translation'
                  ? 'bg-white/10 text-white border-white/15 shadow-sm backdrop-blur-md'
                  : 'bg-transparent text-[#888] border-transparent hover:text-white hover:bg-white/[0.02]'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>{lang === 'fr' ? 'Mode Traduction' : 'Translation Mode'}</span>
            </button>
            <button
              type="button"
              onClick={() => setJobMode('proofreading')}
              className={`py-2 px-4 rounded-lg font-medium transition-colors duration-100 flex items-center justify-center space-x-2 border ${
                jobMode === 'proofreading'
                  ? 'bg-white/10 text-white border-white/15 shadow-sm backdrop-blur-md'
                  : 'bg-transparent text-[#888] border-transparent hover:text-white hover:bg-white/[0.02]'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Mode Relecture & Correction</span>
            </button>
          </div>

          {/* Language Selector Bar (Source & Target Languages) */}
          <div className="p-3.5 rounded-xl bg-black/40 border border-white/[0.08] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-[#888] uppercase tracking-wider flex items-center space-x-1.5">
                <Globe className="w-3.5 h-3.5 text-[#60a5fa]" />
                <span>{lang === 'fr' ? 'Langues du projet' : 'Project Languages'}</span>
              </span>
              <span className="text-[11px] font-mono text-[#60a5fa] font-bold">
                {sourceLang.toUpperCase()} ➔ {targetLang.toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-2.5 items-center">
              {/* Source Language */}
              <div>
                <label className="block text-[9px] text-[#666] uppercase font-bold mb-1">
                  {lang === 'fr' ? 'Langue Source (Original)' : 'Source Language (Original)'}
                </label>
                <select
                  value={sourceLang}
                  onChange={(e) => setSourceLang(e.target.value)}
                  className="w-full input-chill px-3 py-1.5 text-xs text-zinc-200 cursor-pointer"
                >
                  {AVAILABLE_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.flag} {lang === 'fr' ? l.label : l.labelEn}
                    </option>
                  ))}
                </select>
              </div>

              {/* Swap Button */}
              <div className="flex items-center justify-center sm:pt-4">
                <button
                  type="button"
                  onClick={() => {
                    if (sourceLang !== 'auto') {
                      const temp = sourceLang;
                      setSourceLang(targetLang);
                      setTargetLang(temp);
                    }
                  }}
                  className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-400 hover:text-white transition-all"
                  title={lang === 'fr' ? 'Inverser les langues' : 'Swap languages'}
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Target Language */}
              <div>
                <label className="block text-[9px] text-[#666] uppercase font-bold mb-1">
                  {lang === 'fr' ? 'Langue Cible (Traduction)' : 'Target Language (Translation)'}
                </label>
                <select
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  className="w-full input-chill px-3 py-1.5 text-xs text-zinc-200 cursor-pointer"
                >
                  {AVAILABLE_LANGUAGES.filter(l => l.code !== 'auto').map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.flag} {lang === 'fr' ? l.label : l.labelEn}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Sub-selector if Proofreading mode is active */}
          {jobMode === 'proofreading' && (
            <div className="flex items-center space-x-4 p-3 rounded-lg bg-white/[0.02] border border-white/[0.08] text-xs">
              <span className="text-[#666] font-bold uppercase tracking-widest text-[9px]">Source :</span>
              <label className="flex items-center space-x-2 cursor-pointer text-zinc-300 font-medium">
                <input
                  type="radio"
                  name="proofreadSource"
                  checked={proofreadSourceType === 'existing'}
                  onChange={() => setProofreadSourceType('existing')}
                  className="accent-white"
                />
                <span>Livre de la base de données</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer text-zinc-300 font-medium">
                <input
                  type="radio"
                  name="proofreadSource"
                  checked={proofreadSourceType === 'upload'}
                  onChange={() => setProofreadSourceType('upload')}
                  className="accent-white"
                />
                <span>Importer un nouveau fichier</span>
              </label>
            </div>
          )}

          <form onSubmit={handleUploadSubmit} className="space-y-6">
            
            {/* If proofreading from existing DB book */}
            {jobMode === 'proofreading' && proofreadSourceType === 'existing' ? (
              <div className="space-y-2 p-6 rounded-lg bg-[#070708] border border-white/[0.08]">
                <label className="block text-xs font-semibold text-white uppercase tracking-wider">
                  Sélectionner un livre existant à relire
                </label>
                <select
                  value={selectedExistingJobId}
                  onChange={(e) => setSelectedExistingJobId(e.target.value)}
                  className="w-full input-chill px-3 py-2.5 text-xs font-medium"
                >
                  <option value="">-- Choisir un projet dans la base --</option>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.file_name} ({j.completed_chunks}/{j.total_chunks} chunks - {j.status})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-[#666]">
                  Le système va dupliquer le livre en mode Relecture & Correction avec le prompt d'édition senior.
                </p>
              </div>
            ) : (
              /* Dropzone */
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
                className={`border border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer relative overflow-hidden group ${
                  file
                    ? 'border-[#2563eb]/50 bg-[#2563eb]/5'
                    : 'border-white/10 hover:bg-white/[0.02] bg-[#030303]/30'
                }`}
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/[0.02] to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                <input
                  type="file"
                  accept=".epub,.pdf,.docx,.md,.txt"
                  className="hidden"
                  id="file-upload"
                  onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])}
                />
                <label htmlFor="file-upload" className="cursor-pointer block space-y-4 relative z-10">
                  <div className="flex gap-4 mb-4 justify-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-400 border border-white/5 shadow-inner">
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-600/10 text-purple-400 border border-white/5 shadow-inner">
                      <Layers className="h-5 w-5" />
                    </div>
                  </div>
                  {file ? (
                    <div>
                      <p className="font-semibold text-white text-xs">{file.name}</p>
                      <p className="text-[10px] text-[#888] mt-1 font-mono">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                  ) : (
                    <div>
                      <p className="font-medium text-zinc-300 text-xs">
                        {jobMode === 'proofreading' ? 'Déposez le document à relire et corriger' : 'Déposez votre document ici ou cliquez pour choisir'}
                      </p>
                      <p className="text-[10px] text-[#666] mt-1">Fichiers EPUB, PDF, DOCX, Markdown (.md) ou Texte (.txt)</p>
                    </div>
                  )}
                </label>
              </div>
            )}

            {/* Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-semibold text-[#888] uppercase tracking-wider mb-1.5">Modèle LLM</label>
                <select
                  value={selectedModel}
                  onChange={(e) => {
                    const newM = e.target.value;
                    setSelectedModel(newM);
                    if (onSelectModel) onSelectModel(newM);
                  }}
                  className="w-full input-chill px-3 py-2 text-xs text-zinc-200"
                >
                  {availableModels.length > 0 ? (
                    availableModels.map((m) => <option key={m} value={m}>{m}</option>)
                  ) : (
                    <option value={settings.model}>{settings.model}</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[#888] uppercase tracking-wider mb-1.5">Glossaire Littéraire</label>
                <select
                  value={selectedGlossary}
                  onChange={(e) => setSelectedGlossary(e.target.value)}
                  className="w-full input-chill px-3 py-2 text-xs text-zinc-200"
                >
                  <option value="">Aucun glossaire</option>
                  {glossaries.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>

            {/* Submit Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={(e) => handleUploadSubmit(e, true)}
                disabled={uploading || (jobMode === 'proofreading' && proofreadSourceType === 'existing' ? !selectedExistingJobId : !file)}
                className={`py-2.5 text-xs font-semibold flex items-center justify-center space-x-2 disabled:opacity-40 rounded-lg transition-all ${
                  jobMode === 'proofreading'
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'btn-orange shadow-none'
                }`}
              >
                {uploading ? (
                  <span>Analyse en cours...</span>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{jobMode === 'proofreading' ? 'Démarrer la Relecture' : 'Démarrer la Traduction'}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={(e) => handleUploadSubmit(e, false)}
                disabled={uploading || (jobMode === 'proofreading' && proofreadSourceType === 'existing' ? !selectedExistingJobId : !file)}
                className="py-2.5 bg-white/[0.04] hover:bg-white/[0.08] text-[#ededed] border border-white/[0.08] text-xs font-semibold rounded-lg transition-all flex items-center justify-center space-x-2 disabled:opacity-40"
                title="Découpe le livre en segments et l'envoie dans l'inspecteur sans lancer"
              >
                {uploading ? (
                  <span>Analyse en cours...</span>
                ) : (
                  <>
                    <Layers className="w-3.5 h-3.5" />
                    <span>{jobMode === 'proofreading' ? 'Préparer la Relecture (Sans lancer)' : 'Préparer & Inspecter (Sans lancer)'}</span>
                  </>
                )}
              </button>
            </div>

          </form>
        </div>

        {/* Status Card (1 col) */}
        <div className="space-y-6">
          <div className="card-chill p-6 space-y-5">
            <h3 className="text-xs font-semibold text-[#888] uppercase tracking-wider flex items-center space-x-1.5">
              <Cpu className="w-4 h-4 text-white" />
              <span>Paramètres du Serveur</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-2 border-b border-white/[0.08]">
                <span className="text-[#666]">Fournisseur</span>
                <span className="font-mono text-zinc-300 truncate max-w-[150px]">{PROVIDER_NAMES[settings.apiType] || settings.apiType || 'OpenAI'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/[0.08]">
                <span className="text-[#666]">Modèle Actif</span>
                <span className="font-mono text-[#60a5fa] truncate max-w-[150px]">{settings.model}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/[0.08]">
                <span className="text-[#666]">Concurrence</span>
                <span className="font-bold text-emerald-400">{(settings.concurrency || 1)} requêtes</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-[#666]">Fenêtre Sémantique</span>
                <span className="font-bold text-zinc-300">{(settings.chunkSize || 1000)} tokens</span>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('settings')}
              className="w-full btn-chill py-2 text-xs font-semibold flex items-center justify-center space-x-2"
            >
              <span>Modifier la configuration</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="card-chill p-6 space-y-3">
            <h3 className="text-xs font-semibold text-[#888] uppercase tracking-wider flex items-center space-x-1.5">
              <TestTube className="w-4 h-4 text-white" />
              <span>Testeur en Direct</span>
            </h3>
            <p className="text-xs text-[#888] leading-relaxed">
              Testez vos phrases et votre modèle en 2 secondes sans importer de livre.
            </p>
            <button
              onClick={() => setActiveTab('sandbox')}
              className="w-full py-2 bg-white/[0.04] hover:bg-white/[0.08] text-white text-xs font-semibold rounded-lg border border-white/[0.08] transition-all flex items-center justify-center space-x-2"
            >
              <span>Ouvrir le Bac à Sable</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

      {/* Projects List with Direct Controls & Download Buttons */}
      <div className="space-y-4">
        <h2 className="font-semibold text-sm text-white tracking-tight flex items-center space-x-2">
          <Layers className="w-4 h-4 text-white" />
          <span>Projets enregistrés ({jobs.length})</span>
        </h2>

        {jobs.length === 0 ? (
          <div className="card-chill p-12 text-center text-[#666] text-xs">
            Aucun projet enregistré. Glissez un livre ci-dessus pour démarrer.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {jobs.map((j) => {
              const percent = j.total_chunks > 0 ? Math.round((j.completed_chunks / j.total_chunks) * 100) : 0;
              const truncatedName = j.file_name.length > 32 ? j.file_name.slice(0, 32) + '...' : j.file_name;
              
              return (
                <div
                  key={j.id}
                  onClick={() => { onSelectJob(j.id); setActiveTab('jobs'); }}
                  className="card-chill card-chill-hover p-5 cursor-pointer space-y-4 relative group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-[#888] bg-white/[0.04] px-2 py-0.5 rounded border border-white/[0.08]">
                      {j.file_type.toUpperCase()}
                    </span>

                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${
                        j.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        j.status === 'PROCESSING' ? 'bg-[#2563eb]/10 text-[#60a5fa] border border-[#2563eb]/20 animate-pulse' :
                        'bg-white/[0.04] text-[#888] border border-white/[0.08]'
                      }`}>
                        {j.status}
                      </span>
                      
                      <button
                        onClick={(e) => handleDeleteJob(e, j.id, j.file_name)}
                        className="text-[#444] hover:text-rose-400 p-1 transition-colors"
                        title="Supprimer ce projet"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-white text-xs truncate" title={j.file_name}>{truncatedName}</h3>
                    <p className="text-[10px] text-[#666] mt-0.5 font-mono truncate">Modèle: {j.model}</p>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-medium">
                      <span className="text-[#888]">Progression</span>
                      <span className="text-[#60a5fa] font-semibold">{percent}% ({j.completed_chunks}/{j.total_chunks})</span>
                    </div>
                    <div className="w-full h-1.5 bg-black rounded-full overflow-hidden border border-white/[0.08]">
                      <div
                        className="h-full bg-gradient-to-r from-[#2563eb] to-[#60a5fa] rounded-full transition-all duration-300"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  {/* Direct Controls & Download bar directly on the Card */}
                  <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      {j.status === 'PROCESSING' ? (
                        <button
                          onClick={(e) => handlePauseJob(e, j.id)}
                          className="px-2.5 py-1 bg-white/[0.04] hover:bg-white/[0.08] text-white border border-white/[0.08] rounded-md text-[10px] font-medium flex items-center space-x-1"
                        >
                          <Pause className="w-3 h-3 text-[#ff6369]" />
                          <span>Pause</span>
                        </button>
                      ) : (
                        <button
                          onClick={(e) => handleStartResumeJob(e, j.id)}
                          className="px-2.5 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-md text-[10px] font-medium flex items-center space-x-1 transition-all"
                        >
                          <Play className="w-3 h-3 fill-blue-300 text-blue-300" />
                          <span>{j.completed_chunks > 0 ? 'Reprendre' : 'Lancer'}</span>
                        </button>
                      )}

                      <a
                        href={`/api/jobs/${j.id}/download?t=${Date.now()}`}
                        onClick={(e) => e.stopPropagation()}
                        target="_blank"
                        rel="noreferrer"
                        className={`px-2.5 py-1 rounded-md text-[10px] font-medium flex items-center space-x-1 transition-all ${
                          j.status === 'COMPLETED' || j.completed_chunks > 0
                            ? 'bg-white/[0.04] hover:bg-white/[0.08] text-white border border-white/[0.08]'
                            : 'opacity-20 pointer-events-none'
                        }`}
                        title="Télécharger le fichier EPUB/PDF traduit"
                      >
                        <Download className="w-3 h-3" />
                        <span>EPUB</span>
                      </a>
                    </div>

                    <span className="text-[#666] group-hover:text-white flex items-center space-x-1 text-[10px] font-medium transition-colors">
                      <span>Inspecter</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
