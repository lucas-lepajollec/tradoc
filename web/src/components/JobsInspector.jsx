import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RefreshCw, Download, FileText, CheckCircle2, AlertTriangle, Terminal, ChevronRight, ChevronLeft, Clock, Copy, Check, Trash2, ArrowRight, Sparkles, Sliders } from 'lucide-react';
import { fetchJobs, fetchJobDetail, fetchJobSegments, startJob, pauseJob, retryJob, deleteJob, updateJobConfig } from '../api';
import { t } from '../i18n/translations';

export default function JobsInspector({ selectedJobId, onSelectJob, settings, availableModels = [], lang = 'en', onSelectModel }) {
  const [jobs, setJobs] = useState([]);
  const [job, setJob] = useState(null);
  const [segments, setSegments] = useState([]);
  const [selectedSegIndex, setSelectedSegIndex] = useState(0);
  const [jumpInput, setJumpInput] = useState('1');
  const [logs, setLogs] = useState([]);
  const [showConsole, setShowConsole] = useState(false);
  const [copied, setCopied] = useState(false);
  const [secondsPerChunk, setSecondsPerChunk] = useState(3.5);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [editModel, setEditModel] = useState('');
  const [editConcurrency, setEditConcurrency] = useState(1);
  const [editTemperature, setEditTemperature] = useState(0.15);
  const [sessionStats, setSessionStats] = useState({
    jobId: null,
    startTime: null,
    startCompletedCount: 0,
    lastCompletedCount: 0
  });

  const prevSegmentsRef = useRef([]);

  useEffect(() => {
    if (job) {
      setEditModel(job.model || settings?.model || '');
      setEditConcurrency(job.concurrency || 1);
      setEditTemperature(job.temperature !== undefined && job.temperature !== null ? job.temperature : 0.15);
    }
  }, [job?.id]);

  const handleSaveJobConfig = async (e) => {
    if (e) e.preventDefault();
    if (!job) return;
    setSavingConfig(true);
    try {
      await updateJobConfig(job.id, {
        model: editModel,
        concurrency: editConcurrency,
        temperature: editTemperature
      });
      setIsEditingConfig(false);
      await loadJobDetails(job.id);
      await loadJobsList();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingConfig(false);
    }
  };

  // Auto-focus on the newly completed segment
  useEffect(() => {
    if (job?.status === 'PROCESSING' && segments.length > 0 && prevSegmentsRef.current.length === segments.length) {
      const newlyDoneIdx = segments.findIndex((seg, idx) => {
        const prevSeg = prevSegmentsRef.current[idx];
        return seg.status === 'DONE' && prevSeg && prevSeg.status !== 'DONE';
      });
      if (newlyDoneIdx !== -1 && autoScroll) {
        setSelectedSegIndex(newlyDoneIdx);
      }
    }
    prevSegmentsRef.current = segments;
  }, [segments, job?.status, autoScroll]);

  useEffect(() => {
    if (!job) {
      if (sessionStats.jobId) {
        setSessionStats({ jobId: null, startTime: null, startCompletedCount: 0, lastCompletedCount: 0 });
      }
      return;
    }

    if (job.status === 'PROCESSING') {
      if (sessionStats.jobId !== job.id || sessionStats.startTime === null) {
        setSessionStats({
          jobId: job.id,
          startTime: Date.now(),
          startCompletedCount: job.completed_chunks,
          lastCompletedCount: job.completed_chunks
        });
        const isGemma = job.model && job.model.toLowerCase().includes('gemma');
        setSecondsPerChunk(isGemma ? 9.0 : 3.5);
      } else if (job.completed_chunks > sessionStats.lastCompletedCount) {
        setSessionStats(prev => ({
          ...prev,
          lastCompletedCount: job.completed_chunks
        }));

        // Calculate speed ONLY on chunk completion event
        const completedInSession = job.completed_chunks - sessionStats.startCompletedCount;
        const minHistory = 8;
        
        if (completedInSession >= minHistory) {
          const elapsedSec = (Date.now() - sessionStats.startTime) / 1000;
          if (elapsedSec > 0) {
            const speed = elapsedSec / completedInSession;
            setSecondsPerChunk(Math.max(0.5, Math.min(25.0, speed)));
          }
        }
      }
    } else {
      if (sessionStats.startTime !== null) {
        setSessionStats(prev => ({ ...prev, startTime: null }));
      }
    }
  }, [job?.id, job?.status, job?.completed_chunks]);

  useEffect(() => {
    loadJobsList();

    const eventSource = new EventSource('/api/events');
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'job_paused' || data.type === 'job_auto_paused') {
          setJob((prev) => prev ? { ...prev, status: 'PAUSED' } : null);
          setJobs((prev) => prev.map((j) => data.job_id === j.id ? { ...j, status: 'PAUSED' } : j));
        } else if (data.type === 'job_started') {
          setJob((prev) => prev ? { ...prev, status: 'PROCESSING' } : null);
          setJobs((prev) => prev.map((j) => data.job_id === j.id ? { ...j, status: 'PROCESSING' } : j));
          loadJobsList();
        } else if (data.type === 'job_completed') {
          setJob((prev) => prev ? { ...prev, status: 'COMPLETED' } : null);
          refreshActiveJob();
          loadJobsList();
        } else if (data.type === 'segment_completed' || data.type === 'segment_failed') {
          setLogs((prev) => [data, ...prev.slice(0, 49)]);
          refreshActiveJob();
        }
      } catch (e) {
        console.error(e);
      }
    };

    return () => eventSource.close();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      if (job?.id && job.status === 'PROCESSING') {
        refreshActiveJob();
      }
    }, 2500);
    return () => clearInterval(timer);
  }, [job?.id, job?.status]);

  useEffect(() => {
    loadJobsList();
  }, [selectedJobId]);

  useEffect(() => {
    setJumpInput(String(selectedSegIndex + 1));
  }, [selectedSegIndex]);

  const loadJobsList = async () => {
    try {
      const data = await fetchJobs();
      setJobs(data);
      if (data.length > 0) {
        const targetId = selectedJobId && data.some(j => j.id === selectedJobId) ? selectedJobId : data[0].id;
        const targetJob = data.find(j => j.id === targetId) || data[0];
        setJob(targetJob);
        loadJobDetails(targetJob.id);
        if (!selectedJobId && onSelectJob) {
          onSelectJob(targetId);
        }
      } else {
        setJob(null);
        setSegments([]);
        if (onSelectJob) onSelectJob(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const selectJobOptimistic = (targetJob) => {
    if (!targetJob) return;
    setJob(targetJob);
    if (onSelectJob) onSelectJob(targetJob.id);
    loadJobDetails(targetJob.id);
  };

  const loadJobDetails = async (id) => {
    try {
      const jData = await fetchJobDetail(id);
      setJob(jData);
      const sData = await fetchJobSegments(id);
      setSegments(sData);
    } catch (e) {
      console.error(e);
    }
  };

  const refreshActiveJob = async () => {
    if (job?.id) {
      try {
        const jData = await fetchJobDetail(job.id);
        const sData = await fetchJobSegments(job.id);
        setJob(jData);
        setSegments(sData);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleStartResume = async () => {
    if (!job) return;
    setJob((prev) => prev ? { ...prev, status: 'PROCESSING' } : null);
    try {
      await startJob(job.id, {
        endpoint: settings.endpoint,
        apiKey: settings.apiKey,
        apiType: settings.apiType,
        model: job.model || settings.model,
        concurrency: job.concurrency || settings.concurrency || 1,
        temperature: job.temperature !== undefined ? job.temperature : settings.temperature,
        enableProofreading: settings.enableProofreading
      });
    } catch (err) {
      console.error(err);
    }
    await refreshActiveJob();
  };

  const handlePause = async () => {
    if (!job) return;
    setJob((prev) => prev ? { ...prev, status: 'PAUSED' } : null);
    try {
      await pauseJob(job.id);
    } catch (err) {
      console.error(err);
    }
    await refreshActiveJob();
  };

  const handleRetryAndStart = async () => {
    if (!job) return;
    setJob((prev) => prev ? { ...prev, status: 'PROCESSING' } : null);
    setSegments((prev) => prev.map((s) => s.status === 'FAILED' ? { ...s, status: 'PENDING', error: null } : s));
    try {
      await retryJob(job.id);
      await startJob(job.id, {
        endpoint: settings.endpoint,
        apiKey: settings.apiKey,
        apiType: settings.apiType,
        model: job.model || settings.model,
        concurrency: job.concurrency || settings.concurrency || 1,
        temperature: job.temperature !== undefined ? job.temperature : settings.temperature,
        enableProofreading: settings.enableProofreading
      });
    } catch (err) {
      console.error(err);
    }
    await refreshActiveJob();
  };

  const handleDeleteJob = async (e, jobId, fileName) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Supprimer définitivement le projet "${fileName}" ?`)) return;
    
    try {
      await deleteJob(jobId);
    } catch (err) {
      console.error(err);
    }

    const remaining = jobs.filter((j) => j.id !== jobId);
    setJobs(remaining);

    if (remaining.length > 0) {
      const nextId = remaining[0].id;
      if (onSelectJob) onSelectJob(nextId);
      loadJobDetails(nextId);
    } else {
      setJob(null);
      setSegments([]);
      if (onSelectJob) onSelectJob(null);
    }
  };

  const handleCopyText = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleJumpSubmit = (e) => {
    e.preventDefault();
    const num = parseInt(jumpInput, 10);
    if (!isNaN(num) && num >= 1 && num <= segments.length) {
      setSelectedSegIndex(num - 1);
      setAutoScroll(false);
    }
  };

  const calculateETA = () => {
    if (!job || job.total_chunks === 0) return lang === 'fr' ? 'Calcul de la vitesse...' : 'Calculating speed...';
    const isProofread = job.job_type === 'proofreading';
    if (job.status === 'COMPLETED') return isProofread ? (lang === 'fr' ? 'Relecture terminée' : 'Proofreading completed') : (lang === 'fr' ? 'Traduction terminée' : 'Translation completed');
    if (job.status === 'PAUSED') return lang === 'fr' ? 'En pause' : 'Paused';
    if (job.completed_chunks === 0) return isProofread ? (lang === 'fr' ? 'Démarrage de la relecture...' : 'Starting proofreading...') : (lang === 'fr' ? 'Démarrage de la traduction...' : 'Starting translation...');

    const remaining = job.total_chunks - job.completed_chunks;
    if (remaining <= 0) return isProofread ? (lang === 'fr' ? 'Relecture terminée' : 'Proofreading completed') : (lang === 'fr' ? 'Traduction terminée' : 'Translation completed');

    const minHistory = 8;
    if (sessionStats.startTime && sessionStats.jobId === job.id && job.status === 'PROCESSING') {
      const completedInSession = job.completed_chunks - sessionStats.startCompletedCount;
      if (completedInSession < minHistory) {
        return lang === 'fr'
          ? `Calcul du temps restant (historique ${completedInSession}/${minHistory})...`
          : `Calculating remaining time (history ${completedInSession}/${minHistory})...`;
      }
    } else {
      return lang === 'fr' ? 'Calcul du temps restant...' : 'Calculating remaining time...';
    }

    const totalSeconds = Math.round(remaining * secondsPerChunk);
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    const speedSegPerMin = (60 / secondsPerChunk).toFixed(1);

    const timeStr = hours > 0
      ? `${hours}h ${mins}m ${secs}s`
      : `${mins}m ${secs}s`;

    return `${timeStr} (${speedSegPerMin} seg/min)`;
  };

  const currentSegment = segments[selectedSegIndex] || segments[0];
  const failedCount = segments.filter((s) => s.status === 'FAILED').length;

  return (
    <div className="space-y-6">
      
      {/* Upper Grid Layout: Books List (1 col) + Inspector Details (3 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch">
        
        {/* Sidebar List (1 col) */}
        <div className="card-chill p-4 space-y-3 rounded-2xl flex flex-col h-auto max-h-[300px] lg:h-full lg:max-h-none">
          <h2 className="text-[10px] font-semibold text-[#888] uppercase tracking-wider px-2">{t('inspector.projectsList', lang)} ({jobs.length})</h2>
          <div className="space-y-2 overflow-y-auto pr-1 flex-1 min-h-0 max-h-[250px] lg:max-h-none">
            {jobs.map((j) => {
              const percent = j.total_chunks > 0 ? Math.round((j.completed_chunks / j.total_chunks) * 100) : 0;
              const isSelected = job?.id === j.id;
              const truncatedName = j.file_name.length > 16 ? j.file_name.slice(0, 16) + '...' : j.file_name;

              return (
                <div
                  key={j.id}
                  onClick={() => selectJobOptimistic(j)}
                  className={`group p-3.5 rounded-xl cursor-pointer transition-all duration-150 flex items-center justify-between border ${
                    isSelected
                      ? 'bg-white/[0.09] border-white/[0.16] text-white font-semibold shadow-sm'
                      : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.06] hover:border-white/[0.12]'
                  }`}
                  title={j.file_name}
                >
                  <div className="truncate pr-2">
                    <p className="font-medium text-xs truncate group-hover:text-white transition-colors">{truncatedName}</p>
                    <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{percent}% ({j.completed_chunks}/{j.total_chunks} segs)</p>
                  </div>
                  
                  <div className="flex items-center space-x-1 flex-shrink-0">
                    <button
                      onClick={(e) => handleDeleteJob(e, j.id, j.file_name)}
                      className="text-zinc-600 hover:text-rose-400 p-1 transition-colors"
                      title={t('dashboard.deleteProject', lang)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <ChevronRight className={`w-3.5 h-3.5 transition-colors ${isSelected ? 'text-zinc-300' : 'text-zinc-600 group-hover:text-zinc-400'}`} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Main Inspector (3 cols) */}
        <div className="lg:col-span-3 space-y-6">
          
          {job ? (
            <>
              {/* Header & Controls */}
              <div className="card-chill p-6 space-y-4 rounded-2xl">
                {/* Top Row: Title + Badges on Left, Config & Details Links on Right */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
                    <h1 className="text-sm font-semibold text-white tracking-tight leading-snug truncate max-w-full sm:max-w-[360px] md:max-w-[480px]" title={job.file_name}>
                      {job.file_name}
                    </h1>

                    <div className="flex flex-wrap items-center gap-1.5 flex-shrink-0">
                      {/* 1. Type de Fichier */}
                      <span className="px-2.5 py-0.5 rounded-md bg-white/[0.06] border border-white/[0.1] text-zinc-300 text-[9px] uppercase font-bold font-mono">
                        {job.file_type}
                      </span>

                      {/* 2. Mode (Traduction / Relecture) */}
                      <span className={`px-2.5 py-0.5 rounded-md text-[9px] font-mono font-bold uppercase border ${
                        job.job_type === 'proofreading'
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                          : 'border-blue-500/30 bg-blue-500/10 text-blue-400'
                      }`}>
                        {job.job_type === 'proofreading' ? t('inspector.modeProofread', lang) : t('inspector.modeTranslation', lang)}
                      </span>

                      {/* 3. Modèle */}
                      <span className="px-2.5 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-[#888] text-[9px] font-mono">
                        {job.model}
                      </span>

                      {failedCount > 0 && (
                        <span className="text-[#ff6369] font-mono text-xs font-semibold">
                          ({failedCount} {lang === 'fr' ? 'échec' : 'failed'}{failedCount > 1 ? 's' : ''})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Config & Details Links */}
                  <div className="flex items-center space-x-3 flex-shrink-0 self-start sm:self-center">
                    {job.status === 'PROCESSING' ? (
                      <span className="text-[10px] text-[#666] italic font-mono">
                        {lang === 'fr' ? '(Mettez en pause pour modifier la config)' : '(Pause job to edit config)'}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsEditingConfig(!isEditingConfig)}
                        className="text-xs font-medium text-[#60a5fa] hover:text-blue-300 transition-colors flex items-center space-x-1"
                      >
                        <span>{isEditingConfig ? (lang === 'fr' ? 'Fermer Config' : 'Close Config') : (lang === 'fr' ? 'Modifier la config ➔' : 'Modify config ➔')}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowDetails(!showDetails)}
                      className="text-xs font-medium text-[#888] hover:text-white transition-colors flex items-center space-x-1"
                    >
                      <span>{showDetails ? (lang === 'fr' ? 'Masquer Détails' : 'Hide Details') : (lang === 'fr' ? 'Détails' : 'Details')}</span>
                    </button>
                  </div>
                </div>

                {/* Collapsible Details list (Placed directly under Title row) */}
                {showDetails && (
                  <div className="border-t border-white/[0.08] pt-3 mt-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-y-2 gap-x-4 font-mono text-[10px] text-[#888]">
                    <div>
                      <span className="text-[#444]">ID :</span> <span className="text-zinc-300">{job.id}</span>
                    </div>
                    <div>
                      <span className="text-[#444]">{lang === 'fr' ? 'Langues :' : 'Languages:'}</span> <span className="text-zinc-300">{job.source_lang.toUpperCase()} ➔ {job.target_lang.toUpperCase()}</span>
                    </div>
                    <div>
                      <span className="text-[#444]">{lang === 'fr' ? 'Glossaire :' : 'Glossary:'}</span> <span className="text-zinc-300">{job.glossary_name || (lang === 'fr' ? 'Aucun' : 'None')}</span>
                    </div>
                    <div>
                      <span className="text-[#444]">{lang === 'fr' ? 'Taille chunk :' : 'Chunk size:'}</span> <span className="text-[#60a5fa]">{job.chunk_size || 1000} tokens</span>
                    </div>
                    <div>
                      <span className="text-[#444]">{lang === 'fr' ? 'Température :' : 'Temperature:'}</span> <span className="text-[#60a5fa]">{job.temperature !== undefined && job.temperature !== null ? Number(job.temperature).toFixed(2) : (settings?.temperature ? Number(settings.temperature).toFixed(2) : '1.50')}</span>
                    </div>
                    <div>
                      <span className="text-[#444]">{lang === 'fr' ? 'Concurrence :' : 'Concurrency:'}</span> <span className="text-[#60a5fa]">{job.concurrency || settings?.concurrency || 1} req.</span>
                    </div>
                    <div>
                      <span className="text-[#444]">{lang === 'fr' ? "Date d'import :" : 'Import date:'}</span> <span className="text-zinc-300">{new Date(job.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                )}

                {/* Inline Job Config Editor (Minimalist pure black container, no border) */}
                {isEditingConfig && job.status !== 'PROCESSING' && (
                  <form onSubmit={handleSaveJobConfig} className="p-4 rounded-xl bg-black space-y-4 mt-2">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2.5 flex-wrap gap-2">
                      <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                        {lang === 'fr' ? 'Modifier la Config du Projet' : 'Modify Project Configuration'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (settings?.model) setEditModel(settings.model);
                          if (settings?.concurrency) setEditConcurrency(settings.concurrency);
                          if (settings?.temperature !== undefined) setEditTemperature(settings.temperature);
                        }}
                        className="text-[10px] text-[#60a5fa] hover:underline font-mono flex items-center space-x-1"
                      >
                        <Sparkles className="w-3 h-3 text-[#60a5fa]" />
                        <span>{lang === 'fr' ? 'Appliquer la config du Dashboard' : 'Apply Dashboard Config'}</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                      <div>
                        <label className="block text-[10px] text-zinc-400 uppercase font-bold mb-1">{t('dashboard.llmModel', lang)}</label>
                        <select
                          value={editModel}
                          onChange={(e) => setEditModel(e.target.value)}
                          className="w-full input-chill px-3 py-1.5 text-xs text-zinc-200"
                        >
                          {availableModels.length > 0 ? (
                            availableModels.map((m) => <option key={m} value={m}>{m}</option>)
                          ) : (
                            <option value={editModel}>{editModel}</option>
                          )}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] text-zinc-400 uppercase font-bold mb-1">{t('dashboard.concurrency', lang)}</label>
                        <input
                          type="number"
                          min="1"
                          max="16"
                          value={editConcurrency}
                          onChange={(e) => setEditConcurrency(parseInt(e.target.value, 10) || 1)}
                          className="w-full input-chill px-3 py-1.5 text-xs font-mono text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-zinc-400 uppercase font-bold mb-1">
                          Température <span className="text-[#60a5fa] font-mono">({editTemperature})</span>
                        </label>
                        <input
                          type="range"
                          min="0.0"
                          max="1.0"
                          step="0.05"
                          value={editTemperature}
                          onChange={(e) => setEditTemperature(parseFloat(e.target.value))}
                          className="w-full mt-2 cursor-pointer accent-[#2563eb]"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end space-x-2 pt-2 border-t border-white/10">
                      <button
                        type="button"
                        onClick={() => setIsEditingConfig(false)}
                        className="px-3 py-1 text-xs text-zinc-400 hover:text-white transition-colors"
                      >
                        {lang === 'fr' ? 'Annuler' : 'Cancel'}
                      </button>
                      <button
                        type="submit"
                        disabled={savingConfig}
                        className="btn-orange px-4 py-1.5 text-xs font-semibold"
                      >
                        {savingConfig ? (lang === 'fr' ? 'Sauvegarde...' : 'Saving...') : (lang === 'fr' ? 'Enregistrer' : 'Save')}
                      </button>
                    </div>
                  </form>
                )}

                {/* Middle Row: Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap pt-3 border-t border-white/[0.08]">
                  {job.status === 'PROCESSING' ? (
                    <button
                      onClick={handlePause}
                      className="px-3 py-1.5 bg-white/[0.04] text-white border border-white/[0.08] hover:bg-white/[0.08] rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors"
                    >
                      <Pause className="w-3.5 h-3.5" />
                      <span>{t('dashboard.pause', lang)}</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleStartResume}
                      className="btn-orange px-3.5 py-1.5 text-xs font-medium flex items-center space-x-1.5"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      <span>{job.completed_chunks > 0 ? t('dashboard.resume', lang) : (lang === 'fr' ? 'Démarrer' : 'Start')}</span>
                    </button>
                  )}

                  <button
                    onClick={handleRetryAndStart}
                    className="px-3 py-1.5 bg-[#ff6369]/10 text-[#ff6369] border border-[#ff6369]/20 rounded-lg text-xs font-medium hover:bg-[#ff6369]/20 flex items-center space-x-1.5 transition-colors"
                    title={lang === 'fr' ? 'Réinitialise les échecs et relance' : 'Reset failed chunks and retry'}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{lang === 'fr' ? 'Relancer Échecs' : 'Retry Failed'}</span>
                  </button>

                  <a
                    href={`/api/jobs/${job.id}/download?t=${Date.now()}`}
                    target="_blank"
                    rel="noreferrer"
                    title={job.file_type === 'pdf' ? 'Export EPUB' : `Download ${job.file_type ? job.file_type.toUpperCase() : 'file'}`}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium inline-flex items-center space-x-1.5 transition-all border ${
                      job.status === 'COMPLETED' || job.completed_chunks > 0
                        ? 'bg-white/[0.04] text-white border-white/[0.12] hover:bg-white/[0.08]'
                        : 'bg-white/[0.02] text-zinc-500 border-white/[0.08] opacity-50 cursor-not-allowed pointer-events-none'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{lang === 'fr' ? 'Télécharger' : 'Download'} {job.file_type === 'pdf' ? 'EPUB' : (job.file_type ? job.file_type.toUpperCase() : '')}</span>
                  </a>

                  <button
                    onClick={(e) => handleDeleteJob(e, job.id, job.file_name)}
                    className="p-1.5 bg-white/[0.04] hover:bg-rose-500/20 text-[#888] hover:text-rose-300 rounded-lg border border-white/[0.08] transition-all flex items-center justify-center"
                    title={t('dashboard.deleteProject', lang)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Progress & ETA Section */}
                <div className="space-y-2 pt-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
                    <div className="flex items-center space-x-2 text-[#888]">
                      <Clock className="w-3.5 h-3.5 text-[#444]" />
                      <span className="font-mono text-zinc-300">{calculateETA()}</span>
                    </div>
                    <div className="text-[#888]">
                      {lang === 'fr' ? 'Avancement :' : 'Progress:'} <span className="text-white font-bold">{Math.round((job.completed_chunks / (job.total_chunks || 1)) * 100)}%</span> <span className="text-[#666] font-mono">({job.completed_chunks}/{job.total_chunks})</span>
                    </div>
                  </div>
                  <div className="w-full h-1 bg-black rounded-full overflow-hidden border border-white/[0.08]">
                    <div
                      className="h-full bg-gradient-to-r from-[#2563eb] to-[#60a5fa] rounded-full transition-all duration-300"
                      style={{ width: `${(job.completed_chunks / (job.total_chunks || 1)) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Clear Side-by-Side Reading Inspector */}
              <div className="card-chill p-6 space-y-4 rounded-2xl">
                
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center space-x-1.5">
                    <FileText className="w-4 h-4 text-white" />
                    <span>{t('inspector.title', lang)}</span>
                  </h3>

                  {/* Direct Segment Jumper Controls */}
                  <div className="flex items-center space-x-2 flex-wrap">
                    {!autoScroll && (
                      <button
                        type="button"
                        onClick={() => setAutoScroll(true)}
                        className="px-2 py-0.5 text-[9px] font-semibold bg-[#2563eb]/10 border border-[#2563eb]/20 hover:bg-[#2563eb]/20 text-[#60a5fa] rounded-md transition-all flex-shrink-0"
                      >
                        {lang === 'fr' ? 'Resynchroniser' : 'Resync'}
                      </button>
                    )}

                    <button
                      disabled={selectedSegIndex <= 0}
                      onClick={() => { setSelectedSegIndex((prev) => Math.max(0, prev - 1)); setAutoScroll(false); }}
                      className="text-zinc-400 hover:text-white disabled:opacity-20 transition-colors p-1"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    <form onSubmit={handleJumpSubmit} className="flex items-center space-x-1">
                      <input
                        type="text"
                        value={jumpInput}
                        onChange={(e) => setJumpInput(e.target.value)}
                        className="w-10 bg-transparent border-b border-white/10 hover:border-white/30 focus:border-[#2563eb] text-center text-xs font-mono text-white outline-none pb-0.5"
                      />
                      <span className="text-xs text-zinc-500 font-mono">/ {segments.length}</span>
                    </form>

                    <button
                      disabled={selectedSegIndex >= segments.length - 1}
                      onClick={() => { setSelectedSegIndex((prev) => Math.min(segments.length - 1, prev + 1)); setAutoScroll(false); }}
                      className="text-[#888] hover:text-white disabled:opacity-20 transition-colors p-1"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {currentSegment ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Left Column: Original Text */}
                    <div className="bg-[#030303]/50 backdrop-blur-md p-4 rounded-xl border border-white/[0.08] space-y-2">
                      <div className="flex items-center justify-between text-xs text-[#888] font-mono border-b border-white/[0.08] pb-2">
                        <span className="font-semibold uppercase tracking-wider text-[#888]">{t('inspector.originalText', lang)} ({job.source_lang.toUpperCase()})</span>
                        <span>~{currentSegment.tokens_est} tokens</span>
                      </div>
                      <div className="text-xs text-zinc-300 font-mono whitespace-pre-wrap max-h-80 overflow-y-auto leading-relaxed p-1">
                        {currentSegment.original_text}
                      </div>
                    </div>

                    {/* Right Column: Translated or Proofread Text */}
                    <div className="bg-[#030303]/50 backdrop-blur-md p-4 rounded-xl border border-white/[0.08] space-y-2">
                      <div className="flex items-center justify-between text-xs text-[#888] font-mono border-b border-white/[0.08] pb-2">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold uppercase tracking-wider text-white">
                            {job.job_type === 'proofreading' ? t('inspector.proofreadText', lang) : t('inspector.targetText', lang)}
                          </span>
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${
                            currentSegment.status === 'DONE' ? 'bg-[#00d4aa]/10 text-[#00d4aa] border border-[#00d4aa]/20' :
                            currentSegment.status === 'FAILED' ? 'bg-rose-500/10 text-[#ff6369] border border-[#ff6369]/20' : 'bg-[#2563eb]/10 text-[#60a5fa] border border-[#2563eb]/20 animate-pulse'
                          }`}>
                            {currentSegment.status === 'DONE' ? (job.job_type === 'proofreading' ? (lang === 'fr' ? 'Relu' : 'Proofread') : (lang === 'fr' ? 'Traduit' : 'Translated')) : currentSegment.status === 'FAILED' ? t('dashboard.failed', lang) : t('dashboard.processing', lang)}
                          </span>
                        </div>

                        {currentSegment.translated_text && (
                          <button
                            onClick={() => handleCopyText(currentSegment.translated_text)}
                            className="text-[#666] hover:text-white transition-colors p-1"
                            title={t('inspector.copyText', lang)}
                          >
                            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                      <div className="text-xs text-zinc-100 font-mono whitespace-pre-wrap max-h-80 overflow-y-auto leading-relaxed p-1">
                        {currentSegment.translated_text || (
                          <span className="text-[#444] italic">
                            {job.job_type === 'proofreading' ? (lang === 'fr' ? 'En attente de relecture...' : 'Waiting for proofreading...') : (lang === 'fr' ? 'En attente de traduction...' : 'Waiting for translation...')}
                          </span>
                        )}
                      </div>
                    </div>

                  </div>
                ) : (
                  <div className="text-center p-8 text-[#666] text-xs">{lang === 'fr' ? 'Chargement...' : 'Loading...'}</div>
                )}
              </div>

            </>
          ) : (
            <div className="card-chill p-12 text-center text-[#666] text-xs">
              {t('inspector.selectProjectPrompt', lang)}
            </div>
          )}

        </div>

      </div>

      {/* Full Width SSE Console Drawer (Spans 100% width under both sidebar and main inspector) */}
      {job && (
        <div className="card-chill rounded-2xl overflow-hidden w-full">
          <button
            onClick={() => setShowConsole(!showConsole)}
            className="w-full px-4 py-3 flex items-center justify-between text-xs font-semibold text-[#888] hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center space-x-2">
              <Terminal className="w-3.5 h-3.5 text-white" />
              <span>{t('inspector.liveSseLogs', lang)} ({logs.length})</span>
            </div>
            <span className="text-[10px] text-[#666] font-mono">{showConsole ? (lang === 'fr' ? 'Masquer' : 'Hide') : (lang === 'fr' ? 'Afficher' : 'Show')}</span>
          </button>

          {showConsole && (
            <div className="bg-[#030303] p-4 border-t border-white/[0.08] font-mono text-xs text-[#888] h-44 overflow-y-auto space-y-1">
              {logs.length === 0 ? (
                <span className="text-[#444]">// En attente d'événements...</span>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className="flex space-x-2">
                    <span className="text-[#444]">[{log.timestamp?.slice(11, 19)}]</span>
                    <span className="text-[#60a5fa]">[{log.type}]</span>
                    <span>
                      Chunk #{log.chunk_index} {log.type === 'segment_completed' ? 'généré avec succès.' : log.error || ''}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
