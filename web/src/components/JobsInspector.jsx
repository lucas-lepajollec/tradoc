import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RefreshCw, Download, ChevronRight, ChevronLeft, ChevronDown, Copy, Check, Search, Trash2, Sliders, X } from 'lucide-react';
import { fetchJobs, fetchJobDetail, fetchJobSegments, startJob, pauseJob, retryJob, deleteJob, updateJobConfig, downloadJob, subscribeToEvents } from '../api';
import { l, languageLabel, localeTag, t } from '../i18n/translations';
import { readableSegment } from '../utils/readableSegment';

const estimateTokens = (text = '') => {
  if (!text) return 0;
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(Math.floor(text.length / 3.8), Math.floor(words * 1.3));
};

const INSPECTOR_SNAPSHOT_KEY = 'tradoc_inspector_snapshot';
const INSPECTOR_JOBS_SNAPSHOT_KEY = 'tradoc_inspector_jobs_snapshot';
let inspectorJobsCache = [];

const readJobsSnapshot = () => {
  if (inspectorJobsCache.length > 0) return inspectorJobsCache;
  try {
    const snapshot = JSON.parse(sessionStorage.getItem(INSPECTOR_JOBS_SNAPSHOT_KEY) || '[]');
    inspectorJobsCache = Array.isArray(snapshot) ? snapshot : [];
  } catch {
    sessionStorage.removeItem(INSPECTOR_JOBS_SNAPSHOT_KEY);
    inspectorJobsCache = [];
  }
  return inspectorJobsCache;
};

const readInspectorSnapshot = (jobId) => {
  if (!jobId) return null;
  try {
    const snapshot = JSON.parse(sessionStorage.getItem(INSPECTOR_SNAPSHOT_KEY) || 'null');
    return snapshot?.job?.id === jobId && snapshot?.segment ? snapshot : null;
  } catch {
    sessionStorage.removeItem(INSPECTOR_SNAPSHOT_KEY);
    return null;
  }
};

const segmentsFromSnapshot = (snapshot) => {
  if (!snapshot?.segment) return [];
  const length = Math.max(snapshot.totalSegments || 0, snapshot.selectedSegIndex + 1, 1);
  const restored = new Array(length);
  restored[snapshot.selectedSegIndex] = snapshot.segment;
  return restored;
};

const latestSegmentIndex = (items = []) => {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (items[index]?.status === 'DONE' || items[index]?.status === 'PROCESSING') return index;
  }
  return 0;
};

