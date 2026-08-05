import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RefreshCw, Download, FileText, CheckCircle2, AlertTriangle, Terminal, ChevronRight, ChevronLeft, Clock, Copy, Check, Trash2, ArrowRight, Sparkles } from 'lucide-react';
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
      setEditModel(job.model || settings.model || '');
      setEditConcurrency(job.concurrency || 1);
      setEditTemperature(job.temperature !== undefined && job.temperature !== null ? job.temperature : 0.15);
    }
  }, [job?.id]);

  const handleSaveJobConfig = async (e) => {
    if (e) e.preventDefault();
    if (!job) return;
    try {
      await updateJobConfig(job.id, {
        model: editModel,
        concurrency: editConcurrency,
        temperature: editTemperature
      });
      setIsEditingConfig(false);
      await refreshActiveJob();
    } catch (err) {
      console.error(err);
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
    if (selectedJobId) {
      loadJobDetails(selectedJobId);
      loadJobsList();
    } else {
      loadJobsList();
    }
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
        if (targetId !== selectedJobId && onSelectJob) {
          onSelectJob(targetId);
        }
        if (!job || job.id !== targetId) {
          loadJobDetails(targetId);
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

  const loadJobDetails = async (id) => {
    try {
      const jData = await fetchJobDetail(id);
      const sData = await fetchJobSegments(id);
      setJob(jData);
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
    if (!job || job.total_chunks === 0) return 'Calcul de la vitesse...';
    const isProofread = job.job_type === 'proofreading';
    if (job.status === 'COMPLETED') return isProofread ? 'Relecture terminée' : 'Traduction terminée';
    if (job.status === 'PAUSED') return 'En pause';
    if (job.completed_chunks === 0) return isProofread ? 'Démarrage de la relecture...' : 'Démarrage de la traduction...';

    const remaining = job.total_chunks - job.completed_chunks;
    if (remaining <= 0) return isProofread ? 'Relecture terminée' : 'Traduction terminée';

    const minHistory = 8;
    if (sessionStats.startTime && sessionStats.jobId === job.id && job.status === 'PROCESSING') {
      const completedInSession = job.completed_chunks - sessionStats.startCompletedCount;
      if (completedInSession < minHistory) {
        return `Calcul du temps restant (historique ${completedInSession}/${minHistory})...`;
      }
    } else {
      return 'Calcul du temps restant...';
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
        <div className="card-chill p-4 space-y-3 rounded-2xl flex flex-col h-full min-h-[500px]">
          <h2 className="text-[10px] font-semibold text-[#888] uppercase tracking-wider px-2">Livres & Projets ({jobs.length})</h2>
          <div className="space-y-2 overflow-y-auto pr-1 flex-1 min-h-0">
            {jobs.map((j) => {
              const percent = j.total_chunks > 0 ? Math.round((j.completed_chunks / j.total_chunks) * 100) : 0;
              const isSelected = job?.id === j.id;
              const truncatedName = j.file_name.length > 16 ? j.file_name.slice(0, 16) + '...' : j.file_name;

              return (
                <div
                  key={j.id}
                  onClick={() => { onSelectJob(j.id); loadJobDetails(j.id); }}
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
                      title="Supprimer le livre"
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
                <div className="flex items-center space-x-3 flex-wrap gap-y-2">
                  <h1 className="text-sm font-semibold text-white tracking-tight leading-snug truncate max-w-[200px] sm:max-w-[400px]" title={job.file_name}>
                    {job.file_name}
                  </h1>

                  {/* 1. Type de Fichier */}
                  <span className="px-2.5 py-0.5 rounded-md bg-white/[0.06] border border-white/[0.1] text-zinc-300 text-[9px] uppercase font-bold font-mono flex-shrink-0">
                    {job.file_type}
                  </span>

                  {/* 2. Mode (Traduction / Relecture) - Just the clean word! */}
                  <span className={`px-2.5 py-0.5 rounded-md text-[9px] font-mono font-bold uppercase border flex-shrink-0 ${
                    job.job_type === 'proofreading'
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                      : 'border-blue-500/30 bg-blue-500/10 text-blue-400'
                  }`}>
                    {job.job_type === 'proofreading' ? 'Relecture' : 'Traduction'}
                  </span>

                  {/* 3. Modèle */}
                  <span className="px-2.5 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-[#888] text-[9px] font-mono flex-shrink-0">
                    {job.model}
                  </span>

                  {failedCount > 0 && (
                    <span className="text-[#ff6369] font-mono text-xs font-semibold flex-shrink-0">
                      ({failedCount} échec{failedCount > 1 ? 's' : ''})
                    </span>
                  )}
                </div>

                {/* Action Buttons and Details Toggle Link */}
                <div className="flex items-center justify-between flex-wrap gap-4 pt-3 border-t border-white/[0.08]">
                  <div className="flex items-center gap-2 flex-wrap">
                    {job.status === 'PROCESSING' ? (
                      <button
                        onClick={handlePause}
                        className="px-3 py-1.5 bg-white/[0.04] text-white border border-white/[0.08] hover:bg-white/[0.08] rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors"
                      >
                        <Pause className="w-3.5 h-3.5" />
                        <span>Pause</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleStartResume}
                        className="btn-orange px-3.5 py-1.5 text-xs font-medium flex items-center space-x-1.5"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" />
                        <span>{job.completed_chunks > 0 ? 'Reprendre' : 'Démarrer'}</span>
                      </button>
                    )}

                    <button
                      onClick={handleRetryAndStart}
                      className="px-3 py-1.5 bg-[#ff6369]/10 text-[#ff6369] border border-[#ff6369]/20 rounded-lg text-xs font-medium hover:bg-[#ff6369]/20 flex items-center space-x-1.5 transition-colors"
                      title="Réinitialise les échecs et relance"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Relancer Échecs</span>
                    </button>

                    <a
                      href={`/api/jobs/${job.id}/download?t=${Date.now()}`}
                      target="_blank"
                      rel="noreferrer"
                      title={job.file_type === 'pdf' ? 'Export automatique au format EPUB réajustable' : `Télécharger au format ${job.file_type ? job.file_type.toUpperCase() : 'document'}`}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium inline-flex items-center space-x-1.5 transition-all ${
                        job.status === 'COMPLETED' || job.completed_chunks > 0
                          ? 'bg-white/[0.04] text-white border border-white/[0.08] hover:bg-white/[0.08]'
                          : 'opacity-20 pointer-events-none'
                      }`}
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Télécharger {job.file_type === 'pdf' ? 'EPUB' : (job.file_type ? job.file_type.toUpperCase() : 'Fichier')}</span>
                    </a>

                    <button
                      onClick={(e) => handleDeleteJob(e, job.id, job.file_name)}
                      className="p-1.5 bg-white/[0.04] hover:bg-rose-500/20 text-[#888] hover:text-rose-300 rounded-lg border border-white/[0.08] transition-all flex items-center justify-center"
                      title="Supprimer ce projet"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center space-x-3">
                    {job.status === 'PROCESSING' ? (
                      <span className="text-[10px] text-[#666] italic font-mono">
                        (Mettez en pause pour modifier la config)
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsEditingConfig(!isEditingConfig)}
                        className="text-xs font-medium text-[#60a5fa] hover:text-blue-300 transition-colors flex items-center space-x-1"
                      >
                        <span>{isEditingConfig ? 'Fermer Config' : 'Modifier la config ➔'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowDetails(!showDetails)}
                      className="text-xs font-medium text-[#888] hover:text-white transition-colors flex items-center space-x-1"
                    >
                      <span>{showDetails ? 'Masquer Détails' : 'Détails'}</span>
                    </button>
                  </div>
                </div>

                {/* Inline Job Config Editor */}
                {isEditingConfig && job.status !== 'PROCESSING' && (
                  <form onSubmit={handleSaveJobConfig} className="p-4 rounded-xl bg-black/50 border border-[#60a5fa]/30 space-y-3 mt-3">
                    <div className="flex items-center justify-between border-b border-white/[0.08] pb-2 flex-wrap gap-2">
                      <span className="text-xs font-semibold text-white uppercase tracking-wider">Modifier la Config du Projet</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (settings.model) setEditModel(settings.model);
                          if (settings.concurrency) setEditConcurrency(settings.concurrency);
                          if (settings.temperature !== undefined) setEditTemperature(settings.temperature);
                        }}
                        className="px-2.5 py-1 rounded bg-blue-500/10 hover:bg-blue-500/20 text-[#60a5fa] border border-[#60a5fa]/30 text-[10px] font-mono font-medium flex items-center space-x-1 transition-all"
                      >
                        <Sparkles className="w-3 h-3 text-[#60a5fa]" />
                        <span>Appliquer la config active du Dashboard</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] text-[#888] uppercase font-bold mb-1">Modèle LLM</label>
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
                        <label className="block text-[10px] text-[#888] uppercase font-bold mb-1">Concurrence (Slots)</label>
                        <input
                          type="number"
                          min="1"
                          max="16"
                          value={editConcurrency}
                          onChange={(e) => setEditConcurrency(parseInt(e.target.value, 10) || 1)}
                          className="w-full input-chill px-3 py-1.5 text-xs font-mono text-zinc-200"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-[#888] uppercase font-bold mb-1">Température ({editTemperature.toFixed(2)})</label>
                        <input
                          type="range"
                          min="0.0"
                          max="1.5"
                          step="0.05"
                          value={editTemperature}
                          onChange={(e) => setEditTemperature(parseFloat(e.target.value))}
                          className="w-full accent-[#2563eb] mt-1.5"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-[#2563eb] hover:bg-blue-600 text-white rounded-lg text-xs font-semibold transition-all shadow-sm"
                      >
                        Enregistrer la configuration de ce projet
                      </button>
                    </div>
                  </form>
                )}

                {/* Collapsible Details list */}
                {showDetails && (
                  <div className="border-t border-white/[0.08] pt-3 mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-y-2 gap-x-4 font-mono text-[10px] text-[#888]">
                    <div>
                      <span className="text-[#444]">ID :</span> <span className="text-zinc-300">{job.id}</span>
                    </div>
                    <div>
                      <span className="text-[#444]">Langues :</span> <span className="text-zinc-300">{job.source_lang.toUpperCase()} ➔ {job.target_lang.toUpperCase()}</span>
                    </div>
                    <div>
                      <span className="text-[#444]">Glossaire :</span> <span className="text-zinc-300">{job.glossary_name || 'Aucun'}</span>
                    </div>
                    <div>
                      <span className="text-[#444]">Taille chunk :</span> <span className="text-[#60a5fa]">{job.chunk_size || 1000} tokens</span>
                    </div>
                    <div>
                      <span className="text-[#444]">Température :</span> <span className="text-[#60a5fa]">{job.temperature !== undefined && job.temperature !== null ? Number(job.temperature).toFixed(2) : (settings?.temperature ? Number(settings.temperature).toFixed(2) : '1.50')}</span>
                    </div>
                    <div>
                      <span className="text-[#444]">Concurrence :</span> <span className="text-[#60a5fa]">{job.concurrency || settings?.concurrency || 1} req.</span>
                    </div>
                    <div>
                      <span className="text-[#444]">Date d'import :</span> <span className="text-zinc-300">{new Date(job.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                )}

                {/* Progress & ETA Section */}
                <div className="space-y-2 pt-4 border-t border-white/[0.08]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
                    <div className="flex items-center space-x-2 text-[#888]">
                      <Clock className="w-3.5 h-3.5 text-[#444]" />
                      <span className="font-mono text-zinc-300">{calculateETA()}</span>
                    </div>
                    <div className="text-[#888]">
                      Avancement : <span className="text-white font-bold">{Math.round((job.completed_chunks / (job.total_chunks || 1)) * 100)}%</span> <span className="text-[#666] font-mono">({job.completed_chunks}/{job.total_chunks})</span>
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
                    <span>Inspecteur de Segment</span>
                  </h3>

                  {/* Direct Segment Jumper Controls */}
                  <div className="flex items-center space-x-2 flex-wrap">
                    {!autoScroll && (
                      <button
                        type="button"
                        onClick={() => setAutoScroll(true)}
                        className="px-2 py-0.5 text-[9px] font-semibold bg-[#2563eb]/10 border border-[#2563eb]/20 hover:bg-[#2563eb]/20 text-[#60a5fa] rounded-md transition-all flex-shrink-0"
                        title="Réactiver le suivi automatique en direct"
                      >
                        Resynchroniser
                      </button>
                    )}

                    <button
                      disabled={selectedSegIndex <= 0}
                      onClick={() => { setSelectedSegIndex((prev) => Math.max(0, prev - 1)); setAutoScroll(false); }}
                      className="text-zinc-400 hover:text-white disabled:opacity-20 transition-colors p-1"
                      title="Précédent"
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
                      title="Suivant"
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
                        <span className="font-semibold uppercase tracking-wider text-[#888]">Texte Original ({job.source_lang.toUpperCase()})</span>
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
                            {job.job_type === 'proofreading' ? 'Version Relue (FR)' : 'Traduction (FR)'}
                          </span>
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${
                            currentSegment.status === 'DONE' ? 'bg-[#00d4aa]/10 text-[#00d4aa] border border-[#00d4aa]/20' :
                            currentSegment.status === 'FAILED' ? 'bg-rose-500/10 text-[#ff6369] border border-[#ff6369]/20' : 'bg-[#2563eb]/10 text-[#60a5fa] border border-[#2563eb]/20 animate-pulse'
                          }`}>
                            {currentSegment.status === 'DONE' ? (job.job_type === 'proofreading' ? 'Relu' : 'Traduit') : currentSegment.status === 'FAILED' ? 'Échec' : 'En cours'}
                          </span>
                        </div>

                        {currentSegment.translated_text && (
                          <button
                            onClick={() => handleCopyText(currentSegment.translated_text)}
                            className="text-[#666] hover:text-white transition-colors p-1"
                            title="Copier le texte"
                          >
                            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                      <div className="text-xs text-zinc-100 font-mono whitespace-pre-wrap max-h-80 overflow-y-auto leading-relaxed p-1">
                        {currentSegment.translated_text || (
                          <span className="text-[#444] italic">
                            {job.job_type === 'proofreading' ? 'En attente de relecture...' : 'En attente de traduction...'}
                          </span>
                        )}
                      </div>
                    </div>

                  </div>
                ) : (
                  <div className="text-center p-8 text-[#666] text-xs">Chargement...</div>
                )}
              </div>

            </>
          ) : (
            <div className="card-chill p-12 text-center text-[#666] text-xs">
              Sélectionnez un projet à gauche pour commencer l'inspection.
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
              <span>Console de Logs SSE ({logs.length})</span>
            </div>
            <span className="text-[10px] text-[#666] font-mono">{showConsole ? 'Masquer' : 'Afficher'}</span>
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
