import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RefreshCw, Download, FileText, CheckCircle2, AlertTriangle, Terminal, ChevronRight, ChevronLeft, Clock, Copy, Check, Trash2, ArrowRight, Sparkles, Sliders } from 'lucide-react';
import { fetchJobs, fetchJobDetail, fetchJobSegments, startJob, pauseJob, retryJob, deleteJob, updateJobConfig, downloadJob, subscribeToEvents } from '../api';
import { AVAILABLE_LANGUAGES, t } from '../i18n/translations';

const readableSegment = (text = '') => text
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/[ \t]{2,}/g, ' ')
  .replace(/\n\s+/g, '\n')
  .trim();

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
    if (!window.confirm(`Supprimer définitivement le projet "${fileName}" ?`)) return;
    
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
      alert(err?.message || (lang === 'fr' ? 'Échec de la reconstruction ou du téléchargement.' : 'Failed to rebuild or download file.'));
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
    if (!job || job.total_chunks === 0) return lang === 'fr' ? 'Calcul de la vitesse...' : 'Calculating speed...';
    const isProofread = job.job_type === 'proofreading';
    if (job.status === 'COMPLETED') return isProofread ? (lang === 'fr' ? 'Relecture terminée' : 'Proofreading completed') : (lang === 'fr' ? 'Traduction terminée' : 'Translation completed');
    if (job.status === 'PENDING') return isProofread ? (lang === 'fr' ? 'En attente de relecture...' : 'Waiting for proofreading...') : (lang === 'fr' ? 'En attente du lancement...' : 'Waiting to start...');
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
  const overviewTitle = job?.file_name && job.file_name.length > 80 ? `${job.file_name.slice(0, 80)}…` : (job?.file_name || '');
  const sourceLanguage = AVAILABLE_LANGUAGES.find((item) => item.code === job?.source_lang);
  const targetLanguage = AVAILABLE_LANGUAGES.find((item) => item.code === job?.target_lang);
  const sourceLanguageName = sourceLanguage ? (lang === 'fr' ? sourceLanguage.label : sourceLanguage.labelEn).replace(/\s*\([A-Z]+\)$/, '') : job?.source_lang?.toUpperCase();
  const targetLanguageName = targetLanguage ? (lang === 'fr' ? targetLanguage.label : targetLanguage.labelEn).replace(/\s*\([A-Z]+\)$/, '') : job?.target_lang?.toUpperCase();
  const sourceTokenCount = currentSegment ? (currentSegment.tokens_est || estimateTokens(currentSegment.original_text)) : 0;
  const targetTokenCount = currentSegment?.translated_text ? estimateTokens(currentSegment.translated_text) : 0;
  const displayedSourceText = currentSegment ? (showRawSegments ? currentSegment.original_text : readableSegment(currentSegment.original_text)) : '';
  const displayedTargetText = currentSegment?.translated_text ? (showRawSegments ? currentSegment.translated_text : readableSegment(currentSegment.translated_text)) : '';
  const segmentStatusLabel = currentSegment?.status === 'DONE'
    ? (job?.job_type === 'proofreading' ? (lang === 'fr' ? 'Relu' : 'Proofread') : (lang === 'fr' ? 'Traduit' : 'Translated'))
    : currentSegment?.status === 'FAILED'
      ? t('dashboard.failed', lang)
      : currentSegment?.status === 'PROCESSING'
        ? t('dashboard.processing', lang)
        : (lang === 'fr' ? 'En attente' : 'Pending');
  const activeJobCount = jobs.filter((item) => item.status === 'PROCESSING').length;
  const canExport = Boolean(job && (job.status === 'COMPLETED' || job.completed_chunks > 0));
  const isPartialExport = Boolean(job && job.status !== 'COMPLETED');
  const exportLabel = isPartialExport
    ? (lang === 'fr' ? 'Exporter l’aperçu' : 'Export preview')
    : (lang === 'fr' ? 'Exporter' : 'Export');

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

  return (
    <div className="inspector-page space-y-6">

      <header className="page-intro page-intro-with-status">
        <div>
          <p className="page-kicker">{lang === 'fr' ? 'Atelier éditorial' : 'Editorial workspace'}</p>
          <h1>{lang === 'fr' ? 'Inspection et révision' : 'Inspect and review'}</h1>
          <p>{lang === 'fr' ? 'Comparez les segments, contrôlez la progression et préparez une traduction prête à publier.' : 'Compare segments, monitor progress, and prepare a translation ready to publish.'}</p>
        </div>
        <div
          className="connection-pill active-jobs-pill"
          title={lang === 'fr' ? 'Projets actuellement en cours de traduction' : 'Projects currently translating'}
        >
          <span />
          {activeJobCount} {lang === 'fr'
            ? (activeJobCount > 1 ? 'projets en cours' : 'projet en cours')
            : (activeJobCount === 1 ? 'project running' : 'projects running')}
        </div>
      </header>
      
      {/* Upper Grid Layout: Books List (1 col) + Inspector Details (3 cols) */}
      <div className="inspector-layout space-y-5">
        
        {/* Sidebar List (1 col) */}
        <div className="project-switcher card-chill p-4 space-y-3 rounded-2xl">
          <h2 className="text-[10px] font-semibold text-[#888] uppercase tracking-wider px-2">{t('inspector.projectsList', lang)} ({jobs.length})</h2>
          <div className="project-switcher-list flex gap-2 overflow-x-auto pb-1">
            {jobs.map((j) => {
              const percent = j.total_chunks > 0 ? Math.round((j.completed_chunks / j.total_chunks) * 100) : 0;
              const isSelected = job?.id === j.id;
              const truncatedName = j.file_name.length > 16 ? j.file_name.slice(0, 16) + '...' : j.file_name;

              return (
                <div
                  key={j.id}
                  onClick={() => selectJobOptimistic(j)}
                  className={`project-switcher-item group p-3.5 rounded-xl cursor-pointer transition-all duration-150 flex items-center justify-between border ${
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
        <div className="inspector-content space-y-5">
          
          {job ? (
            <>
              <section className="project-overview">
                <div className="project-overview-main">
                  <div className="project-identity">
                    <div className="project-title-line">
                      <h2 title={job.file_name}>{overviewTitle}</h2>
                    </div>
                    <div className="project-subline">
                      <span>{job.file_type.toUpperCase()}</span>
                      <span>{job.job_type === 'proofreading' ? t('inspector.modeProofread', lang) : t('inspector.modeTranslation', lang)}</span>
                      <span>{job.model}</span>
                      <span>{job.source_lang.toUpperCase()} <ArrowRight /> {job.target_lang.toUpperCase()}</span>
                      {showDetails && <>
                        <span>ID {job.id}</span>
                        <span>{lang === 'fr' ? 'Glossaire' : 'Glossary'}: {job.glossary_name || (lang === 'fr' ? 'Aucun' : 'None')}</span>
                        <span>{job.chunk_size || 1000} tokens</span>
                        <span>{new Date(job.created_at).toLocaleDateString()}</span>
                      </>}
                      <button type="button" className="project-more" onClick={() => setShowDetails(!showDetails)}>{showDetails ? (lang === 'fr' ? 'Réduire' : 'Show less') : (lang === 'fr' ? 'Voir plus' : 'Show more')}</button>
                    </div>
                  </div>

                  <div className="overview-actions">
                    {job.status === 'PROCESSING' ? (
                      <button type="button" onClick={handlePause} className="primary-action"><Pause />{t('dashboard.pause', lang)}</button>
                    ) : (
                      <button type="button" onClick={handleStartResume} className="primary-action"><Play />{job.completed_chunks > 0 ? t('dashboard.resume', lang) : (lang === 'fr' ? 'Démarrer' : 'Start')}</button>
                    )}
                    <button
                      type="button"
                      onClick={handleDownload}
                      disabled={isDownloading || !canExport}
                      className="secondary-action"
                      title={isPartialExport
                        ? (lang === 'fr' ? 'Télécharger un instantané avec les segments déjà traduits' : 'Download a snapshot with completed translations')
                        : (lang === 'fr' ? 'Télécharger la traduction finale' : 'Download final translation')}
                    >
                      {isDownloading ? <RefreshCw className="animate-spin" /> : <Download />}{isDownloading ? (lang === 'fr' ? 'Préparation' : 'Preparing') : exportLabel}
                    </button>
                    <button type="button" onClick={() => setIsEditingConfig(!isEditingConfig)} className={`icon-action ${isEditingConfig ? 'is-active' : ''}`} title={lang === 'fr' ? 'Configuration' : 'Settings'}><Sliders /></button>
                  </div>
                </div>

                <div className="overview-progress">
                  <div className="progress-copy">
                    <span className={`status-dot status-${String(job.status).toLowerCase()}`} />
                    <strong>{job.status === 'PROCESSING' ? t('dashboard.processing', lang) : job.status === 'COMPLETED' ? t('dashboard.completed', lang) : job.status === 'FAILED' ? t('dashboard.failed', lang) : t('dashboard.paused', lang)}</strong>
                    {job.status === 'PROCESSING' && <span>{calculateETA()}</span>}
                  </div>
                  <div className="progress-value"><strong>{Math.round((job.completed_chunks / (job.total_chunks || 1)) * 100)}%</strong><span>{job.completed_chunks} / {job.total_chunks}</span></div>
                  <div className="progress-track"><span style={{ width: `${(job.completed_chunks / (job.total_chunks || 1)) * 100}%` }} /></div>
                </div>

                <div className="overview-more-actions">
                  <button type="button" onClick={handleRetryAndStart}><RefreshCw />{lang === 'fr' ? 'Relancer les échecs' : 'Retry failed'}</button>
                  <button type="button" onClick={(e) => handleDeleteJob(e, job.id, job.file_name)} className="danger-link"><Trash2 />{lang === 'fr' ? 'Supprimer le projet' : 'Delete project'}</button>
                </div>
              </section>

              {isEditingConfig && job.status !== 'PROCESSING' && (
                <form onSubmit={handleSaveJobConfig} className="project-config-card">
                  <div className="project-config-card-heading">
                    <strong>{lang === 'fr' ? 'Configuration du projet' : 'Project configuration'}</strong>
                    <button
                      type="button"
                      className="project-config-global"
                      onClick={() => {
                        if (settings?.model) setEditModel(settings.model);
                        if (settings?.concurrency) setEditConcurrency(settings.concurrency);
                        if (settings?.temperature !== undefined) setEditTemperature(settings.temperature);
                      }}
                    >
                      {lang === 'fr' ? 'Utiliser les valeurs actuelles' : 'Use current values'}
                    </button>
                  </div>

                  <div className="project-config-card-fields">
                    <label>
                      <span>{t('dashboard.llmModel', lang)}</span>
                      <select value={editModel} onChange={(e) => setEditModel(e.target.value)}>
                        {availableModels.length > 0
                          ? availableModels.map((model) => <option key={model} value={model}>{model}</option>)
                          : <option value={editModel}>{editModel}</option>}
                      </select>
                    </label>
                    <label>
                      <span>{t('dashboard.concurrency', lang)}</span>
                      <input type="number" min="1" max="16" value={editConcurrency} onChange={(e) => setEditConcurrency(parseInt(e.target.value, 10) || 1)} />
                    </label>
                    <label>
                      <span>{lang === 'fr' ? 'Température' : 'Temperature'} <b>{Number(editTemperature).toFixed(2)}</b></span>
                      <div className="project-temperature-control">
                        <input type="range" min="0" max="1" step="0.05" value={editTemperature} onChange={(e) => setEditTemperature(parseFloat(e.target.value))} />
                      </div>
                    </label>
                    <div className="project-config-card-actions">
                      <button type="button" onClick={() => setIsEditingConfig(false)}>{lang === 'fr' ? 'Fermer' : 'Close'}</button>
                      <button type="submit" disabled={savingConfig} className="primary-action">
                        {savingConfig ? (lang === 'fr' ? 'Enregistrement…' : 'Saving…') : (lang === 'fr' ? 'Enregistrer' : 'Save')}
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Header & Controls */}
              <div className="job-command-bar legacy-project-panel hidden p-6 space-y-4 rounded-2xl">
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
                  <form onSubmit={handleSaveJobConfig} className="project-config-panel p-5 space-y-5 mt-2">
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
                <div className="project-actions flex items-center gap-2 flex-wrap pt-3 border-t border-white/[0.08]">
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

                  <button
                    onClick={handleDownload}
                    disabled={isDownloading || !canExport}
                    title={isPartialExport
                      ? (lang === 'fr' ? 'Télécharger un instantané avec les segments déjà traduits' : 'Download a snapshot with completed translations')
                      : (lang === 'fr' ? 'Télécharger la traduction finale' : 'Download final translation')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium inline-flex items-center space-x-1.5 transition-all border ${
                      isDownloading
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/30 cursor-wait'
                        : canExport
                        ? 'bg-white/[0.04] text-white border-white/[0.12] hover:bg-white/[0.08] cursor-pointer'
                        : 'bg-white/[0.02] text-zinc-500 border-white/[0.08] opacity-50 cursor-not-allowed pointer-events-none'
                    }`}
                  >
                    {isDownloading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#60a5fa]" />
                        <span>{lang === 'fr' ? 'Reconstruction...' : 'Rebuilding...'}</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        <span>{isPartialExport ? (lang === 'fr' ? 'Aperçu' : 'Preview') : (lang === 'fr' ? 'Télécharger' : 'Download')}</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={(e) => handleDeleteJob(e, job.id, job.file_name)}
                    className="p-1.5 bg-white/[0.04] hover:bg-rose-500/20 text-[#888] hover:text-rose-300 rounded-lg border border-white/[0.08] transition-all flex items-center justify-center"
                    title={t('dashboard.deleteProject', lang)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Progress & ETA Section */}
                <div className="project-progress space-y-2 pt-2">
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

              {/* Professional side-by-side translation workspace */}
              <div className="segment-workbench card-chill">
                <div className="segment-toolbar">
                  <div className="segment-workbench-title">
                    <FileText />
                    <div>
                      <span>{lang === 'fr' ? 'Atelier de traduction' : 'Translation workspace'}</span>
                      <h3>{t('inspector.title', lang)}</h3>
                    </div>
                  </div>

                  <div className="segment-toolbar-controls">
                    <button
                      type="button"
                      className={`segment-view-toggle ${showRawSegments ? 'is-active' : ''}`}
                      onClick={() => setShowRawSegments(!showRawSegments)}
                      aria-pressed={showRawSegments}
                    >
                      <span className="segment-toggle-track"><i /></span>
                      <span>{lang === 'fr' ? 'Texte brut' : 'Raw text'}</span>
                    </button>

                    <div className="flex items-center space-x-2 flex-wrap">
                      {!autoScroll && (
                        <button
                          type="button"
                          onClick={handleResync}
                          className="px-2 py-0.5 text-[9px] font-semibold bg-[#2563eb]/10 border border-[#2563eb]/20 hover:bg-[#2563eb]/20 text-[#60a5fa] rounded-md transition-all flex-shrink-0"
                        >
                          {lang === 'fr' ? 'Resynchroniser' : 'Resync'}
                        </button>
                      )}

                      <button
                        disabled={selectedSegIndex <= 0}
                        onClick={() => { setSelectedSegIndex((prev) => Math.max(0, prev - 1)); setAutoScroll(false); }}
                        className="text-zinc-400 hover:text-white disabled:opacity-20 transition-colors p-1"
                        aria-label={lang === 'fr' ? 'Segment précédent' : 'Previous segment'}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>

                      <form onSubmit={handleJumpSubmit} className="flex items-center space-x-1">
                        <input
                          type="text"
                          value={jumpInput}
                          onChange={(e) => setJumpInput(e.target.value)}
                          aria-label={lang === 'fr' ? 'Numéro du segment' : 'Segment number'}
                          className="w-10 bg-transparent border-b border-white/10 hover:border-white/30 focus:border-[#2563eb] text-center text-xs font-mono text-white outline-none pb-0.5"
                        />
                        <span className="text-xs text-zinc-500 font-mono">/ {segments.length}</span>
                      </form>

                      <button
                        disabled={selectedSegIndex >= segments.length - 1}
                        onClick={() => { setSelectedSegIndex((prev) => Math.min(segments.length - 1, prev + 1)); setAutoScroll(false); }}
                        className="text-[#888] hover:text-white disabled:opacity-20 transition-colors p-1"
                        aria-label={lang === 'fr' ? 'Segment suivant' : 'Next segment'}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {currentSegment ? (
                  <div className="segment-compare">
                    <section className="translation-pane source-pane">
                      <header className="translation-pane-header">
                        <div className="translation-language">
                          <span>{lang === 'fr' ? 'Texte source' : 'Source text'}</span>
                          <strong>{sourceLanguageName}<small>{job.source_lang.toUpperCase()}</small></strong>
                        </div>
                        <div className="translation-pane-meta">
                          <span className="translation-token-count">{sourceTokenCount.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} {lang === 'fr' ? 'tokens envoyés' : 'tokens sent'}</span>
                        </div>
                      </header>
                      <div className="document-text">
                        {displayedSourceText}
                      </div>
                      <footer className="translation-pane-footer">
                        <span>{displayedSourceText.length.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} {lang === 'fr' ? 'caractères' : 'characters'}</span>
                      </footer>
                    </section>

                    <section className="translation-pane target-pane">
                      <header className="translation-pane-header">
                        <div className="translation-language">
                          <span>{job.job_type === 'proofreading' ? (lang === 'fr' ? 'Texte relu' : 'Proofread text') : (lang === 'fr' ? 'Traduction' : 'Translation')}</span>
                          <strong>{targetLanguageName}<small>{job.target_lang.toUpperCase()}</small></strong>
                        </div>
                        <div className="translation-pane-meta">
                          <span className={`translation-status status-${String(currentSegment.status).toLowerCase()}`} aria-live="polite">
                            <i />
                            {segmentStatusLabel}
                          </span>
                          <span className="translation-token-count">{targetTokenCount.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} {lang === 'fr' ? 'tokens reçus' : 'tokens received'}</span>
                          {currentSegment.translated_text && (
                          <button
                            type="button"
                            onClick={() => handleCopyText(currentSegment.translated_text)}
                            className="translation-copy"
                            title={t('inspector.copyText', lang)}
                          >
                            {copied ? <Check /> : <Copy />}
                          </button>
                          )}
                        </div>
                      </header>
                      <div className={`document-text ${currentSegment.translated_text ? '' : 'is-empty'}`}>
                        {currentSegment.translated_text ? displayedTargetText : (
                          <span className="translation-empty">
                            {job.job_type === 'proofreading' ? (lang === 'fr' ? 'En attente de relecture...' : 'Waiting for proofreading...') : (lang === 'fr' ? 'En attente de traduction...' : 'Waiting for translation...')}
                          </span>
                        )}
                      </div>
                      <footer className="translation-pane-footer">
                        <span>{displayedTargetText.length.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} {lang === 'fr' ? 'caractères' : 'characters'}</span>
                      </footer>
                    </section>
                  </div>
                ) : (
                  <div className="segment-loading">{lang === 'fr' ? 'Chargement...' : 'Loading...'}</div>
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