export default function JobsInspector({ selectedJobId, onSelectJob, settings, availableModels = [], lang = 'en', onSelectModel }) {
  const initialSnapshot = useRef(readInspectorSnapshot(selectedJobId)).current;
  const initialJobs = useRef(readJobsSnapshot()).current;
  const [jobs, setJobs] = useState(initialJobs);
  const [job, setJob] = useState(initialSnapshot?.job || null);
  const [segments, setSegments] = useState(() => segmentsFromSnapshot(initialSnapshot));
  const [selectedSegIndex, setSelectedSegIndex] = useState(initialSnapshot?.selectedSegIndex || 0);
  const [jumpInput, setJumpInput] = useState(String((initialSnapshot?.selectedSegIndex || 0) + 1));
  const [logs, setLogs] = useState([]);
  const [showConsole, setShowConsole] = useState(false);
  const [copied, setCopied] = useState(false);
  const [secondsPerChunk, setSecondsPerChunk] = useState(3.5);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showRawSegments, setShowRawSegments] = useState(false);
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

  const jobsRef = useRef(initialJobs);
  const jobRef = useRef(job);
  const selectedJobIdRef = useRef(selectedJobId);
  const detailsRequestRef = useRef(0);
  const jobsRequestRef = useRef(0);
  const segmentCacheRef = useRef(new Map());

  useEffect(() => {
    jobsRef.current = jobs;
    inspectorJobsCache = jobs;
    try {
      sessionStorage.setItem(INSPECTOR_JOBS_SNAPSHOT_KEY, JSON.stringify(jobs));
    } catch {
      // The in-memory snapshot still prevents a flash during in-app navigation.
    }
  }, [jobs]);

  useEffect(() => {
    jobRef.current = job;
  }, [job]);

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

  const autoScrollRef = useRef(autoScroll);
  useEffect(() => {
    autoScrollRef.current = autoScroll;
  }, [autoScroll]);

  const jumpToLatestSegment = (segArray = segments) => {
    if (!segArray || segArray.length === 0) return;
    setSelectedSegIndex(latestSegmentIndex(segArray));
  };

  const handleResync = () => {
    setAutoScroll(true);
    jumpToLatestSegment();
  };

  // Persist and restore sessionStats & speed calculation seamlessly across reloads
  useEffect(() => {
    if (!job) {
      if (sessionStats.jobId) {
        setSessionStats({ jobId: null, startTime: null, startCompletedCount: 0, lastCompletedCount: 0 });
      }
      return;
    }

    if (job.status === 'PROCESSING') {
      const savedKey = `tradoc_session_${job.id}`;
      const saved = localStorage.getItem(savedKey);
      let activeStats = sessionStats;

      // Restore from localStorage first if React state isn't initialized yet
      if (saved && (sessionStats.jobId !== job.id || sessionStats.startTime === null)) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.jobId === job.id && parsed.startTime) {
            activeStats = parsed;
            setSessionStats(parsed);
            if (parsed.speed) setSecondsPerChunk(parsed.speed);
          }
        } catch (e) {
          console.error(e);
        }
      }

      if (activeStats.jobId !== job.id || activeStats.startTime === null) {
        const isGemma = job.model && job.model.toLowerCase().includes('gemma');
        const defaultSpeed = isGemma ? 9.0 : 3.5;
        const newStats = {
          jobId: job.id,
          startTime: Date.now(),
          startCompletedCount: job.completed_chunks,
          lastCompletedCount: job.completed_chunks,
          speed: defaultSpeed
        };
        setSessionStats(newStats);
        setSecondsPerChunk(defaultSpeed);
        localStorage.setItem(savedKey, JSON.stringify(newStats));
      } else if (job.completed_chunks > activeStats.lastCompletedCount) {
        const updatedStats = {
          ...activeStats,
          lastCompletedCount: job.completed_chunks
        };

        const completedInSession = job.completed_chunks - activeStats.startCompletedCount;
        const elapsedSec = (Date.now() - activeStats.startTime) / 1000;
        let newSpeed = activeStats.speed || secondsPerChunk;

        if (completedInSession >= 1 && elapsedSec > 0) {
          newSpeed = Math.max(0.5, Math.min(25.0, elapsedSec / completedInSession));
          setSecondsPerChunk(newSpeed);
        }

        updatedStats.speed = newSpeed;
        setSessionStats(updatedStats);
        localStorage.setItem(savedKey, JSON.stringify(updatedStats));
      }
    } else {
      if (sessionStats.startTime !== null) {
        setSessionStats(prev => ({ ...prev, startTime: null }));
      }
      localStorage.removeItem(`tradoc_session_${job.id}`);
    }
  }, [job?.id, job?.status, job?.completed_chunks]);

  const currentJobIdRef = useRef(selectedJobId || job?.id);
  useEffect(() => {
    selectedJobIdRef.current = selectedJobId;
    currentJobIdRef.current = selectedJobId || jobRef.current?.id || null;
  }, [selectedJobId]);

  // Tab visibility change auto-sync (prevents UI freezing when returning to tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshActiveJob(selectedJobIdRef.current || currentJobIdRef.current);
        loadJobsList(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    loadJobsList(true);

    const unsubscribe = subscribeToEvents((data) => {
          const isCurrentJob = Boolean(data.job_id && data.job_id === selectedJobIdRef.current);
          if (data.type === 'job_paused' || data.type === 'job_auto_paused') {
            if (isCurrentJob) setJob((prev) => prev ? { ...prev, status: 'PAUSED' } : null);
            setJobs((prev) => prev.map((j) => data.job_id === j.id ? { ...j, status: 'PAUSED' } : j));
          } else if (data.type === 'job_started') {
            if (isCurrentJob) setJob((prev) => prev ? { ...prev, status: 'PROCESSING' } : null);
            setJobs((prev) => prev.map((j) => data.job_id === j.id ? { ...j, status: 'PROCESSING' } : j));
          } else if (data.type === 'job_completed') {
            if (isCurrentJob) {
              setJob((prev) => prev ? { ...prev, status: 'COMPLETED' } : null);
              refreshActiveJob(data.job_id);
            }
            setJobs((prev) => prev.map((j) => data.job_id === j.id ? { ...j, status: 'COMPLETED' } : j));
          } else if (data.type === 'segment_started') {
            if (isCurrentJob && data.chunk_index !== undefined) {
              setSegments((prev) => prev.map((segment) => segment?.chunk_index === data.chunk_index ? { ...segment, status: 'PROCESSING' } : segment));
              if (autoScrollRef.current) setSelectedSegIndex(data.chunk_index);
            }
          } else if (data.type === 'segment_completed' || data.type === 'segment_failed') {
            const currentId = selectedJobIdRef.current;
            const targetId = data.job_id || currentId;

            // Only append log and update segments if event belongs to currently selected job
            if (data.job_id && data.job_id === currentId) {
              setLogs((prev) => [data, ...prev.slice(0, 49)]);
              if (data.chunk_index !== undefined) {
                setSegments((prev) => prev.map((s) => s?.chunk_index === data.chunk_index ? { ...s, status: data.type === 'segment_completed' ? 'DONE' : 'FAILED', translated_text: data.translated_text || s.translated_text } : s));
                if (autoScrollRef.current) {
                  setSelectedSegIndex(data.chunk_index);
                }
              }
            }

            // Update lightweight job detail to reflect progress across sidebar & header
            if (targetId) {
              fetchJobDetail(targetId).then((jData) => {
                if (selectedJobIdRef.current === targetId) {
                  setJob(jData);
                }
                setJobs((prev) => prev.map((j) => j.id === targetId ? { ...j, completed_chunks: jData.completed_chunks, status: jData.status } : j));
              }).catch(console.error);
            }
          }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Background backup polling interval to ensure progress never freezes even if SSE throttles
  useEffect(() => {
    const timer = setInterval(() => {
      if (currentJobIdRef.current) {
        refreshActiveJob();
      }
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    selectedJobIdRef.current = selectedJobId;
    currentJobIdRef.current = selectedJobId || null;
    if (selectedJobId) {
      const targetJob = jobsRef.current.find((candidate) => candidate.id === selectedJobId);
      if (targetJob && jobRef.current?.id !== selectedJobId) {
        setJob(targetJob);
      }
      const cached = segmentCacheRef.current.get(selectedJobId);
      if (cached) {
        setSegments(cached.segments);
        setSelectedSegIndex(Math.min(cached.selectedSegIndex, Math.max(0, cached.segments.length - 1)));
      }
      loadJobDetails(selectedJobId, { preserveCurrent: Boolean(cached) });
    } else {
      loadJobsList(true);
    }
  }, [selectedJobId]);

  useEffect(() => {
    setJumpInput(String(selectedSegIndex + 1));
  }, [selectedSegIndex]);

  const loadJobsList = async (selectFallback = false) => {
    const requestId = ++jobsRequestRef.current;
    try {
      const data = await fetchJobs();
      if (requestId === jobsRequestRef.current && Array.isArray(data)) {
        jobsRef.current = data;
        setJobs(data);
        const requestedId = selectedJobIdRef.current;
        if (data.length === 0) {
          setJob(null);
          setSegments([]);
          setLogs([]);
          if (onSelectJob) onSelectJob(null);
        } else if (selectFallback && (!requestedId || !data.some((candidate) => candidate.id === requestedId))) {
          if (onSelectJob) onSelectJob(data[0].id);
        }
      }
    } catch (e) {
      console.error('loadJobsList failed, retrying...', e);
      setTimeout(async () => {
        try {
          const data = await fetchJobs();
          if (requestId === jobsRequestRef.current && Array.isArray(data)) {
            jobsRef.current = data;
            setJobs(data);
            if (selectFallback && data.length > 0 && !data.some((candidate) => candidate.id === selectedJobIdRef.current)) {
              if (onSelectJob) onSelectJob(data[0].id);
            }
          }
        } catch (retryErr) {
          console.error('Retry loadJobsList failed:', retryErr);
        }
      }, 1200);
    }
  };

  const selectJobOptimistic = (targetJob) => {
    if (!targetJob) return;
    if (selectedJobIdRef.current === targetJob.id) return;
    detailsRequestRef.current += 1;
    selectedJobIdRef.current = targetJob.id;
    currentJobIdRef.current = targetJob.id;
    setJob(targetJob);
    const cached = segmentCacheRef.current.get(targetJob.id);
    if (cached) {
      setSegments(cached.segments);
      setSelectedSegIndex(Math.min(cached.selectedSegIndex, Math.max(0, cached.segments.length - 1)));
    } else {
      setSegments([]);
      setSelectedSegIndex(0);
    }
    setLogs([]);
    if (onSelectJob) onSelectJob(targetJob.id);
  };

  const loadJobDetails = async (id, { preserveCurrent = false } = {}) => {
    const requestId = ++detailsRequestRef.current;
    const isNewJob = jobRef.current?.id !== id;
    if (isNewJob && !preserveCurrent && !segmentCacheRef.current.has(id)) {
      setLogs([]);
      setSegments([]);
    }
    try {
      const [jData, sData] = await Promise.all([fetchJobDetail(id), fetchJobSegments(id)]);
      if (requestId !== detailsRequestRef.current || selectedJobIdRef.current !== id) return;
      jobRef.current = jData;
      setJob(jData);
      setSegments(sData);

      const cached = segmentCacheRef.current.get(id);
      const nextIndex = cached && !autoScrollRef.current
        ? Math.min(cached.selectedSegIndex, Math.max(0, sData.length - 1))
        : latestSegmentIndex(sData);
      setSelectedSegIndex(nextIndex);
      segmentCacheRef.current.set(id, { segments: sData, selectedSegIndex: nextIndex });

      // Restore past completed/failed segment events into logs on load/reload
      if (sData && sData.length > 0) {
        const pastEvents = sData
          .filter(s => s.status === 'DONE' || s.status === 'FAILED')
          .slice(-30)
          .reverse()
          .map(s => ({
            type: s.status === 'DONE' ? 'segment_completed' : 'segment_failed',
            job_id: id,
            chunk_index: s.chunk_index,
            timestamp: s.updated_at
          }));
        setLogs(pastEvents);
      } else {
        setLogs([]);
      }
    } catch (e) {
      console.error(e);
      if (selectedJobIdRef.current === id && jobsRef.current.length > 0 && !jobsRef.current.some((candidate) => candidate.id === id)) {
        if (onSelectJob) onSelectJob(jobsRef.current[0].id);
      }
    }
  };

  const refreshActiveJob = async (requestedId = null) => {
    const activeId = requestedId || selectedJobIdRef.current || currentJobIdRef.current;
    if (activeId) {
      try {
        const jData = await fetchJobDetail(activeId);
        if (selectedJobIdRef.current === activeId) {
          jobRef.current = jData;
          setJob(jData);
        }
        setJobs((prev) => prev.map((j) => j.id === activeId ? { ...j, completed_chunks: jData.completed_chunks, status: jData.status } : j));
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleStartResume = async () => {
    if (!job) return;
    const jobId = job.id;
    setJob((prev) => prev ? { ...prev, status: 'PROCESSING' } : null);
    try {
      await startJob(jobId, {
        endpoint: settings.endpoint,
        apiKey: settings.apiKey,
        apiType: settings.apiType,
        model: job.model || settings.model,
        concurrency: job.concurrency || settings.concurrency || 1,
        temperature: job.temperature !== undefined ? job.temperature : settings.temperature,
        enableProofreading: settings.enableProofreading,
        enablePromptCaching: settings.enablePromptCaching
      });
    } catch (err) {
      console.error(err);
    }
    await refreshActiveJob(jobId);
  };

  const handlePause = async () => {
    if (!job) return;
    const jobId = job.id;
    setJob((prev) => prev ? { ...prev, status: 'PAUSED' } : null);
    try {
      await pauseJob(jobId);
    } catch (err) {
      console.error(err);
    }
    await refreshActiveJob(jobId);
  };

  const handleRetryAndStart = async () => {
    if (!job) return;
    const jobId = job.id;
    setJob((prev) => prev ? { ...prev, status: 'PROCESSING' } : null);
    setSegments((prev) => prev.map((s) => s?.status === 'FAILED' ? { ...s, status: 'PENDING', error: null } : s));
    try {
      await retryJob(jobId);
      await startJob(jobId, {
        endpoint: settings.endpoint,
        apiKey: settings.apiKey,
        apiType: settings.apiType,
        model: job.model || settings.model,
        concurrency: job.concurrency || settings.concurrency || 1,
        temperature: job.temperature !== undefined ? job.temperature : settings.temperature,
        enableProofreading: settings.enableProofreading,
        enablePromptCaching: settings.enablePromptCaching
      });
    } catch (err) {
      console.error(err);
    }
    await refreshActiveJob(jobId);
  };

  const handleDeleteJob = async (e, jobId, fileName) => {
    if (e) e.stopPropagation();
    if (!window.confirm(l(lang, `Permanently delete “${fileName}”?`, `Supprimer définitivement « ${fileName} » ?`, `¿Eliminar “${fileName}” de forma permanente?`, `„${fileName}“ endgültig löschen?`))) return;
    
    try {
      await deleteJob(jobId);
    } catch (err) {
      console.error(err);
    }

    const remaining = jobs.filter((j) => j.id !== jobId);
    jobsRef.current = remaining;
    setJobs(remaining);
    segmentCacheRef.current.delete(jobId);

    if (remaining.length > 0) {
      const nextId = remaining[0].id;
      if (onSelectJob) onSelectJob(nextId);
    } else {
      setJob(null);
      setSegments([]);
      if (onSelectJob) onSelectJob(null);
    }
  };

  const handleDownload = async () => {
    if (!job || isDownloading) return;
    setIsDownloading(true);
    try {
      await downloadJob(job.id);
    } catch (err) {
      console.error(err);
      alert(err?.message || l(lang, 'Failed to rebuild or download the file.', 'Échec de la reconstruction ou du téléchargement du fichier.', 'No se ha podido reconstruir o descargar el archivo.', 'Die Datei konnte nicht neu erstellt oder heruntergeladen werden.'));
    } finally {
      setIsDownloading(false);
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
    if (!job || job.total_chunks === 0) return l(lang, 'Calculating speed…', 'Calcul de la vitesse…', 'Calculando la velocidad…', 'Geschwindigkeit wird berechnet…');
    const isProofread = job.job_type === 'proofreading';
    if (job.status === 'COMPLETED') return isProofread ? l(lang, 'Proofreading completed', 'Relecture terminée', 'Revisión completada', 'Korrekturlesen abgeschlossen') : l(lang, 'Translation completed', 'Traduction terminée', 'Traducción completada', 'Übersetzung abgeschlossen');
    if (job.status === 'PENDING') return isProofread ? l(lang, 'Waiting for proofreading…', 'En attente de relecture…', 'Esperando la revisión…', 'Warten auf Korrekturlesen…') : l(lang, 'Waiting to start…', 'En attente du lancement…', 'Esperando para iniciar…', 'Warten auf Start…');
    if (job.status === 'PAUSED') return l(lang, 'Paused', 'En pause', 'En pausa', 'Pausiert');
    if (job.completed_chunks === 0) return isProofread ? l(lang, 'Starting proofreading…', 'Démarrage de la relecture…', 'Iniciando la revisión…', 'Korrekturlesen wird gestartet…') : l(lang, 'Starting translation…', 'Démarrage de la traduction…', 'Iniciando la traducción…', 'Übersetzung wird gestartet…');

    const remaining = job.total_chunks - job.completed_chunks;
    if (remaining <= 0) return isProofread ? l(lang, 'Proofreading completed', 'Relecture terminée', 'Revisión completada', 'Korrekturlesen abgeschlossen') : l(lang, 'Translation completed', 'Traduction terminée', 'Traducción completada', 'Übersetzung abgeschlossen');

    const minHistory = 8;
    if (sessionStats.startTime && sessionStats.jobId === job.id && job.status === 'PROCESSING') {
      const completedInSession = job.completed_chunks - sessionStats.startCompletedCount;
      if (completedInSession < minHistory) {
        return l(lang,
          `Calculating remaining time (history ${completedInSession}/${minHistory})…`,
          `Calcul du temps restant (historique ${completedInSession}/${minHistory})…`,
          `Calculando el tiempo restante (historial ${completedInSession}/${minHistory})…`,
          `Restzeit wird berechnet (Verlauf ${completedInSession}/${minHistory})…`);
      }
    } else {
      return l(lang, 'Calculating remaining time…', 'Calcul du temps restant…', 'Calculando el tiempo restante…', 'Restzeit wird berechnet…');
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
  const overviewTitle = job?.file_name && job.file_name.length > 80 ? `${job.file_name.slice(0, 80)}…` : (job?.file_name || '');
  const sourceLanguageName = job?.source_lang ? languageLabel(job.source_lang, lang).replace(/\s*\([A-Z]+\)$/, '') : '';
  const targetLanguageName = job?.target_lang ? languageLabel(job.target_lang, lang).replace(/\s*\([A-Z]+\)$/, '') : '';
  const sourceTokenCount = currentSegment ? (currentSegment.tokens_est || estimateTokens(currentSegment.original_text)) : 0;
  const targetTokenCount = currentSegment?.translated_text ? estimateTokens(currentSegment.translated_text) : 0;
  const displayedSourceText = currentSegment ? (showRawSegments ? currentSegment.original_text : readableSegment(currentSegment.original_text)) : '';
  const displayedTargetText = currentSegment?.translated_text ? (showRawSegments ? currentSegment.translated_text : readableSegment(currentSegment.translated_text)) : '';
  const segmentStatusLabel = currentSegment?.status === 'DONE'
    ? (job?.job_type === 'proofreading' ? l(lang, 'Proofread', 'Relu', 'Revisado', 'Korrekturgelesen') : l(lang, 'Translated', 'Traduit', 'Traducido', 'Übersetzt'))
    : currentSegment?.status === 'FAILED'
      ? t('dashboard.failed', lang)
      : currentSegment?.status === 'PROCESSING'
        ? t('dashboard.processing', lang)
        : l(lang, 'Pending', 'En attente', 'Pendiente', 'Ausstehend');
  const activeJobCount = jobs.filter((item) => item.status === 'PROCESSING').length;
  const canExport = Boolean(job && (job.status === 'COMPLETED' || job.completed_chunks > 0));
  const isPartialExport = Boolean(job && job.status !== 'COMPLETED');
  const exportLabel = isPartialExport
    ? l(lang, 'Export preview', 'Exporter l’aperçu', 'Exportar vista previa', 'Vorschau exportieren')
    : l(lang, 'Export', 'Exporter', 'Exportar', 'Exportieren');

  useEffect(() => {
    if (!job?.id || !currentSegment) return;
    segmentCacheRef.current.set(job.id, { segments, selectedSegIndex });
    try {
      sessionStorage.setItem(INSPECTOR_SNAPSHOT_KEY, JSON.stringify({
        job,
        segment: currentSegment,
        selectedSegIndex,
        totalSegments: segments.length || job.total_chunks,
      }));
    } catch {
      // A snapshot is only a visual optimization; live API data remains authoritative.
    }
  }, [job, currentSegment, segments, selectedSegIndex]);

  useEffect(() => {
    if (!isEditingConfig) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsEditingConfig(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isEditingConfig]);

  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [projectQuery, setProjectQuery] = useState('');
  const switcherRef = useRef(null);
  const switcherListRef = useRef(null);

  useEffect(() => {
    if (!switcherOpen) return undefined;
    const closeOutside = (event) => {
      if (switcherRef.current && !switcherRef.current.contains(event.target)) setSwitcherOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setSwitcherOpen(false);
    };
    document.addEventListener('mousedown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [switcherOpen]);

  const currentJobIndex = jobs.findIndex((item) => item.id === job?.id);
  const filteredJobs = jobs.filter((item) => item.file_name.toLowerCase().includes(projectQuery.trim().toLowerCase()));
  const jobPercent = (item) => (item.total_chunks > 0 ? Math.round((item.completed_chunks / item.total_chunks) * 100) : 0);
  const pickJob = (item) => {
    selectJobOptimistic(item);
    setSwitcherOpen(false);
    setProjectQuery('');
  };
  const moveFocusInList = (event) => {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    const options = Array.from(switcherListRef.current?.querySelectorAll('button') || []);
    if (options.length === 0) return;
    const index = options.indexOf(document.activeElement);
    const next = event.key === 'ArrowDown' ? Math.min(options.length - 1, index + 1) : Math.max(0, index - 1);
    options[index === -1 ? 0 : next].focus();
  };

  const jobStatusLabel = (status) => (
    status === 'PROCESSING' ? t('dashboard.processing', lang)
      : status === 'COMPLETED' ? t('dashboard.completed', lang)
        : status === 'FAILED' ? t('dashboard.failed', lang)
          : status === 'PENDING' ? l(lang, 'Pending', 'En attente', 'Pendiente', 'Ausstehend')
            : t('dashboard.paused', lang)
  );
  const statusClass = (status) => (
    status === 'COMPLETED' || status === 'DONE' ? 'is-done'
      : status === 'PROCESSING' ? 'is-running'
        : status === 'FAILED' ? 'is-failed' : ''
  );
  const progressPercent = job ? Math.round((job.completed_chunks / (job.total_chunks || 1)) * 100) : 0;
  const isProcessing = job?.status === 'PROCESSING';
  const temperatureLabel = job && job.temperature !== undefined && job.temperature !== null
    ? Number(job.temperature).toFixed(2)
    : (settings?.temperature !== undefined ? Number(settings.temperature).toFixed(2) : '—');

  return (
    <div className="page">
      <h1 className="sr-only">{l(lang, 'Inspect and review', 'Inspection et révision', 'Inspección y revisión', 'Prüfen und überarbeiten')}</h1>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 max-sm:basis-full">
          <button
            type="button"
            className="icon-btn"
            disabled={currentJobIndex <= 0}
            onClick={() => pickJob(jobs[currentJobIndex - 1])}
            aria-label={l(lang, 'Previous project', 'Projet précédent', 'Proyecto anterior', 'Vorheriges Projekt')}
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <div ref={switcherRef} className="relative min-w-0 flex-1 sm:max-w-[460px]">
            <button
              type="button"
              aria-expanded={switcherOpen}
              onClick={() => setSwitcherOpen(!switcherOpen)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  setSwitcherOpen(true);
                }
              }}
              className="flex h-11 w-full min-w-0 items-center gap-2.5 rounded-full border border-line bg-card pl-4 pr-3 text-left hover:bg-well"
            >
              <span className="sr-only">{l(lang, 'Current project', 'Projet en cours', 'Proyecto actual', 'Aktuelles Projekt')}:</span>
              <span className="min-w-0 flex-1 truncate font-semibold">{job?.file_name || t('inspector.projectsList', lang)}</span>
              {job && <span className="text-[13px] tabular-nums text-sec">{jobPercent(job)} %</span>}
              <ChevronDown className={`size-4 flex-none text-sec transition-transform ${switcherOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>

            {switcherOpen && (
              <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-2xl border border-line bg-card sm:min-w-[380px]" onKeyDown={moveFocusInList}>
                {jobs.length > 5 && (
                  <label className="flex items-center gap-2 border-b border-line px-3.5">
                    <Search className="size-4 flex-none text-sec" aria-hidden="true" />
                    <input
                      autoFocus
                      type="search"
                      value={projectQuery}
                      onChange={(event) => setProjectQuery(event.target.value)}
                      placeholder={l(lang, 'Search projects', 'Rechercher un projet', 'Buscar un proyecto', 'Projekt suchen')}
                      aria-label={l(lang, 'Search projects', 'Rechercher un projet', 'Buscar un proyecto', 'Projekt suchen')}
                      className="h-11 min-w-0 flex-1 border-0 bg-transparent outline-none"
                    />
                  </label>
                )}
                <ul ref={switcherListRef} aria-label={t('inspector.projectsList', lang)} className="m-0 max-h-[min(60vh,360px)] list-none overflow-y-auto p-1.5">
                  {filteredJobs.length === 0 ? (
                    <li className="px-3 py-4 text-center text-[13px] text-sec">{l(lang, 'No matching project', 'Aucun projet correspondant', 'Ningún proyecto coincide', 'Kein passendes Projekt')}</li>
                  ) : filteredJobs.map((item) => {
                    const isSelected = job?.id === item.id;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          autoFocus={jobs.length <= 5 && isSelected}
                          aria-current={isSelected ? 'true' : undefined}
                          onClick={() => pickJob(item)}
                          className={`flex w-full items-center gap-3 rounded-xl border-0 px-3 py-2.5 text-left hover:bg-well focus-visible:bg-well ${isSelected ? 'bg-[var(--accent-soft)]' : 'bg-transparent'}`}
                        >
                          <span className="tag flex-none max-sm:hidden">{item.file_type?.toUpperCase()}</span>
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="line-clamp-2 break-words font-medium">{item.file_name}</span>
                            <span className={`status ${statusClass(item.status)}`}>{jobStatusLabel(item.status)}</span>
                          </span>
                          <span className="flex-none text-[13px] font-medium tabular-nums text-sec">{jobPercent(item)} %</span>
                          {isSelected && <Check className="size-4 flex-none text-accent-text" aria-hidden="true" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
          <button
            type="button"
            className="icon-btn"
            disabled={currentJobIndex === -1 || currentJobIndex >= jobs.length - 1}
            onClick={() => pickJob(jobs[currentJobIndex + 1])}
            aria-label={l(lang, 'Next project', 'Projet suivant', 'Proyecto siguiente', 'Nächstes Projekt')}
          >
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
        <span className="text-[13px] text-sec" title={l(lang, 'Projects currently running', 'Projets actuellement en cours', 'Proyectos actualmente en curso', 'Derzeit laufende Projekte')}>
          {currentJobIndex >= 0 ? `${currentJobIndex + 1} / ${jobs.length}` : jobs.length} · {activeJobCount} {l(lang, 'running', 'en cours', 'en curso', 'laufend')}
        </span>
      </div>

      {job ? (
        <>
          <section aria-labelledby="project-title" className="card">
            <div className="flex flex-wrap items-start justify-between gap-4 px-6 pb-[18px] pt-[22px]">
              <div className="flex min-w-0 flex-col gap-1">
                <h2 id="project-title" className="m-0 break-words text-[24px] font-semibold tracking-[-0.03em]" title={job.file_name}>{overviewTitle}</h2>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-sec">
                  <span>{job.file_type.toUpperCase()}</span>
                  <span>{job.job_type === 'proofreading' ? t('inspector.modeProofread', lang) : t('inspector.modeTranslation', lang)}</span>
                  <span>{job.model}</span>
                  <span>{sourceLanguageName} → {targetLanguageName}</span>
                  {failedCount > 0 && (
                    <span className="font-semibold text-fg">
                      {failedCount} {l(lang, failedCount === 1 ? 'failure' : 'failures', failedCount > 1 ? 'échecs' : 'échec', failedCount === 1 ? 'fallo' : 'fallos', 'Fehler')}
                    </span>
                  )}
                  <button type="button" className="btn btn-link text-[13px]" aria-expanded={showDetails} onClick={() => setShowDetails(!showDetails)}>
                    {showDetails ? l(lang, 'Show less', 'Réduire', 'Ver menos', 'Weniger anzeigen') : l(lang, 'Show more', 'Voir plus', 'Ver más', 'Mehr anzeigen')}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isProcessing ? (
                  <button type="button" onClick={handlePause} className="btn btn-primary"><Pause aria-hidden="true" />{t('dashboard.pause', lang)}</button>
                ) : (
                  <button type="button" onClick={handleStartResume} className="btn btn-primary"><Play aria-hidden="true" />{job.completed_chunks > 0 ? t('dashboard.resume', lang) : l(lang, 'Start', 'Démarrer', 'Iniciar', 'Starten')}</button>
                )}
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={isDownloading || !canExport}
                  className="btn btn-secondary"
                  title={isPartialExport
                    ? l(lang, 'Download a snapshot with completed segments', 'Télécharger un instantané avec les segments terminés', 'Descargar una instantánea con los segmentos completados', 'Momentaufnahme mit abgeschlossenen Segmenten herunterladen')
                    : l(lang, 'Download final translation', 'Télécharger la traduction finale', 'Descargar la traducción final', 'Endgültige Übersetzung herunterladen')}
                >
                  {isDownloading ? <RefreshCw className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
                  {isDownloading ? l(lang, 'Preparing', 'Préparation', 'Preparando', 'Wird vorbereitet') : exportLabel}
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-haspopup="dialog"
                  onClick={() => setIsEditingConfig(true)}
                  aria-label={l(lang, 'Project settings', 'Configuration du projet', 'Configuración del proyecto', 'Projekteinstellungen')}
                >
                  <Sliders aria-hidden="true" />
                </button>
              </div>
            </div>

            {showDetails && (
              <dl className="mx-6 mb-[18px] mt-0 grid grid-cols-[repeat(auto-fit,minmax(min(100%,160px),1fr))] gap-px overflow-hidden rounded-[14px] border border-line bg-line">
                {[
                  ['ID', job.id],
                  [l(lang, 'Glossary', 'Glossaire', 'Glosario', 'Glossar'), job.glossary_name || l(lang, 'None', 'Aucun', 'Ninguno', 'Keines')],
                  [l(lang, 'Segment size', 'Taille du segment', 'Tamaño del segmento', 'Segmentgröße'), `${(job.chunk_size || 1000).toLocaleString(localeTag(lang))} tokens`],
                  [l(lang, 'Temperature', 'Température', 'Temperatura', 'Temperatur'), temperatureLabel],
                  [t('dashboard.concurrency', lang), job.concurrency || settings?.concurrency || 1],
                  [l(lang, 'Imported', 'Importé le', 'Importado', 'Importiert'), new Date(job.created_at).toLocaleString(localeTag(lang))],
                ].map(([label, value]) => (
                  <div key={label} className="min-w-0 bg-toolbar px-3.5 py-3">
                    <dt className="text-[12px] text-sec">{label}</dt>
                    <dd className="m-0 mt-0.5 break-all font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
            )}

            <div className="flex flex-col gap-2.5 px-6 pb-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <span className="flex flex-wrap items-baseline gap-x-3">
                  <span className={`status !text-[14px] ${statusClass(job.status)}`}>{jobStatusLabel(job.status)}</span>
                  {isProcessing && <span className="text-[12px] text-sec">{calculateETA()}</span>}
                </span>
                <span className="tabular-nums">
                  <strong className="text-[20px] font-semibold tracking-[-0.02em]">{progressPercent}%</strong>
                  <span className="text-sec"> · {job.completed_chunks} / {job.total_chunks}</span>
                </span>
              </div>
              <div className={`progress ${job.status === 'COMPLETED' ? 'is-done' : ''}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent} aria-label={l(lang, 'Progress', 'Progression', 'Progreso', 'Fortschritt')}>
                <span style={{ width: `${progressPercent}%` }} />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1 border-t border-line px-3.5 py-2.5">
              <button type="button" className="btn btn-ghost btn-sm" onClick={handleRetryAndStart} title={l(lang, 'Reset failed segments and retry', 'Réinitialiser les segments en échec et relancer', 'Restablecer los segmentos fallidos y reintentar', 'Fehlgeschlagene Segmente zurücksetzen und erneut versuchen')}>
                <RefreshCw aria-hidden="true" />{l(lang, 'Retry failed segments', 'Relancer les segments en échec', 'Reintentar segmentos fallidos', 'Fehlgeschlagene Segmente wiederholen')}
              </button>
              <span className="flex-1" />
              <button type="button" className="btn btn-ghost btn-sm text-sec" onClick={(event) => handleDeleteJob(event, job.id, job.file_name)}>
                <Trash2 aria-hidden="true" />{l(lang, 'Delete project', 'Supprimer le projet', 'Eliminar proyecto', 'Projekt löschen')}
              </button>
            </div>
          </section>

          <section aria-labelledby="segments-title" className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-line py-3 pl-6 pr-3.5">
              <h2 id="segments-title" className="section-title">{t('inspector.title', lang)}</h2>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className="switch-row" role="switch" aria-checked={showRawSegments} onClick={() => setShowRawSegments(!showRawSegments)}>
                  {l(lang, 'Raw text', 'Texte brut', 'Texto sin formato', 'Rohtext')}
                  <span className="switch" aria-checked={showRawSegments} aria-hidden="true" />
                </button>
                {!autoScroll && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleResync}>
                    {l(lang, 'Resync', 'Resynchroniser', 'Resincronizar', 'Neu synchronisieren')}
                  </button>
                )}
                <div className="seg items-center">
                  <button
                    type="button"
                    className="!grid !size-[30px] place-items-center !p-0"
                    disabled={selectedSegIndex <= 0}
                    onClick={() => { setSelectedSegIndex((prev) => Math.max(0, prev - 1)); setAutoScroll(false); }}
                    aria-label={l(lang, 'Previous segment', 'Segment précédent', 'Segmento anterior', 'Vorheriges Segment')}
                  >
                    <ChevronLeft className="size-4" aria-hidden="true" />
                  </button>
                  <form onSubmit={handleJumpSubmit} className="flex items-center gap-1 px-1 text-[13px] font-medium tabular-nums">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={jumpInput}
                      onChange={(event) => setJumpInput(event.target.value)}
                      aria-label={l(lang, 'Segment number', 'Numéro du segment', 'Número de segmento', 'Segmentnummer')}
                      className="w-9 rounded-md border-0 bg-transparent text-center outline-none focus-visible:bg-card"
                    />
                    <span className="text-sec">/ {segments.length}</span>
                  </form>
                  <button
                    type="button"
                    className="!grid !size-[30px] place-items-center !p-0"
                    disabled={selectedSegIndex >= segments.length - 1}
                    onClick={() => { setSelectedSegIndex((prev) => Math.min(segments.length - 1, prev + 1)); setAutoScroll(false); }}
                    aria-label={l(lang, 'Next segment', 'Segment suivant', 'Segmento siguiente', 'Nächstes Segment')}
                  >
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>

            {currentSegment ? (
              <div className="pane-grid">
                <section className="pane" aria-label={l(lang, 'Source text', 'Texte source', 'Texto de origen', 'Ausgangstext')}>
                  <div className="pane-head">
                    <span><strong className="font-medium text-fg">{sourceLanguageName}</strong> · {job.source_lang.toUpperCase()}</span>
                    <span>{sourceTokenCount.toLocaleString(localeTag(lang))} {l(lang, 'tokens sent', 'tokens envoyés', 'tokens enviados', 'gesendete Tokens')}</span>
                  </div>
                  <div className="pane-text">{displayedSourceText}</div>
                  <div className="pane-foot">{displayedSourceText.length.toLocaleString(localeTag(lang))} {l(lang, 'characters', 'caractères', 'caracteres', 'Zeichen')}</div>
                </section>
                <section className="pane" aria-label={job.job_type === 'proofreading' ? l(lang, 'Proofread text', 'Texte relu', 'Texto revisado', 'Korrekturgelesener Text') : l(lang, 'Translation', 'Traduction', 'Traducción', 'Übersetzung')}>
                  <div className="pane-head">
                    <span className="flex flex-wrap items-center gap-2.5">
                      <span><strong className="font-medium text-fg">{targetLanguageName}</strong> · {job.target_lang.toUpperCase()}</span>
                      <span className={`status ${statusClass(currentSegment.status)}`} aria-live="polite">{segmentStatusLabel}</span>
                    </span>
                    <span className="flex items-center gap-2.5">
                      {targetTokenCount.toLocaleString(localeTag(lang))} {l(lang, 'tokens received', 'tokens reçus', 'tokens recibidos', 'empfangene Tokens')}
                      {currentSegment.translated_text && (
                        <button type="button" className="btn btn-secondary !h-7 !px-2.5 !text-[12px]" onClick={() => handleCopyText(currentSegment.translated_text)}>
                          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                          {copied ? t('inspector.copied', lang) : t('inspector.copyText', lang)}
                        </button>
                      )}
                    </span>
                  </div>
                  <div className={`pane-text ${currentSegment.translated_text ? '' : 'is-empty'}`}>
                    {currentSegment.translated_text
                      ? displayedTargetText
                      : (job.job_type === 'proofreading'
                        ? l(lang, 'Waiting for proofreading…', 'En attente de relecture…', 'Esperando la revisión…', 'Warten auf Korrekturlesen…')
                        : l(lang, 'Waiting for translation…', 'En attente de traduction…', 'Esperando la traducción…', 'Warten auf Übersetzung…'))}
                  </div>
                  <div className="pane-foot">{displayedTargetText.length.toLocaleString(localeTag(lang))} {l(lang, 'characters', 'caractères', 'caracteres', 'Zeichen')}</div>
                </section>
              </div>
            ) : (
              <div className="px-6 py-10 text-center text-[13px] text-sec">{l(lang, 'Loading…', 'Chargement…', 'Cargando…', 'Wird geladen…')}</div>
            )}
          </section>

          <section aria-labelledby="events-title" className="card">
            <div className="flex items-center justify-between py-2.5 pl-6 pr-3.5">
              <h2 id="events-title" className="section-title">{t('inspector.liveSseLogs', lang)} <span className="font-normal text-sec">{logs.length}</span></h2>
              <button type="button" className="btn btn-link px-3" aria-expanded={showConsole} onClick={() => setShowConsole(!showConsole)}>
                {showConsole ? l(lang, 'Hide', 'Masquer', 'Ocultar', 'Ausblenden') : l(lang, 'Show', 'Afficher', 'Mostrar', 'Anzeigen')}
              </button>
            </div>
            {showConsole && (
              <div className="well mx-3.5 mb-3.5 max-h-44 overflow-y-auto px-4 py-3.5 text-[13px] text-sec">
                {logs.length === 0 ? (
                  l(lang, 'Waiting for events…', 'En attente d’événements…', 'Esperando eventos…', 'Warten auf Ereignisse…')
                ) : (
                  <ul className="m-0 flex list-none flex-col gap-1 p-0">
                    {logs.map((log, index) => (
                      <li key={index} className="flex gap-3">
                        <span className="tabular-nums text-ter">{log.timestamp?.slice(11, 19)}</span>
                        <span className={log.type === 'segment_failed' ? 'font-semibold text-fg' : ''}>
                          {l(lang, 'Segment', 'Segment', 'Segmento', 'Segment')} {Number(log.chunk_index) + 1} — {log.type === 'segment_completed' ? l(lang, 'generated successfully.', 'généré avec succès.', 'generado correctamente.', 'erfolgreich erstellt.') : (log.error || t('dashboard.failed', lang))}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>

          {isEditingConfig && (
            <div className="sheet-scrim" onClick={(event) => { if (event.target === event.currentTarget) setIsEditingConfig(false); }}>
              <form role="dialog" aria-modal="true" aria-labelledby="project-settings-title" onSubmit={handleSaveJobConfig} className="sheet">
                <div className="flex items-center justify-between">
                  <h2 id="project-settings-title" className="m-0 text-[18px] font-semibold tracking-[-0.02em]">{l(lang, 'Project settings', 'Configuration du projet', 'Configuración del proyecto', 'Projekteinstellungen')}</h2>
                  <button type="button" className="icon-btn border-0 bg-well" onClick={() => setIsEditingConfig(false)} aria-label={l(lang, 'Close settings', 'Fermer la configuration', 'Cerrar configuración', 'Einstellungen schließen')}>
                    <X aria-hidden="true" />
                  </button>
                </div>
                {isProcessing && (
                  <p className="notice m-0">{l(lang, 'Pause the project to edit its settings.', 'Mettez le projet en pause pour modifier sa configuration.', 'Pausa el proyecto para editar su configuración.', 'Pausiere das Projekt, um seine Einstellungen zu bearbeiten.')}</p>
                )}
                <fieldset disabled={isProcessing} className="m-0 flex flex-col gap-[18px] border-0 p-0">
                  <label className="field">
                    <span className="field-label">{t('dashboard.llmModel', lang)}</span>
                    <select className="input" value={editModel} onChange={(event) => setEditModel(event.target.value)}>
                      {availableModels.length > 0
                        ? availableModels.map((model) => <option key={model} value={model}>{model}</option>)
                        : <option value={editModel}>{editModel}</option>}
                    </select>
                  </label>
                  <label className="field">
                    <span className="field-label">{t('dashboard.concurrency', lang)}</span>
                    <input className="input" type="number" min="1" max="16" value={editConcurrency} onChange={(event) => setEditConcurrency(parseInt(event.target.value, 10) || 1)} />
                  </label>
                  <label className="field">
                    <span className="field-label">{l(lang, 'Temperature', 'Température', 'Temperatura', 'Temperatur')}<strong className="font-semibold tabular-nums text-fg">{Number(editTemperature).toFixed(2)}</strong></span>
                    <input type="range" min="0" max="1" step="0.05" value={editTemperature} onChange={(event) => setEditTemperature(parseFloat(event.target.value))} />
                  </label>
                  <div className="well flex justify-between px-3.5 py-3 text-[13px]">
                    <span className="text-sec">{l(lang, 'Segment size', 'Taille du segment', 'Tamaño del segmento', 'Segmentgröße')}</span>
                    <span className="font-medium">{(job.chunk_size || 1000).toLocaleString(localeTag(lang))} tokens</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-link self-start"
                    onClick={() => {
                      if (settings?.model) setEditModel(settings.model);
                      if (settings?.concurrency) setEditConcurrency(settings.concurrency);
                      if (settings?.temperature !== undefined) setEditTemperature(settings.temperature);
                    }}
                  >
                    {l(lang, 'Use current values', 'Utiliser les valeurs actuelles', 'Usar valores actuales', 'Aktuelle Werte verwenden')}
                  </button>
                </fieldset>
                <div className="mt-auto flex justify-end gap-2">
                  <button type="button" className="btn btn-secondary btn-lg" onClick={() => setIsEditingConfig(false)}>{l(lang, 'Cancel', 'Annuler', 'Cancelar', 'Abbrechen')}</button>
                  <button type="submit" className="btn btn-primary btn-lg" disabled={savingConfig || isProcessing}>
                    {savingConfig ? l(lang, 'Saving…', 'Enregistrement…', 'Guardando…', 'Wird gespeichert…') : l(lang, 'Save', 'Enregistrer', 'Guardar', 'Speichern')}
                  </button>
                </div>
              </form>
            </div>
          )}
        </>
      ) : (
        <div className="card px-6 py-12 text-center text-[13px] text-sec">{t('inspector.selectProjectPrompt', lang)}</div>
      )}
    </div>
  );
}
