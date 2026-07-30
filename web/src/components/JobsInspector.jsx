import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RefreshCw, Download, FileText, CheckCircle2, AlertTriangle, Terminal, ChevronRight, ChevronLeft, Clock, Copy, Check, Trash2, ArrowRight } from 'lucide-react';
import { fetchJobs, fetchJobDetail, fetchJobSegments, startJob, pauseJob, retryJob, deleteJob } from '../api';

export default function JobsInspector({ selectedJobId, onSelectJob, settings }) {
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
  const [sessionStats, setSessionStats] = useState({
    jobId: null,
    startTime: null,
    startCompletedCount: 0,
    lastCompletedCount: 0
  });

  const prevSegmentsRef = useRef([]);

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

        // Calculate speed ONLY on chunk completion event (avoids render-time upward drift)
        const completedInSession = job.completed_chunks - sessionStats.startCompletedCount;
        const minHistory = 8; // Stable history threshold requested by user
        
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
    } else if (jobs.length > 0 && !job) {
      loadJobDetails(jobs[0].id);
    }
  }, [selectedJobId]);

  useEffect(() => {
    setJumpInput(String(selectedSegIndex + 1));
  }, [selectedSegIndex]);

  const loadJobsList = async () => {
    try {
      const data = await fetchJobs();
      setJobs(data);
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
    startJob(job.id, {
      endpoint: settings.endpoint,
      apiKey: settings.apiKey,
      concurrency: settings.concurrency,
      temperature: settings.temperature
    }).catch(console.error);
    await refreshActiveJob();
  };

  const handlePause = async () => {
    if (!job) return;
    setJob((prev) => prev ? { ...prev, status: 'PAUSED' } : null);
    pauseJob(job.id).catch(console.error);
    await refreshActiveJob();
  };

  const handleRetryAndStart = async () => {
    if (!job) return;
    setJob((prev) => prev ? { ...prev, status: 'PROCESSING' } : null);
    setSegments((prev) => prev.map((s) => s.status === 'FAILED' ? { ...s, status: 'PENDING', error: null } : s));
    retryJob(job.id)
      .then(() => startJob(job.id, {
        endpoint: settings.endpoint,
        apiKey: settings.apiKey,
        concurrency: settings.concurrency,
        temperature: settings.temperature
      }))
      .catch(console.error);
    await refreshActiveJob();
  };

  const handleDeleteJob = async (e, jobId, fileName) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Supprimer définitivement le projet "${fileName}" ?`)) return;
    setJobs((prev) => prev.filter((j) => j.id !== jobId));
    if (job?.id === jobId) {
      setJob(null);
      setSegments([]);
    }
    deleteJob(jobId).catch(console.error);
    await loadJobsList();
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
    if (job.status === 'COMPLETED') return 'Traduction terminée';
    if (job.status === 'PAUSED') return 'En pause';
    if (job.completed_chunks === 0) return 'Démarrage de la traduction...';

    const remaining = job.total_chunks - job.completed_chunks;
    if (remaining <= 0) return 'Traduction terminée';

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
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      
      {/* Sidebar List (1 col) */}
      <div className="card-chill p-4 space-y-2">
        <h2 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-2">Livres & Projets ({jobs.length})</h2>
        <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
          {jobs.map((j) => {
            const percent = j.total_chunks > 0 ? Math.round((j.completed_chunks / j.total_chunks) * 100) : 0;
            const isSelected = job?.id === j.id;
            const truncatedName = j.file_name.length > 16 ? j.file_name.slice(0, 16) + '...' : j.file_name;

            return (
              <div
                key={j.id}
                onClick={() => { onSelectJob(j.id); loadJobDetails(j.id); }}
                className={`p-3 rounded-xl cursor-pointer transition-all flex items-center justify-between border ${
                  isSelected
                    ? 'bg-orange-500/15 border-orange-500/30 text-white shadow-md'
                    : 'bg-black/30 border-white/5 text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                }`}
                title={j.file_name}
              >
                <div className="truncate pr-2">
                  <p className="font-semibold text-xs truncate">{truncatedName}</p>
                  <p className="text-[10px] text-zinc-400 font-mono mt-0.5">{percent}% ({j.completed_chunks}/{j.total_chunks} segs)</p>
                </div>
                
                <div className="flex items-center space-x-1 flex-shrink-0">
                  <button
                    onClick={(e) => handleDeleteJob(e, j.id, j.file_name)}
                    className="text-zinc-600 hover:text-rose-400 p-1 transition-colors"
                    title="Supprimer le livre"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <ChevronRight className={`w-3.5 h-3.5 ${isSelected ? 'text-orange-400' : 'text-zinc-600'}`} />
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
            <div className="card-chill p-6 space-y-4">
              <div className="flex items-center space-x-3 flex-wrap">
                <h1 className="text-base font-bold text-white tracking-tight leading-snug truncate max-w-[200px] sm:max-w-[400px]" title={job.file_name}>
                  {job.file_name}
                </h1>
                <span className="px-2 py-0.5 rounded bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[10px] uppercase font-bold font-mono flex-shrink-0">
                  {job.file_type}
                </span>
                <span className="text-xs text-orange-300 font-mono flex-shrink-0">
                  {job.model}
                </span>
                {failedCount > 0 && (
                  <span className="text-rose-400 font-mono text-xs font-bold flex-shrink-0">
                    ({failedCount} échec{failedCount > 1 ? 's' : ''})
                  </span>
                )}
              </div>

              {/* Action Buttons and Details Toggle Link */}
              <div className="flex items-center justify-between flex-wrap gap-4 pt-3 border-t border-white/5">
                <div className="flex items-center gap-2 flex-wrap">
                  {job.status === 'PROCESSING' ? (
                    <button
                      onClick={handlePause}
                      className="px-3.5 py-2 bg-white/5 text-zinc-300 border border-white/10 hover:bg-white/10 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors"
                    >
                      <Pause className="w-3.5 h-3.5" />
                      <span>Pause</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleStartResume}
                      className="btn-orange px-4 py-2 text-xs font-semibold flex items-center space-x-1.5"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      <span>{job.completed_chunks > 0 ? 'Reprendre' : 'Démarrer'}</span>
                    </button>
                  )}

                  <button
                    onClick={handleRetryAndStart}
                    className="px-3.5 py-2 bg-rose-500/10 text-rose-300 border border-rose-500/20 rounded-xl text-xs font-semibold hover:bg-rose-500/20 flex items-center space-x-1.5 transition-colors"
                    title="Réinitialise les échecs et relance"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Relancer Échecs</span>
                  </button>

                  <a
                    href={`/api/jobs/${job.id}/download?t=${Date.now()}`}
                    target="_blank"
                    rel="noreferrer"
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center space-x-1.5 transition-all ${
                      job.status === 'COMPLETED' || job.completed_chunks > 0
                        ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/20'
                        : 'opacity-30 pointer-events-none bg-white/5 text-zinc-600 border border-transparent'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Télécharger EPUB</span>
                  </a>

                  <button
                    onClick={(e) => handleDeleteJob(e, job.id, job.file_name)}
                    className="p-2 bg-white/5 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-300 rounded-xl border border-white/5 transition-all flex items-center justify-center"
                    title="Supprimer ce projet"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => setShowDetails(!showDetails)}
                    className="text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors flex items-center space-x-1"
                  >
                    <span>{showDetails ? 'Masquer Détails' : 'Détails'}</span>
                  </button>
                </div>
              </div>

              {/* Collapsible Details list - thin border and flat layout */}
              {showDetails && (
                <div className="border-t border-white/5 pt-3 mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-y-2 gap-x-4 font-mono text-[10px] text-zinc-400">
                  <div>
                    <span className="text-zinc-600">ID :</span> <span className="text-zinc-300">{job.id}</span>
                  </div>
                  <div>
                    <span className="text-zinc-600">Langues :</span> <span className="text-zinc-300">{job.source_lang.toUpperCase()} ➔ {job.target_lang.toUpperCase()}</span>
                  </div>
                  <div>
                    <span className="text-zinc-600">Glossaire :</span> <span className="text-zinc-300">{job.glossary_name || 'Aucun'}</span>
                  </div>
                  <div>
                    <span className="text-zinc-600">Taille chunk :</span> <span className="text-orange-300">{job.chunk_size || 1000} tokens</span>
                  </div>
                  <div>
                    <span className="text-zinc-600">Température :</span> <span className="text-orange-300">{job.temperature !== undefined && job.temperature !== null ? Number(job.temperature).toFixed(2) : (settings?.temperature ? Number(settings.temperature).toFixed(2) : '1.50')}</span>
                  </div>
                  <div>
                    <span className="text-zinc-600">Concurrence :</span> <span className="text-orange-300">{job.concurrency || settings?.concurrency || 1} req.</span>
                  </div>
                  <div>
                    <span className="text-zinc-600">Date d'import :</span> <span className="text-zinc-300">{new Date(job.created_at).toLocaleString()}</span>
                  </div>
                </div>
              )}

              {/* Progress & ETA Section */}
              <div className="space-y-2 pt-4 border-t border-white/5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
                  <div className="flex items-center space-x-2 text-zinc-400">
                    <Clock className="w-3.5 h-3.5 text-zinc-500" />
                    <span className="font-mono text-zinc-300">{calculateETA()}</span>
                  </div>
                  <div className="text-zinc-400">
                    Avancement : <span className="text-white font-bold">{Math.round((job.completed_chunks / (job.total_chunks || 1)) * 100)}%</span> <span className="text-zinc-500 font-mono">({job.completed_chunks}/{job.total_chunks})</span>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-black/60 rounded-full overflow-hidden border border-white/5">
                  <div
                    className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-300"
                    style={{ width: `${(job.completed_chunks / (job.total_chunks || 1)) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Clear Side-by-Side Reading Inspector */}
            <div className="card-chill p-6 space-y-4">
              
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-widest flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-orange-400" />
                  <span>Inspecteur de Segment (Visualiseur Côte à Côte)</span>
                </h3>

                {/* Direct Segment Jumper Controls */}
                <div className="flex items-center space-x-2 flex-wrap">
                  {!autoScroll && (
                    <button
                      type="button"
                      onClick={() => setAutoScroll(true)}
                      className="px-2 py-0.5 text-[10px] font-semibold bg-orange-500/10 border border-orange-500/30 hover:bg-orange-500/20 text-orange-400 rounded-lg transition-all flex-shrink-0"
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
                      className="w-10 bg-transparent border-b border-white/10 hover:border-white/30 focus:border-orange-500 text-center text-xs font-mono text-white outline-none pb-0.5"
                    />
                    <span className="text-xs text-zinc-500 font-mono">/ {segments.length}</span>
                  </form>

                  <button
                    disabled={selectedSegIndex >= segments.length - 1}
                    onClick={() => { setSelectedSegIndex((prev) => Math.min(segments.length - 1, prev + 1)); setAutoScroll(false); }}
                    className="text-zinc-400 hover:text-white disabled:opacity-20 transition-colors p-1"
                    title="Suivant"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {currentSegment ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Left Column: Original Text */}
                  <div className="bg-black/50 p-4 rounded-xl border border-white/5 space-y-2">
                    <div className="flex items-center justify-between text-xs text-zinc-400 font-mono border-b border-white/5 pb-2">
                      <span className="font-bold uppercase tracking-wider text-orange-300">Texte Original ({job.source_lang.toUpperCase()})</span>
                      <span>~{currentSegment.tokens_est} tokens</span>
                    </div>
                    <div className="text-xs text-zinc-300 font-mono whitespace-pre-wrap max-h-80 overflow-y-auto leading-relaxed p-1">
                      {currentSegment.original_text}
                    </div>
                  </div>

                  {/* Right Column: Translated Text */}
                  <div className="bg-black/50 p-4 rounded-xl border border-orange-500/20 space-y-2">
                    <div className="flex items-center justify-between text-xs text-zinc-400 font-mono border-b border-white/5 pb-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold uppercase tracking-wider text-emerald-400">Traduction Littéraire (FR)</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          currentSegment.status === 'DONE' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                          currentSegment.status === 'FAILED' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}>
                          {currentSegment.status === 'DONE' ? 'Traduit' : currentSegment.status === 'FAILED' ? 'Échec' : 'En cours...'}
                        </span>
                      </div>

                      {currentSegment.translated_text && (
                        <button
                          onClick={() => handleCopyText(currentSegment.translated_text)}
                          className="text-zinc-500 hover:text-white transition-colors p-1"
                          title="Copier le texte"
                        >
                          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                    <div className="text-xs text-zinc-100 font-mono whitespace-pre-wrap max-h-80 overflow-y-auto leading-relaxed p-1">
                      {currentSegment.translated_text || <span className="text-zinc-600 italic">En attente de traduction...</span>}
                    </div>
                  </div>

                </div>
              ) : (
                <div className="text-center p-8 text-zinc-500 text-xs">Chargement...</div>
              )}
            </div>

            {/* Collapsible SSE Console Drawer */}
            <div className="card-chill rounded-xl overflow-hidden">
              <button
                onClick={() => setShowConsole(!showConsole)}
                className="w-full px-4 py-3 flex items-center justify-between text-xs font-semibold text-zinc-400 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <Terminal className="w-3.5 h-3.5 text-orange-400" />
                  <span>Console de Logs SSE ({logs.length})</span>
                </div>
                <span className="text-[10px] text-zinc-500 font-mono">{showConsole ? 'Masquer' : 'Afficher'}</span>
              </button>

              {showConsole && (
                <div className="bg-black/80 p-4 border-t border-white/5 font-mono text-xs text-zinc-300 h-44 overflow-y-auto space-y-1">
                  {logs.length === 0 ? (
                    <span className="text-zinc-600">// En attente d'événements...</span>
                  ) : (
                    logs.map((log, idx) => (
                      <div key={idx} className="flex space-x-2">
                        <span className="text-zinc-500">[{log.timestamp?.slice(11, 19)}]</span>
                        <span className="text-orange-400">[{log.type}]</span>
                        <span>
                          Chunk #{log.chunk_index} {log.type === 'segment_completed' ? 'généré avec succès.' : log.error || ''}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

          </>
        ) : (
          <div className="card-chill p-12 text-center text-zinc-500 text-xs">
            Sélectionnez un projet à gauche pour commencer l'inspection.
          </div>
        )}

      </div>

    </div>
  );
}
