import React, { useState, useEffect } from 'react';
import { UploadCloud, Play, Pause, Trash2, AlertCircle, ArrowRight, ArrowLeftRight, FileText } from 'lucide-react';
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
  const isProofreading = jobMode === 'proofreading';
  const usesExistingProject = isProofreading && proofreadSourceType === 'existing';
  const canSubmit = !uploading && (usesExistingProject ? Boolean(selectedExistingJobId) : Boolean(file));
  const statusLabel = (status) => (
    status === 'PAUSED' ? t('dashboard.paused', lang)
      : status === 'COMPLETED' ? t('dashboard.completed', lang)
        : status === 'PROCESSING' ? t('dashboard.processing', lang)
          : status === 'FAILED' ? t('dashboard.failed', lang) : status
  );
  const statusClass = (status) => (
    status === 'COMPLETED' ? 'is-done' : status === 'PROCESSING' ? 'is-running' : status === 'FAILED' ? 'is-failed' : ''
  );
  const swapLanguages = () => {
    if (sourceLang === 'auto') return;
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
  };
  const openJob = (jobId) => {
    onSelectJob(jobId);
    setActiveTab('jobs');
  };

  return (
    <div className="page !max-w-[1040px] !gap-14 !pt-14">
      <section aria-labelledby="dashboard-title" className="flex flex-col items-center gap-7">
        <div className="flex flex-col items-center gap-2.5 text-center">
          <h1 id="dashboard-title" className="hero-title">{l(lang, 'Your documents, faithfully translated.', 'Vos documents, fidèlement traduits.', 'Tus documentos, traducidos con fidelidad.', 'Deine Dokumente, originalgetreu übersetzt.')}</h1>
          <p className="m-0 max-w-[560px] text-[16px] text-sec">{l(lang, 'Import a document, choose your languages, and follow every step through export.', 'Importez un document, choisissez vos langues et suivez chaque étape jusqu’à l’export.', 'Importa un documento, elige los idiomas y sigue cada etapa hasta la exportación.', 'Importiere ein Dokument, wähle die Sprachen und begleite jeden Schritt bis zum Export.')}</p>
        </div>

        {!endpointStatus && (
          <div className="notice w-full max-w-[780px] flex-wrap items-center">
            <AlertCircle aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <strong className="font-semibold">{t('nav.unreachableBanner', lang)}</strong> {t('nav.checkServerUrl', lang)} <code className="break-all">{settings.endpoint}</code>
            </span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setActiveTab('settings')}>{t('nav.configureIp', lang)}</button>
          </div>
        )}

        {error && (
          <div role="alert" className="notice w-full max-w-[780px]">
            <AlertCircle aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={(event) => handleUploadSubmit(event, true)} className="card card-lg w-full max-w-[780px] overflow-hidden">
          {isProofreading && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-[18px] py-3.5">
              <span className="text-[13px] text-sec">{l(lang, 'Document to proofread', 'Document à relire', 'Documento que revisar', 'Dokument zum Korrekturlesen')}</span>
              <div className="seg" role="group" aria-label={l(lang, 'Document to proofread', 'Document à relire', 'Documento que revisar', 'Dokument zum Korrekturlesen')}>
                <button type="button" aria-pressed={proofreadSourceType === 'existing'} onClick={() => setProofreadSourceType('existing')}>{l(lang, 'Existing project', 'Projet existant', 'Proyecto existente', 'Vorhandenes Projekt')}</button>
                <button type="button" aria-pressed={proofreadSourceType === 'upload'} onClick={() => setProofreadSourceType('upload')}>{l(lang, 'New file', 'Nouveau fichier', 'Archivo nuevo', 'Neue Datei')}</button>
              </div>
              {usesExistingProject && (
                <select
                  aria-label={l(lang, 'Project to proofread', 'Projet à relire', 'Proyecto que revisar', 'Zu prüfendes Projekt')}
                  className="input input-on-card !h-9 min-w-[220px] flex-1 border !border-line"
                  value={selectedExistingJobId}
                  onChange={(event) => setSelectedExistingJobId(event.target.value)}
                >
                  <option value="">{l(lang, 'Select a project…', 'Sélectionner un projet…', 'Seleccionar un proyecto…', 'Projekt auswählen…')}</option>
                  {jobs.map((job) => <option key={job.id} value={job.id}>{job.file_name} · {job.completed_chunks}/{job.total_chunks} · {statusLabel(job.status)}</option>)}
                </select>
              )}
            </div>
          )}

          {!usesExistingProject && (
            <label
              htmlFor="file-upload"
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleFileDrop}
              className={`flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-2.5 p-8 text-center transition-colors ${file ? 'bg-[var(--accent-soft)]' : 'hover:bg-toolbar'}`}
            >
              <input
                type="file"
                id="file-upload"
                accept=".epub,.pdf,.docx,.md,.txt"
                className="sr-only"
                onChange={(event) => {
                  if (event.target.files?.[0]) {
                    setFile(event.target.files[0]);
                    setError(null);
                  }
                }}
              />
              <span className="grid size-12 place-items-center rounded-2xl bg-well text-accent-text">
                {file ? <FileText className="size-[22px]" aria-hidden="true" /> : <UploadCloud className="size-[22px]" aria-hidden="true" />}
              </span>
              {file ? (
                <>
                  <span className="max-w-full break-all text-[16px] font-medium">{file.name}</span>
                  <span className="text-[13px] text-sec">{(file.size / (1024 * 1024)).toFixed(2)} MB · <span className="font-medium text-accent-text">{l(lang, 'Choose another file', 'Choisir un autre fichier', 'Elegir otro archivo', 'Andere Datei wählen')}</span></span>
                </>
              ) : (
                <>
                  <span className="text-[16px] font-medium">{l(lang, 'Drop a document here', 'Déposez un document ici', 'Suelta un documento aquí', 'Dokument hier ablegen')}</span>
                  <span className="text-[13px] text-sec">
                    {l(lang, 'or', 'ou', 'o', 'oder')} <span className="font-medium text-accent-text">{l(lang, 'choose a file', 'choisissez un fichier', 'elige un archivo', 'wähle eine Datei')}</span> · EPUB, PDF, DOCX, MD, TXT
                  </span>
                </>
              )}
            </label>
          )}

          <div className="flex flex-col gap-2 border-t border-line bg-toolbar p-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="seg" role="group" aria-label={l(lang, 'Mode', 'Mode', 'Modo', 'Modus')}>
                <button type="button" aria-pressed={!isProofreading} onClick={() => setJobMode('translation')}>{l(lang, 'Translate', 'Traduire', 'Traducir', 'Übersetzen')}</button>
                <button type="button" aria-pressed={isProofreading} onClick={() => setJobMode('proofreading')}>{l(lang, 'Proofread', 'Relire', 'Revisar', 'Korrektur')}</button>
              </div>
              <div className="chip-select min-w-[min(100%,240px)] flex-1 !px-1">
                <select className="min-w-0 flex-1 !max-w-none" aria-label={l(lang, 'Source language', 'Langue source', 'Idioma de origen', 'Ausgangssprache')} value={sourceLang} onChange={(event) => setSourceLang(event.target.value)}>
                  {AVAILABLE_LANGUAGES.map((language) => <option key={language.code} value={language.code}>{languageLabel(language.code, lang)}</option>)}
                </select>
                <button type="button" className="icon-btn is-plain !size-7" onClick={swapLanguages} aria-label={l(lang, 'Swap languages', 'Inverser les langues', 'Intercambiar idiomas', 'Sprachen tauschen')}>
                  <ArrowLeftRight aria-hidden="true" className="!size-3.5" />
                </button>
                <select className="min-w-0 flex-1 !max-w-none" aria-label={l(lang, 'Target language', 'Langue cible', 'Idioma de destino', 'Zielsprache')} value={targetLang} onChange={(event) => setTargetLang(event.target.value)}>
                  {AVAILABLE_LANGUAGES.filter((language) => language.code !== 'auto').map((language) => <option key={language.code} value={language.code}>{languageLabel(language.code, lang)}</option>)}
                </select>
              </div>
              <label className="chip-select ml-auto max-w-full max-sm:w-full max-sm:[&>select]:flex-1 max-sm:[&>select]:!max-w-none">
                {l(lang, 'Model', 'Modèle', 'Modelo', 'Modell')}
                <select
                  value={selectedModel}
                  onChange={(event) => {
                    setSelectedModel(event.target.value);
                    if (onSelectModel) onSelectModel(event.target.value);
                  }}
                >
                  {availableModels.length > 0
                    ? availableModels.map((model) => <option key={model} value={model}>{model}</option>)
                    : <option value={settings.model}>{settings.model}</option>}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="chip-select max-w-full max-sm:w-full max-sm:[&>select]:flex-1 max-sm:[&>select]:!max-w-none">
                {l(lang, 'Glossary', 'Glossaire', 'Glosario', 'Glossar')}
                <select value={selectedGlossary} onChange={(event) => setSelectedGlossary(event.target.value)}>
                  <option value="">{l(lang, 'None', 'Aucun', 'Ninguno', 'Keines')}</option>
                  {glossaries.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </label>
              <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5 max-sm:w-full max-sm:[&>button]:flex-1">
                <button type="button" className="btn btn-ghost" disabled={!canSubmit} onClick={(event) => handleUploadSubmit(event, false)}>
                  {l(lang, 'Prepare only', 'Préparer seulement', 'Solo preparar', 'Nur vorbereiten')}
                </button>
                <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
                  {uploading ? t('dashboard.analyzing', lang) : isProofreading ? t('dashboard.startProofreading', lang) : t('dashboard.startTranslation', lang)}
                  {!uploading && <ArrowRight aria-hidden="true" />}
                </button>
              </div>
            </div>
          </div>
        </form>

        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" className="btn btn-secondary text-sec" onClick={() => setActiveTab('settings')}>
            <span className="font-normal text-sec">{PROVIDER_NAMES[settings.apiType] || settings.apiType || 'OpenAI'} · {settings.concurrency || 1} {t('dashboard.requestsUnit', lang)} · {(settings.chunkSize || 1000).toLocaleString()} {t('dashboard.tokensUnit', lang)}</span>
            {l(lang, 'Server settings', 'Réglages serveur', 'Ajustes del servidor', 'Servereinstellungen')}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setActiveTab('sandbox')}>
            <span className="font-normal text-sec">{l(lang, 'Test a sentence first', 'Testez d’abord une phrase', 'Prueba antes una frase', 'Zuerst einen Satz testen')}</span>
            {t('nav.sandbox', lang)}
          </button>
        </div>
      </section>

      <section aria-labelledby="projects-title" className="flex flex-col gap-3.5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="projects-title" className="m-0 text-[18px] font-semibold tracking-[-0.02em]">{t('dashboard.recentProjects', lang)}</h2>
          <span className="text-[13px] text-sec">
            {jobs.length} · {activeJobCount} {l(lang, 'running', 'en cours', 'en curso', 'laufend')}
          </span>
        </div>

        {jobs.length === 0 ? (
          <div className="card px-6 py-12 text-center text-[13px] text-sec">{t('dashboard.noProjectsYet', lang)}</div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-3">
            {jobs.map((job) => {
              const percent = job.total_chunks > 0 ? Math.round((job.completed_chunks / job.total_chunks) * 100) : 0;
              const canExport = job.status === 'COMPLETED' || job.completed_chunks > 0;
              const isPartialExport = job.status !== 'COMPLETED';
              return (
                <article key={job.id} className="card flex flex-col gap-3.5 p-[18px]">
                  <div className="flex items-center gap-2">
                    <span className="tag">{job.file_type.toUpperCase()}</span>
                    <span className={`status ${statusClass(job.status)}`}>{statusLabel(job.status)}</span>
                    <button
                      type="button"
                      className="icon-btn is-plain ml-auto !size-8"
                      onClick={(event) => handleDeleteJob(event, job.id, job.file_name)}
                      aria-label={`${t('dashboard.deleteProject', lang)} — ${job.file_name}`}
                    >
                      <Trash2 aria-hidden="true" />
                    </button>
                  </div>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <h3 className="m-0 min-w-0 text-[16px] font-semibold tracking-[-0.015em]">
                      <button type="button" onClick={() => openJob(job.id)} className="block max-w-full truncate border-0 bg-transparent p-0 text-left hover:underline" title={job.file_name}>
                        {job.file_name}
                      </button>
                    </h3>
                    <span className="truncate text-[13px] text-sec">{job.source_lang?.toUpperCase()} → {job.target_lang?.toUpperCase()} · {job.model}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className={`progress flex-1 ${job.status === 'COMPLETED' ? 'is-done' : ''}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={l(lang, 'Progress', 'Progression', 'Progreso', 'Fortschritt')}>
                      <span style={{ width: `${percent}%` }} />
                    </div>
                    <span className="text-[12px] tabular-nums text-sec">{job.completed_chunks} / {job.total_chunks}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {job.status === 'PROCESSING' ? (
                      <button type="button" className="btn btn-solid btn-sm" onClick={(event) => handlePauseJob(event, job.id)}>
                        <Pause aria-hidden="true" />{t('dashboard.pause', lang)}
                      </button>
                    ) : (
                      <button type="button" className="btn btn-solid btn-sm" onClick={(event) => handleStartResumeJob(event, job.id)}>
                        <Play aria-hidden="true" />{job.completed_chunks > 0 ? t('dashboard.resume', lang) : l(lang, 'Start', 'Lancer', 'Iniciar', 'Starten')}
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={!canExport}
                      onClick={(event) => handleDownload(event, job.id)}
                      title={isPartialExport
                        ? l(lang, 'Download partial preview', 'Télécharger un aperçu partiel', 'Descargar vista previa parcial', 'Teilvorschau herunterladen')
                        : l(lang, 'Download final translation', 'Télécharger la traduction finale', 'Descargar traducción final', 'Endgültige Übersetzung herunterladen')}
                    >
                      {isPartialExport ? l(lang, 'Preview', 'Aperçu', 'Vista previa', 'Vorschau') : l(lang, 'Export', 'Exporter', 'Exportar', 'Exportieren')}
                    </button>
                    <button type="button" className="btn btn-link ml-auto shrink-0 px-1" onClick={() => openJob(job.id)}>{t('dashboard.inspect', lang)}</button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
