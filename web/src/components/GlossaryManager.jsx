import React, { useState, useEffect, useRef } from 'react';
import { BookMarked, Plus, Trash2, Save, FileText, CheckCircle2, Copy, Check, Upload, Sparkles, HelpCircle, FileCode, ArrowDown } from 'lucide-react';
import { fetchGlossaries, fetchGlossary, saveGlossary, deleteGlossary } from '../api';
import { t } from '../i18n/translations';

const AI_MASTER_PROMPT = `Tu es un assistant éditorial expert en traduction littéraire.
Analyse le texte du livre fourni ci-dessous et extrait tous les noms propres (personnages, lieux fictifs, organisations, artefacts) ainsi que les termes récurrents spécifiques.

Format de réponse OBLIGATOIRE (strictement une entrée par ligne au format CSV séparé par "|") :
Terme Original | Traduction Conseillée | Note/Règle

Exemple de sortie attendue :
Arthur Pendragon | Arthur Pendragon | Ne pas traduire
Camelot | Camelot | Nom du royaume (ne pas traduire)
Excalibur | Excalibur | Épée mythique

Règles strictes :
1. Pour les noms propres qui ne doivent PAS être traduits, garde la traduction identique au terme original.
2. Conserve la casse originale.
3. Pas d'introduction, pas de texte de présentation ni de conclusion. Renvoie UNIQUEMENT les lignes au format "Original | Traduction | Note".

Voici le texte du livre :
[COLLEZ LE TEXTE DE VOTRE LIVRE ICI]`;

