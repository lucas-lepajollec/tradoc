import React, { useState, useEffect } from 'react';
import { UploadCloud, BookOpen, Play, Pause, RefreshCw, Download, Trash2, ChevronRight, AlertCircle, Cpu, ArrowRight, TestTube, Layers } from 'lucide-react';
import { uploadBook, startJob, pauseJob, retryJob, deleteJob, fetchJobs, fetchGlossaries } from '../api';

export default function Dashboard({ onSelectJob, settings, endpointStatus, availableModels, setActiveTab }) {
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

    const timer = setInterval(() => {
      loadJobs();
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (availableModels.length > 0 && !selectedModel) {
      setSelectedModel(availableModels[0]);
    }
  }, [availableModels]);

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
    if (!file) return;
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('source_lang', sourceLang);
      formData.append('target_lang', targetLang);
      formData.append('model', selectedModel || settings.model);
      formData.append('chunk_size', settings.chunkSize || 1000);
      formData.append('temperature', settings.temperature !== undefined ? settings.temperature : 1.5);
      formData.append('concurrency', settings.concurrency || 1);
      if (settings.systemPrompt) {
        formData.append('system_prompt', settings.systemPrompt);
      }
      if (selectedGlossary) formData.append('glossary_name', selectedGlossary);

      const newJob = await uploadBook(formData);
      
      if (autoStart) {
        await startJob(newJob.id, {
          endpoint: settings.endpoint,
          apiKey: settings.apiKey,
          concurrency: settings.concurrency,
          temperature: settings.temperature
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
    startJob(jobId, {
      endpoint: settings.endpoint,
      apiKey: settings.apiKey,
      concurrency: settings.concurrency,
      temperature: settings.temperature
    }).catch(console.error);
    await loadJobs();
  };

  const handlePauseJob = async (e, jobId) => {
    e.stopPropagation();
    setJobs((prev) => prev.map((j) => j.id === jobId ? { ...j, status: 'PAUSED' } : j));
    pauseJob(jobId).catch(console.error);
    await loadJobs();
  };

  const handleRetryJob = async (e, jobId) => {
    e.stopPropagation();
    await retryJob(jobId);
    await startJob(jobId, {
      endpoint: settings.endpoint,
      apiKey: settings.apiKey,
      concurrency: settings.concurrency,
      temperature: settings.temperature
    });
    await loadJobs();
  };

  const handleDeleteJob = async (e, jobId, fileName) => {
    e.stopPropagation();
    if (!window.confirm(`Supprimer définitivement le projet "${fileName}" ?`)) return;
    await deleteJob(jobId);
    await loadJobs();
  };

  return (
    <div className="space-y-8">
      
      {/* Connection Warning Banner */}
      {!endpointStatus && (
        <div className="card-chill p-4 border-amber-500/30 text-amber-300 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>
              <strong>Serveur GPU injoignable :</strong> Vérifiez le serveur sur <code className="bg-black/50 px-2 py-0.5 rounded text-amber-200">{settings.endpoint}</code>.
            </span>
          </div>
          <button
            onClick={() => setActiveTab('settings')}
            className="btn-chill px-3 py-1 text-[11px] font-bold"
          >
            Configurer IP
          </button>
        </div>
      )}

      {/* Main Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Upload Card (2 cols) */}
        <div className="lg:col-span-2 card-chill p-6 sm:p-8 space-y-6">
          
          <div className="flex items-start justify-between flex-wrap gap-2">
            <div className="flex-1 min-w-0">
              <h2 className="font-heading font-extrabold text-base sm:text-lg text-white tracking-tight flex items-center space-x-2 truncate">
                <UploadCloud className="w-5 h-5 text-orange-400 flex-shrink-0" />
                <span className="truncate">Importer un livre</span>
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">Glissez-déposez votre fichier EPUB ou PDF</p>
            </div>
            <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-orange-400 bg-orange-500/10 px-2.5 py-1 rounded-lg border border-orange-500/20 flex-shrink-0">
              EPUB / PDF
            </span>
          </div>

          {error && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleUploadSubmit} className="space-y-6">
            
            {/* Dropzone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
                file
                  ? 'border-orange-500 bg-orange-500/10'
                  : 'border-white/10 hover:border-orange-500/40 bg-black/40 hover:bg-black/60'
              }`}
            >
              <input
                type="file"
                accept=".epub,.pdf"
                className="hidden"
                id="file-upload"
                onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])}
              />
              <label htmlFor="file-upload" className="cursor-pointer block space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/30 text-orange-400 flex items-center justify-center mx-auto shadow-inner">
                  <BookOpen className="w-6 h-6" />
                </div>
                {file ? (
                  <div>
                    <p className="font-bold text-white text-sm">{file.name}</p>
                    <p className="text-xs text-orange-400 mt-0.5 font-mono">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                  </div>
                ) : (
                  <div>
                    <p className="font-semibold text-zinc-200 text-xs">Déposez votre livre ici ou cliquez pour choisir</p>
                    <p className="text-[11px] text-zinc-500 mt-1">EPUB ou PDF littéraire</p>
                  </div>
                )}
              </label>
            </div>

            {/* Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Modèle LLM</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full input-chill px-4 py-2.5 text-xs text-zinc-200"
                >
                  {availableModels.length > 0 ? (
                    availableModels.map((m) => <option key={m} value={m}>{m}</option>)
                  ) : (
                    <option value={settings.model}>{settings.model}</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Glossaire Littéraire</label>
                <select
                  value={selectedGlossary}
                  onChange={(e) => setSelectedGlossary(e.target.value)}
                  className="w-full input-chill px-4 py-2.5 text-xs text-zinc-200"
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
                disabled={!file || uploading}
                className="py-3.5 btn-orange text-xs font-semibold flex items-center justify-center space-x-2 shadow-lg shadow-orange-500/20 disabled:opacity-40"
              >
                {uploading ? (
                  <span>Analyse en cours...</span>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>Démarrer la Traduction</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={(e) => handleUploadSubmit(e, false)}
                disabled={!file || uploading}
                className="py-3.5 bg-white/5 hover:bg-white/10 text-zinc-200 border border-white/10 text-xs font-semibold rounded-xl transition-all flex items-center justify-center space-x-2 disabled:opacity-40"
                title="Découpe le livre en segments et l'envoie dans l'inspecteur sans lancer la traduction"
              >
                {uploading ? (
                  <span>Analyse en cours...</span>
                ) : (
                  <>
                    <Layers className="w-3.5 h-3.5 text-orange-400" />
                    <span>Préparer & Inspecter (Sans lancer)</span>
                  </>
                )}
              </button>
            </div>

          </form>
        </div>

        {/* Status Card (1 col) */}
        <div className="space-y-6">
          <div className="card-chill p-6 space-y-5">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-orange-400" />
              <span>Paramètres du Serveur</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-zinc-500">Endpoint</span>
                <span className="font-mono text-zinc-300 truncate max-w-[150px]">{settings.endpoint}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-zinc-500">Modèle Actif</span>
                <span className="font-mono text-orange-300 truncate max-w-[150px]">{settings.model}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-zinc-500">Concurrence</span>
                <span className="font-bold text-emerald-400">{(settings.concurrency || 1)} requête{(settings.concurrency > 1) ? 's' : ''} //</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-zinc-500">Fenêtre Sémantique</span>
                <span className="font-bold text-zinc-300">{(settings.chunkSize || 1000)} tokens</span>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('settings')}
              className="w-full btn-chill py-2.5 text-xs font-semibold flex items-center justify-center space-x-2"
            >
              <span>Modifier la configuration</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="card-chill p-6 space-y-3">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center space-x-2">
              <TestTube className="w-4 h-4 text-orange-400" />
              <span>Testeur en Direct</span>
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Testez vos phrases et votre modèle en 2 secondes sans importer de livre.
            </p>
            <button
              onClick={() => setActiveTab('sandbox')}
              className="w-full py-2.5 bg-orange-500/10 hover:bg-orange-500/20 text-orange-300 text-xs font-semibold rounded-xl border border-orange-500/20 transition-all flex items-center justify-center space-x-2"
            >
              <span>Ouvrir le Bac à Sable</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

      {/* Projects List with Direct Controls & Download Buttons */}
      <div className="space-y-4">
        <h2 className="font-heading font-bold text-base text-white tracking-tight flex items-center space-x-2">
          <Layers className="w-4 h-4 text-orange-400" />
          <span>Projets enregistrés ({jobs.length})</span>
        </h2>

        {jobs.length === 0 ? (
          <div className="card-chill p-12 text-center text-zinc-500 text-xs">
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
                    <span className="text-[10px] font-mono text-zinc-400 bg-white/5 px-2 py-0.5 rounded border border-white/5">
                      {j.file_type.toUpperCase()}
                    </span>

                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        j.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                        j.status === 'PROCESSING' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30 animate-pulse' :
                        'bg-zinc-800 text-zinc-400'
                      }`}>
                        {j.status}
                      </span>
                      
                      <button
                        onClick={(e) => handleDeleteJob(e, j.id, j.file_name)}
                        className="text-zinc-600 hover:text-rose-400 p-1 transition-colors"
                        title="Supprimer ce projet"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold text-white text-xs truncate" title={j.file_name}>{truncatedName}</h3>
                    <p className="text-[11px] text-zinc-400 mt-0.5 font-mono truncate">Modèle: {j.model}</p>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] font-medium">
                      <span className="text-zinc-400">Progression</span>
                      <span className="text-orange-400 font-bold">{percent}% ({j.completed_chunks}/{j.total_chunks})</span>
                    </div>
                    <div className="w-full h-2 bg-black/60 rounded-full overflow-hidden p-0.5 border border-white/5">
                      <div
                        className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full transition-all duration-300"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  {/* Direct Controls & Download bar directly on the Card */}
                  <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      {j.status === 'PROCESSING' ? (
                        <button
                          onClick={(e) => handlePauseJob(e, j.id)}
                          className="px-2.5 py-1 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded-lg text-[11px] font-semibold flex items-center space-x-1 hover:bg-amber-500/20"
                        >
                          <Pause className="w-3 h-3" />
                          <span>Pause</span>
                        </button>
                      ) : (
                        <button
                          onClick={(e) => handleStartResumeJob(e, j.id)}
                          className="px-2.5 py-1 bg-orange-500/20 text-orange-300 border border-orange-500/30 rounded-lg text-[11px] font-semibold flex items-center space-x-1 hover:bg-orange-500/30"
                        >
                          <Play className="w-3 h-3 fill-orange-300" />
                          <span>{j.completed_chunks > 0 ? 'Reprendre' : 'Lancer'}</span>
                        </button>
                      )}

                      <a
                        href={`/api/jobs/${j.id}/download?t=${Date.now()}`}
                        onClick={(e) => e.stopPropagation()}
                        target="_blank"
                        rel="noreferrer"
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center space-x-1 transition-all ${
                          j.status === 'COMPLETED' || j.completed_chunks > 0
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30'
                            : 'bg-white/5 text-zinc-600 border border-white/5 pointer-events-none'
                        }`}
                        title="Télécharger le fichier EPUB/PDF traduit"
                      >
                        <Download className="w-3 h-3" />
                        <span>EPUB</span>
                      </a>
                    </div>

                    <span className="text-zinc-500 group-hover:text-orange-400 flex items-center space-x-1 text-[11px] font-semibold transition-colors">
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
