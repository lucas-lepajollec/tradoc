import React, { useState, useEffect } from 'react';
import { UploadCloud, BookOpen, Play, Pause, RefreshCw, Download, Trash2, ChevronRight, AlertCircle, Cpu, ArrowRight, TestTube, Layers, Globe, ArrowLeftRight } from 'lucide-react';
import { uploadBook, startJob, pauseJob, retryJob, deleteJob, fetchJobs, fetchGlossaries, cloneJobForProofread, downloadJob, subscribeToEvents } from '../api';
import { t, l, languageLabel, AVAILABLE_LANGUAGES } from '../i18n/translations';

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

const PROVIDER_LOGOS = {
  openai: '/providers/openai.png',
  claude: '/providers/claude.png',
  gemini: '/providers/gemini.png',
  deepseek: '/providers/deepseek.png',
  openrouter: '/providers/openrouter.png',
  minimax: '/providers/minimax.png',
  kimi: '/providers/kimi.png',
  glm: '/providers/glm.png',
  'lm-studio': '/providers/lmstudio.webp',
  ollama: '/providers/ollama.png',
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

    const unsubscribe = subscribeToEvents((data) => {
      if (['job_started', 'job_paused', 'job_auto_paused', 'job_completed', 'job_created', 'job_failed'].includes(data.type)) {
        loadJobs();
      }
    });

    const timer = setInterval(() => {
      loadJobs();
    }, 3500);
    return () => {
      unsubscribe();
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
      if (/\.(epub|pdf|docx|md|txt)$/i.test(f.name)) {
        setFile(f);
        setError(null);
      } else {
        setError(l(lang, 'Accepted formats: EPUB, PDF, DOCX, MD, and TXT.', 'Formats acceptés : EPUB, PDF, DOCX, MD et TXT.', 'Formatos admitidos: EPUB, PDF, DOCX, MD y TXT.', 'Unterstützte Formate: EPUB, PDF, DOCX, MD und TXT.'));
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
          setError(l(lang, 'Select an existing document first.', 'Sélectionnez d’abord un document existant.', 'Selecciona primero un documento existente.', 'Wähle zuerst ein vorhandenes Dokument aus.'));
          setUploading(false);
          return;
        }
        const chosenModel = selectedModel || settings.model;
        newJob = await cloneJobForProofread(selectedExistingJobId, chosenModel);
      } else {
        if (!file) {
          setError(l(lang, 'Select a file (EPUB, PDF, DOCX, MD, or TXT).', 'Sélectionnez un fichier (EPUB, PDF, DOCX, MD ou TXT).', 'Selecciona un archivo (EPUB, PDF, DOCX, MD o TXT).', 'Wähle eine Datei aus (EPUB, PDF, DOCX, MD oder TXT).'));
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
        formData.append('api_type', settings.apiType);
        if (settings.endpoint) formData.append('endpoint', settings.endpoint);
        formData.append('enable_proofreading', !!settings.enableProofreading);
        formData.append('enable_prompt_caching', !!settings.enablePromptCaching);
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
          temperature: jobMode === 'proofreading' ? 0.15 : settings.temperature,
          enableProofreading: settings.enableProofreading,
          enablePromptCaching: settings.enablePromptCaching
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
        enableProofreading: settings.enableProofreading,
        enablePromptCaching: settings.enablePromptCaching
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
        apiType: settings.apiType,
        model: settings.model,
        concurrency: settings.concurrency,
        temperature: settings.temperature,
        enableProofreading: settings.enableProofreading,
        enablePromptCaching: settings.enablePromptCaching
      });
    } catch (err) {
      console.error(err);
    }
    await loadJobs();
  };

  const handleDeleteJob = async (e, jobId, fileName) => {
    e.stopPropagation();
    if (!window.confirm(l(lang, `Permanently delete “${fileName}”?`, `Supprimer définitivement « ${fileName} » ?`, `¿Eliminar “${fileName}” de forma permanente?`, `„${fileName}“ endgültig löschen?`))) return;
    setJobs((prev) => prev.filter((j) => j.id !== jobId));
    deleteJob(jobId).catch(console.error);
  };

  const handleDownload = async (e, jobId) => {
    e.stopPropagation();
    try {
      await downloadJob(jobId);
    } catch (err) {
      setError(err.message);
    }
  };

  const activeJobCount = jobs.filter((item) => item.status === 'PROCESSING').length;

  return (
    <div className="dashboard-page space-y-8">

      <header className="page-intro flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="page-kicker">{l(lang, 'Translation workspace', 'Espace de traduction', 'Espacio de traducción', 'Übersetzungsbereich')}</p>
          <h1>{l(lang, 'Your documents, faithfully translated.', 'Vos documents, fidèlement traduits.', 'Tus documentos, traducidos con fidelidad.', 'Deine Dokumente, originalgetreu übersetzt.')}</h1>
          <p>{l(lang, 'Import a document, choose your languages, and follow every step through export.', 'Importez un document, choisissez vos langues et suivez chaque étape jusqu’à l’export.', 'Importa un documento, elige los idiomas y sigue cada etapa hasta la exportación.', 'Importiere ein Dokument, wähle die Sprachen und begleite jeden Schritt bis zum Export.')}</p>
        </div>
        <div className="page-status-stack">
          <div className="connection-pill active-jobs-pill" title={l(lang, `${activeJobCount} ${activeJobCount === 1 ? 'project' : 'projects'} currently running`, `${activeJobCount} ${activeJobCount > 1 ? 'projets actuellement en cours' : 'projet actuellement en cours'}`, `${activeJobCount} ${activeJobCount === 1 ? 'proyecto en curso' : 'proyectos en curso'}`, `${activeJobCount} laufende${activeJobCount === 1 ? 's Projekt' : ' Projekte'}`)}>
            <span />
            {activeJobCount} {l(lang, activeJobCount === 1 ? 'active project' : 'active projects', activeJobCount > 1 ? 'projets actifs' : 'projet actif', activeJobCount === 1 ? 'proyecto activo' : 'proyectos activos', activeJobCount === 1 ? 'aktives Projekt' : 'aktive Projekte')}
          </div>
          <div className={`connection-pill ${endpointStatus ? 'is-online' : 'is-offline'}`}>
            <span />
            {endpointStatus ? l(lang, 'Service ready', 'Service prêt', 'Servicio listo', 'Dienst bereit') : l(lang, 'Service offline', 'Service hors ligne', 'Servicio sin conexión', 'Dienst offline')}
          </div>
        </div>
      </header>
      
      {/* Connection Warning Banner */}
      {!endpointStatus && (
        <div className="card-chill p-4 border border-rose-500/30 border-l-4 border-l-rose-500 bg-rose-500/5 text-zinc-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center space-x-3 min-w-0 flex-1">
            <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5 sm:mt-0" />
            <span className="leading-relaxed">
              <strong className="text-white">{t('nav.unreachableBanner', lang)}</strong> {t('nav.checkServerUrl', lang)} <code className="bg-black/50 px-2 py-0.5 rounded text-zinc-300 font-mono inline-block break-all max-w-full">{settings.endpoint}</code>.
            </span>
          </div>
          <button
            onClick={() => setActiveTab('settings')}
            className="btn-chill px-3 py-1.5 text-[11px] font-bold text-zinc-200 hover:text-white flex-shrink-0 self-end sm:self-auto"
          >
            {t('nav.configureIp', lang)}
          </button>
        </div>
      )}

      {/* Main Bento Grid */}
      <div className="translation-workspace space-y-5">
        
        {/* Upload Card (2 cols) */}
        <div className="translation-card card-chill p-6 sm:p-8 space-y-6 w-full">
          
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
            <div>
              <h2 className="font-semibold text-base text-white tracking-tight flex items-center space-x-2">
                <UploadCloud className="w-5 h-5 text-white flex-shrink-0" />
                <span>{t('dashboard.importTitle', lang)}</span>
              </h2>
              <p className="text-xs text-[#888] mt-0.5">{t('dashboard.importSubtitle', lang)}</p>
            </div>
            <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-[#888] bg-white/[0.04] px-2.5 py-1 rounded-md border border-white/[0.08] self-start sm:self-auto">
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
          <div className="mode-switcher p-1 rounded-xl bg-black/40 border border-white/[0.08] grid grid-cols-2 gap-1 text-xs">
            <button
              type="button"
              onClick={() => setJobMode('translation')}
              className={`py-2 px-2 sm:px-4 rounded-lg font-medium transition-colors duration-100 flex items-center justify-center space-x-1.5 text-[11px] sm:text-xs border ${
                jobMode === 'translation'
                  ? 'bg-white/10 text-white border-white/15 shadow-sm backdrop-blur-md'
                  : 'bg-transparent text-[#888] border-transparent hover:text-white hover:bg-white/[0.02]'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{t('dashboard.translationMode', lang)}</span>
            </button>
            <button
              type="button"
              onClick={() => setJobMode('proofreading')}
              className={`py-2 px-2 sm:px-4 rounded-lg font-medium transition-colors duration-100 flex items-center justify-center space-x-1.5 text-[11px] sm:text-xs border ${
                jobMode === 'proofreading'
                  ? 'bg-white/10 text-white border-white/15 shadow-sm backdrop-blur-md'
                  : 'bg-transparent text-[#888] border-transparent hover:text-white hover:bg-white/[0.02]'
              }`}
            >
              <Layers className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{t('dashboard.proofreadMode', lang)}</span>
            </button>
          </div>

          {/* Language Selector Bar (Source & Target Languages) */}
          <div className="language-route p-4 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-[#888] uppercase tracking-wider flex items-center space-x-1.5">
                <Globe className="w-3.5 h-3.5 text-[#60a5fa]" />
                <span>{l(lang, 'Project languages', 'Langues du projet', 'Idiomas del proyecto', 'Projektsprachen')}</span>
              </span>
              <span className="text-[11px] font-mono text-[#60a5fa] font-bold">
                {sourceLang.toUpperCase()} ➔ {targetLang.toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-2.5 items-center">
              {/* Source Language */}
              <div>
                <label className="block text-[9px] text-[#666] uppercase font-bold mb-1">
                  {l(lang, 'Source language (original)', 'Langue source (original)', 'Idioma de origen (original)', 'Ausgangssprache (Original)')}
                </label>
                <select
                  value={sourceLang}
                  onChange={(e) => setSourceLang(e.target.value)}
                  className="w-full input-chill px-3 py-1.5 text-xs text-zinc-200 cursor-pointer"
                >
                  {AVAILABLE_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.flag} {languageLabel(l.code, lang)}
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
                  title={l(lang, 'Swap languages', 'Inverser les langues', 'Intercambiar idiomas', 'Sprachen tauschen')}
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Target Language */}
              <div>
                <label className="block text-[9px] text-[#666] uppercase font-bold mb-1">
                  {l(lang, 'Target language (translation)', 'Langue cible (traduction)', 'Idioma de destino (traducción)', 'Zielsprache (Übersetzung)')}
                </label>
                <select
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  className="w-full input-chill px-3 py-1.5 text-xs text-zinc-200 cursor-pointer"
                >
                  {AVAILABLE_LANGUAGES.filter(l => l.code !== 'auto').map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.flag} {languageLabel(l.code, lang)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Proofreading Mode Sub-options (Select existing job vs upload new file) */}
          {jobMode === 'proofreading' && (
            <div className="proofreading-source-compact">
              <span className="proofreading-source-label">{l(lang, 'Document to proofread', 'Document à relire', 'Documento que revisar', 'Dokument zum Korrekturlesen')}</span>
              <div className="proofreading-source-toggle">
                <button type="button" onClick={() => setProofreadSourceType('existing')} className={proofreadSourceType === 'existing' ? 'is-selected' : ''}><BookOpen />{l(lang, 'Existing project', 'Projet existant', 'Proyecto existente', 'Vorhandenes Projekt')}</button>
                <button type="button" onClick={() => setProofreadSourceType('upload')} className={proofreadSourceType === 'upload' ? 'is-selected' : ''}><UploadCloud />{l(lang, 'New file', 'Nouveau fichier', 'Archivo nuevo', 'Neue Datei')}</button>
              </div>
              {proofreadSourceType === 'existing' && <select value={selectedExistingJobId} onChange={(e) => setSelectedExistingJobId(e.target.value)}><option value="">{l(lang, 'Select a project…', 'Sélectionner un projet…', 'Seleccionar un proyecto…', 'Projekt auswählen…')}</option>{jobs.map((j) => <option key={j.id} value={j.id}>{j.file_name} · {j.completed_chunks}/{j.total_chunks} · {j.status}</option>)}</select>}
              {proofreadSourceType === 'upload' && <span className="proofreading-upload-hint">{l(lang, 'Drop the file in the area below', 'Déposez le fichier dans la zone ci-dessous', 'Suelta el archivo en la zona inferior', 'Lege die Datei im Bereich unten ab')}</span>}
            </div>
          )}

          <form onSubmit={handleUploadSubmit} className="space-y-6">
            
            {/* If proofreading from existing DB book */}
            {jobMode === 'proofreading' && proofreadSourceType === 'existing' ? null : (
              /* Dropzone */
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
                onClick={() => document.getElementById('file-upload')?.click()}
                className={`document-dropzone border border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer relative overflow-hidden group ${
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
                        {t('dashboard.dropHere', lang)}
                      </p>
                      <p className="text-[10px] text-[#666] mt-1">{t('dashboard.allowedFormats', lang)}</p>
                    </div>
                  )}
                </label>
              </div>
            )}

            {/* Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-semibold text-[#888] uppercase tracking-wider mb-1.5">{t('dashboard.llmModel', lang)}</label>
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
                <label className="block text-[10px] font-semibold text-[#888] uppercase tracking-wider mb-1.5">{t('dashboard.literaryGlossary', lang)}</label>
                <select
                  value={selectedGlossary}
                  onChange={(e) => setSelectedGlossary(e.target.value)}
                  className="w-full input-chill px-3 py-2 text-xs text-zinc-200"
                >
                  <option value="">{t('dashboard.noGlossary', lang)}</option>
                  {glossaries.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>

            {/* Submit Action Buttons */}
            <div className="translation-actions grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
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
                  <span>{t('dashboard.analyzing', lang)}</span>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{jobMode === 'proofreading' ? t('dashboard.startProofreading', lang) : t('dashboard.startTranslation', lang)}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={(e) => handleUploadSubmit(e, false)}
                disabled={uploading || (jobMode === 'proofreading' && proofreadSourceType === 'existing' ? !selectedExistingJobId : !file)}
                className="py-2.5 bg-white/[0.04] hover:bg-white/[0.08] text-[#ededed] border border-white/[0.08] text-xs font-semibold rounded-lg transition-all flex items-center justify-center space-x-2 disabled:opacity-40"
              >
                {uploading ? (
                  <span>{t('dashboard.analyzing', lang)}</span>
                ) : (
                  <>
                    <Layers className="w-3.5 h-3.5" />
                    <span>{t('dashboard.prepareInspect', lang)}</span>
                  </>
                )}
              </button>
            </div>

          </form>
        </div>

        {/* Status Card (1 col) */}
        <div className="dashboard-utilities">
          <button type="button" className="utility-panel server-utility" onClick={() => setActiveTab('settings')}>
            <span className="utility-icon"><Cpu /></span>
            <span className="utility-copy"><small>{t('dashboard.serverParams', lang)}</small><strong>{PROVIDER_NAMES[settings.apiType] || settings.apiType || 'OpenAI'} <i>·</i> {settings.model}</strong><span>{settings.concurrency || 1} {t('dashboard.requestsUnit', lang)} · {settings.chunkSize || 1000} {t('dashboard.tokensUnit', lang)}</span></span>
            {PROVIDER_LOGOS[settings.apiType] && <img src={PROVIDER_LOGOS[settings.apiType]} alt="" className="utility-provider-logo" />}
            <span className="utility-arrow"><ArrowRight /></span>
          </button>

          <button type="button" className="utility-panel sandbox-utility" onClick={() => setActiveTab('sandbox')}>
            <span className="utility-icon"><TestTube /></span>
            <span className="utility-copy"><small>{t('dashboard.liveTester', lang)}</small><strong>{l(lang, 'Test a sentence before starting a document', 'Testez une phrase avant de lancer un document', 'Prueba una frase antes de iniciar un documento', 'Teste einen Satz, bevor du ein Dokument startest')}</strong><span>{t('dashboard.liveTesterDesc', lang)}</span></span>
            <span className="utility-action-label">{t('dashboard.openSandbox', lang)}</span>
            <span className="utility-arrow"><ArrowRight /></span>
          </button>
        </div>

      </div>

      {/* Projects List with Direct Controls & Download Buttons */}
      <div className="projects-section space-y-4">
        <h2 className="font-semibold text-sm text-white tracking-tight flex items-center space-x-2">
          <Layers className="w-4 h-4 text-white" />
          <span>{t('dashboard.recentProjects', lang)} ({jobs.length})</span>
        </h2>

        {jobs.length === 0 ? (
          <div className="card-chill p-12 text-center text-[#666] text-xs">
            {t('dashboard.noProjectsYet', lang)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {jobs.map((j) => {
              const percent = j.total_chunks > 0 ? Math.round((j.completed_chunks / j.total_chunks) * 100) : 0;
              const truncatedName = j.file_name.length > 32 ? j.file_name.slice(0, 32) + '...' : j.file_name;
              const canExport = j.status === 'COMPLETED' || j.completed_chunks > 0;
              const isPartialExport = j.status !== 'COMPLETED';
              
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
                        {j.status === 'PAUSED' ? t('dashboard.paused', lang) :
                         j.status === 'COMPLETED' ? t('dashboard.completed', lang) :
                         j.status === 'PROCESSING' ? t('dashboard.processing', lang) :
                         j.status === 'FAILED' ? t('dashboard.failed', lang) : j.status}
                      </span>
                      
                      <button
                        onClick={(e) => handleDeleteJob(e, j.id, j.file_name)}
                        className="text-[#444] hover:text-rose-400 p-1 transition-colors"
                        title={t('dashboard.deleteProject', lang)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-white text-xs truncate" title={j.file_name}>{truncatedName}</h3>
                    <p className="text-[10px] text-[#666] mt-0.5 font-mono truncate">{t('dashboard.model', lang)}: {j.model}</p>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-medium">
                      <span className="text-[#888]">{l(lang, 'Progress', 'Progression', 'Progreso', 'Fortschritt')}</span>
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
                          <span>{t('dashboard.pause', lang)}</span>
                        </button>
                      ) : (
                        <button
                          onClick={(e) => handleStartResumeJob(e, j.id)}
                          className="px-2.5 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-md text-[10px] font-medium flex items-center space-x-1 transition-all"
                        >
                          <Play className="w-3 h-3 fill-blue-300 text-blue-300" />
                          <span>{j.completed_chunks > 0 ? t('dashboard.resume', lang) : l(lang, 'Start', 'Lancer', 'Iniciar', 'Starten')}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={(e) => handleDownload(e, j.id)}
                        disabled={!canExport}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-medium flex items-center space-x-1 transition-all ${
                          canExport
                            ? 'bg-white/[0.04] hover:bg-white/[0.08] text-white border border-white/[0.08]'
                            : 'opacity-20 cursor-not-allowed'
                        }`}
                        title={isPartialExport
                          ? l(lang, 'Download partial preview', 'Télécharger un aperçu partiel', 'Descargar vista previa parcial', 'Teilvorschau herunterladen')
                          : l(lang, 'Download final translation', 'Télécharger la traduction finale', 'Descargar traducción final', 'Endgültige Übersetzung herunterladen')}
                      >
                        <Download className="w-3 h-3" />
                        <span>{isPartialExport ? l(lang, 'Preview', 'Aperçu', 'Vista previa', 'Vorschau') : l(lang, 'Export', 'Exporter', 'Exportar', 'Exportieren')}</span>
                      </button>
                    </div>

                    <span className="text-[#666] group-hover:text-white flex items-center space-x-1 text-[10px] font-medium transition-colors">
                      <span>{t('dashboard.inspect', lang)}</span>
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