export default function GlossaryManager({ lang = 'en' }) {
  const [glossaries, setGlossaries] = useState([]);
  const [selectedName, setSelectedName] = useState(null);
  const [nameInput, setNameInput] = useState('');
  const [descInput, setDescInput] = useState('');
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState(null);

  // Active assistant tool tab: null | 'prompt' | 'import' | 'guide'
  const [activeTool, setActiveTool] = useState(null);
  
  // Prompt copy & Paste state
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [pasteText, setPasteText] = useState('');
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadGlossaryList();
  }, []);

  const loadGlossaryList = async () => {
    try {
      const list = await fetchGlossaries();
      setGlossaries(list);
      if (list.length > 0 && !selectedName) {
        loadSingleGlossary(list[0]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadSingleGlossary = async (name) => {
    try {
      const g = await fetchGlossary(name);
      setSelectedName(g.name);
      setNameInput(g.name);
      setDescInput(g.description || '');
      setItems(g.items || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateNew = () => {
    setSelectedName(null);
    setNameInput('nouveau_glossaire');
    setDescInput('Glossaire pour noms propres et termes uniques');
    setItems([
      { source: 'Arthur Pendragon', target: 'Arthur Pendragon', category: 'name', note: 'Ne pas traduire' }
    ]);
  };

  const handleAddItem = () => {
    setItems((prev) => [...prev, { source: '', target: '', category: 'general', note: '' }]);
  };

  const handleRemoveItem = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index][field] = value;
      return updated;
    });
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!nameInput) return;

    const payload = {
      name: nameInput,
      description: descInput,
      items: items.filter((i) => i.source.trim() !== '')
    };

    try {
      await saveGlossary(payload);
      setMessage('Glossaire sauvegardé avec succès !');
      await loadGlossaryList();
      setSelectedName(nameInput);
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (name) => {
    if (!window.confirm(`Supprimer le glossaire "${name}" ?`)) return;
    try {
      await deleteGlossary(name);
      setSelectedName(null);
      await loadGlossaryList();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(AI_MASTER_PROMPT);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  // Batch Paste Parser (Support '|', '->', or CSV)
  const handleParseBatchPaste = () => {
    if (!pasteText.trim()) return;

    const lines = pasteText.split('\n');
    const newParsedItems = [];

    for (let line of lines) {
      line = line.trim();
      if (!line || line.startsWith('#') || line.startsWith('Exemple')) continue;

      let source = '', target = '', note = '';

      if (line.includes('|')) {
        const parts = line.split('|').map((p) => p.trim());
        source = parts[0] || '';
        target = parts[1] || source;
        note = parts[2] || '';
      } else if (line.includes('->')) {
        const parts = line.split('->').map((p) => p.trim());
        source = parts[0] || '';
        target = parts[1] || source;
      } else if (line.includes(',')) {
        const parts = line.split(',').map((p) => p.trim());
        source = parts[0] || '';
        target = parts[1] || source;
        note = parts[2] || '';
      } else {
        source = line;
        target = line;
      }

      if (source) {
        newParsedItems.push({ source, target, category: 'general', note });
      }
    }

    if (newParsedItems.length > 0) {
      setItems((prev) => [...prev, ...newParsedItems]);
      setPasteText('');
      setActiveTool(null);
      setMessage(`${newParsedItems.length} terme(s) inséré(s) dans le tableau ci-dessous !`);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  // File Upload Parser (.csv, .txt, .json)
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      if (file.name.endsWith('.json')) {
        try {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            setItems((prev) => [...prev, ...parsed]);
          } else if (parsed.items && Array.isArray(parsed.items)) {
            setItems((prev) => [...prev, ...parsed.items]);
          }
          setMessage(`Termes JSON importés avec succès !`);
          setTimeout(() => setMessage(null), 3000);
        } catch (err) {
          alert('Erreur lors du décodage du fichier JSON.');
        }
      } else {
        setPasteText(content);
        setActiveTool('import');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
      
      {/* Left Sidebar: Glossaries List (4 Cols) */}
      <div className="lg:col-span-4 card-chill p-5 space-y-4 rounded-2xl flex flex-col justify-between h-full">
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
            <h2 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center space-x-2">
              <BookMarked className="w-4 h-4 text-[#60a5fa]" />
              <span>Mes Glossaires</span>
            </h2>
            <button
              type="button"
              onClick={handleCreateNew}
              className="btn-chill px-3 py-1.5 text-xs flex items-center space-x-1.5 rounded-xl"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nouveau</span>
            </button>
          </div>

          <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
            {glossaries.map((gName) => (
              <div
                key={gName}
                className={`p-3.5 rounded-xl flex items-center justify-between text-xs cursor-pointer border transition-all ${
                  selectedName === gName
                    ? 'bg-white/[0.08] border-white/30 text-white font-semibold shadow-sm'
                    : 'bg-black/30 border-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                }`}
                onClick={() => loadSingleGlossary(gName)}
              >
                <span className="truncate font-mono">{gName}</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleDelete(gName); }}
                  className="text-zinc-600 hover:text-rose-400 p-1 transition-colors"
                  title="Supprimer ce glossaire"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Column: Master Editor Card (8 Cols) */}
      <div className="lg:col-span-8 card-chill p-6 sm:p-8 space-y-6 rounded-2xl flex flex-col justify-between h-full">
        
        <form onSubmit={handleSave} className="space-y-6 flex-1 flex flex-col justify-between">
          
          <div className="space-y-6">
            
            {/* Header: Name & Status */}
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div>
                <h1 className="text-sm font-semibold text-white tracking-tight flex items-center space-x-2">
                  <BookMarked className="w-4.5 h-4.5 text-[#60a5fa]" />
                  <span>{selectedName ? `Édition : ${selectedName}` : 'Créer un Glossaire'}</span>
                </h1>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Définit les règles de traduction fixe des personnages, lieux et termes récurrents.
                </p>
              </div>

              {message && (
                <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20 flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{message}</span>
                </span>
              )}
            </div>

            {/* Inputs: Name & Description */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Nom du Glossaire</label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="nom_du_glossaire"
                  className="w-full input-chill px-3.5 py-2 text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Description</label>
                <input
                  type="text"
                  value={descInput}
                  onChange={(e) => setDescInput(e.target.value)}
                  placeholder="Ex: Noms propres et règles spécifiques"
                  className="w-full input-chill px-3.5 py-2 text-xs"
                />
              </div>
            </div>

            {/* Integrated Assistant Toolbar */}
            <div className="p-4 rounded-xl bg-black/40 border border-white/[0.08] space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#60a5fa]" />
                  <span>Assistants & Remplissage Rapide</span>
                </span>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setActiveTool(activeTool === 'prompt' ? null : 'prompt')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all flex items-center space-x-1.5 ${
                      activeTool === 'prompt'
                        ? 'bg-white/10 text-white border-white/20'
                        : 'bg-white/[0.02] text-zinc-400 border-white/[0.06] hover:bg-white/[0.05] hover:text-white'
                    }`}
                  >
                    <Sparkles className="w-3 h-3 text-[#60a5fa]" />
                    <span>Prompt IA ChatGPT</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTool(activeTool === 'import' ? null : 'import')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all flex items-center space-x-1.5 ${
                      activeTool === 'import'
                        ? 'bg-white/10 text-white border-white/20'
                        : 'bg-white/[0.02] text-zinc-400 border-white/[0.06] hover:bg-white/[0.05] hover:text-white'
                    }`}
                  >
                    <FileCode className="w-3 h-3 text-emerald-400" />
                    <span>Coller / Importer</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTool(activeTool === 'guide' ? null : 'guide')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all flex items-center space-x-1.5 ${
                      activeTool === 'guide'
                        ? 'bg-white/10 text-white border-white/20'
                        : 'bg-white/[0.02] text-zinc-400 border-white/[0.06] hover:bg-white/[0.05] hover:text-white'
                    }`}
                  >
                    <HelpCircle className="w-3 h-3 text-amber-400" />
                    <span>Guide</span>
                  </button>
                </div>
              </div>

              {/* Tool 1: AI Prompt Master Panel */}
              {activeTool === 'prompt' && (
                <div className="pt-3 border-t border-white/[0.08] space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-zinc-300">
                      Copiez ce prompt dans ChatGPT / Claude avec votre texte. Il génèrera directement les lignes à insérer ci-dessous.
                    </p>
                    <button
                      type="button"
                      onClick={handleCopyPrompt}
                      className="btn-orange px-3.5 py-1 text-xs flex items-center space-x-1.5 flex-shrink-0"
                    >
                      {copiedPrompt ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedPrompt ? "Copié !" : "Copier le Prompt IA"}</span>
                    </button>
                  </div>
                  <pre className="p-3 rounded-lg bg-black/60 border border-white/[0.08] text-[11px] font-mono text-zinc-300 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                    {AI_MASTER_PROMPT}
                  </pre>
                </div>
              )}

              {/* Tool 2: Batch Paste & File Upload Panel */}
              {activeTool === 'import' && (
                <div className="pt-3 border-t border-white/[0.08] space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <p className="text-xs text-zinc-300">
                      Collez les lignes générées par l'IA (format <code className="font-mono text-emerald-400">Original | Traduction | Note</code>) ou chargez un fichier.
                    </p>

                    <div className="flex items-center space-x-2">
                      <input
                        type="file"
                        accept=".csv,.txt,.json"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="btn-chill px-3 py-1 text-xs flex items-center space-x-1 rounded-lg"
                      >
                        <Upload className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Fichier (.csv, .json)</span>
                      </button>
                    </div>
                  </div>

                  <textarea
                    rows={4}
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder="Collez ici les lignes au format :&#10;Arthur Pendragon | Arthur Pendragon | Ne pas traduire&#10;Camelot | Camelot | Nom du royaume"
                    className="w-full input-chill p-3 text-xs font-mono bg-black/60"
                  />

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleParseBatchPaste}
                      disabled={!pasteText.trim()}
                      className="btn-orange px-4 py-1.5 text-xs flex items-center space-x-1.5 disabled:opacity-40"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                      <span>Insérer dans la liste ci-dessous</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Tool 3: Guide Panel */}
              {activeTool === 'guide' && (
                <div className="pt-3 border-t border-white/[0.08] space-y-2 text-xs text-zinc-300">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded-lg bg-black/50 border border-white/[0.06] space-y-1">
                      <span className="font-semibold text-white block">1. Noms & Titres</span>
                      <p className="text-zinc-400 text-[11px]">Fixez la traduction précise des personnages (ex: <i>Arthur Pendragon &rarr; Arthur Pendragon</i>).</p>
                    </div>
                    <div className="p-3 rounded-lg bg-black/50 border border-white/[0.06] space-y-1">
                      <span className="font-semibold text-white block">2. Lieux & Univers</span>
                      <p className="text-zinc-400 text-[11px]">Empêchez la traduction non désirée de lieux fictifs (ex: <i>Camelot &rarr; Camelot</i>).</p>
                    </div>
                    <div className="p-3 rounded-lg bg-black/50 border border-white/[0.06] space-y-1">
                      <span className="font-semibold text-white block">3. Notes & Conseils</span>
                      <p className="text-zinc-400 text-[11px]">Le champ Note transmet une consigne exacte au modèle de traduction.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Terms Table Section */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between flex-wrap gap-2 border-b border-white/[0.08] pb-2.5">
                <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  Termes du Glossaire ({items.length})
                </h3>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="btn-chill px-3 py-1.5 text-xs flex items-center space-x-1.5 rounded-xl"
                >
                  <Plus className="w-3.5 h-3.5 text-[#60a5fa]" />
                  <span>Ajouter une ligne</span>
                </button>
              </div>

              {/* Table Column Headers */}
              {items.length > 0 && (
                <div className="grid grid-cols-12 gap-2 text-[10px] font-semibold text-zinc-500 uppercase px-3">
                  <div className="col-span-4">Terme Source (EN)</div>
                  <div className="col-span-4">Traduction Cible (FR)</div>
                  <div className="col-span-3">Note / Directive</div>
                  <div className="col-span-1 text-right">Action</div>
                </div>
              )}

              {/* Items List */}
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {items.length === 0 ? (
                  <div className="p-8 text-center text-zinc-500 text-xs bg-black/40 rounded-xl border border-white/[0.06] space-y-1">
                    <p className="text-zinc-300 font-semibold">Le glossaire est actuellement vide.</p>
                    <p className="text-zinc-500">Utilisez le bouton « Coller / Importer » ou cliquez sur « Ajouter une ligne » pour commencer.</p>
                  </div>
                ) : (
                  items.map((item, idx) => (
                    <div key={idx} className="bg-black/40 p-2.5 rounded-xl border border-white/[0.08] grid grid-cols-12 gap-2 items-center hover:border-white/[0.14] transition-all">
                      <div className="col-span-4">
                        <input
                          type="text"
                          placeholder="Terme Source (ex: Arthur Pendragon)"
                          value={item.source}
                          onChange={(e) => handleItemChange(idx, 'source', e.target.value)}
                          className="w-full input-chill px-3 py-1.5 text-xs font-mono"
                        />
                      </div>
                      <div className="col-span-4">
                        <input
                          type="text"
                          placeholder="Traduction Cible (ex: Arthur Pendragon)"
                          value={item.target}
                          onChange={(e) => handleItemChange(idx, 'target', e.target.value)}
                          className="w-full input-chill px-3 py-1.5 text-xs font-mono"
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          type="text"
                          placeholder="Note / Règle (optionnel)"
                          value={item.note || ''}
                          onChange={(e) => handleItemChange(idx, 'note', e.target.value)}
                          className="w-full input-chill px-3 py-1.5 text-xs"
                        />
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-zinc-600 hover:text-rose-400 p-1.5 transition-colors"
                          title="Supprimer la ligne"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

          {/* Save Footer Button */}
          <div className="flex justify-end pt-4 border-t border-white/[0.08]">
            <button
              type="submit"
              className="btn-orange px-6 py-2.5 text-xs font-semibold flex items-center space-x-2"
            >
              <Save className="w-3.5 h-3.5 fill-white" />
              <span>Sauvegarder le Glossaire</span>
            </button>
          </div>

        </form>

      </div>

    </div>
  );
}
