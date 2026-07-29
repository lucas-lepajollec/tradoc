import React, { useState, useEffect } from 'react';
import { BookMarked, Plus, Trash2, Save, FileText, CheckCircle2 } from 'lucide-react';
import { fetchGlossaries, fetchGlossary, saveGlossary, deleteGlossary } from '../api';

export default function GlossaryManager() {
  const [glossaries, setGlossaries] = useState([]);
  const [selectedName, setSelectedName] = useState(null);
  const [nameInput, setNameInput] = useState('');
  const [descInput, setDescInput] = useState('');
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState(null);

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
    e.preventDefault();
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      
      {/* Sidebar List (1 col) */}
      <div className="card-chill p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <h2 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-1">Glossaires</h2>
          <button
            onClick={handleCreateNew}
            className="btn-orange px-2.5 py-1 text-xs flex items-center space-x-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nouveau</span>
          </button>
        </div>

        <div className="space-y-1 max-h-[550px] overflow-y-auto pr-1">
          {glossaries.map((gName) => (
            <div
              key={gName}
              className={`p-3 rounded-xl flex items-center justify-between text-xs cursor-pointer border ${
                selectedName === gName
                  ? 'bg-orange-500/15 border-orange-500/30 text-white font-semibold'
                  : 'bg-black/30 border-white/5 text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              }`}
              onClick={() => loadSingleGlossary(gName)}
            >
              <span className="truncate font-mono">{gName}</span>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(gName); }}
                className="text-zinc-600 hover:text-rose-400 p-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Editor Main Card (3 cols) */}
      <div className="lg:col-span-3 space-y-6">
        <div className="card-chill p-6 sm:p-8 space-y-6">
          
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <h1 className="text-base font-bold text-white tracking-tight flex items-center space-x-2">
              <BookMarked className="w-5 h-5 text-orange-400" />
              <span>{selectedName ? `Édition du Glossaire: ${selectedName}` : 'Créer un Nouveau Glossaire'}</span>
            </h1>

            {message && (
              <span className="text-xs font-mono text-emerald-400 flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{message}</span>
              </span>
            )}
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Nom du Glossaire</label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="nom_du_glossaire"
                  className="w-full input-chill px-4 py-2.5 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Description</label>
                <input
                  type="text"
                  value={descInput}
                  onChange={(e) => setDescInput(e.target.value)}
                  placeholder="Ex: Noms propres et règles spécifiques"
                  className="w-full input-chill px-4 py-2.5 text-xs"
                />
              </div>
            </div>

            {/* Terms List Table */}
            <div className="space-y-3 pt-4 border-t border-white/5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Termes & Mots Clés ({items.length})</h3>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="btn-chill px-3 py-1.5 text-xs flex items-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5 text-orange-400" />
                  <span>Ajouter un terme</span>
                </button>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {items.map((item, idx) => (
                  <div key={idx} className="bg-[#0e0f16] p-3 rounded-xl border border-white/5 grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Terme Source (EN)"
                      value={item.source}
                      onChange={(e) => handleItemChange(idx, 'source', e.target.value)}
                      className="input-chill px-3 py-1.5 text-xs font-mono"
                    />
                    <input
                      type="text"
                      placeholder="Traduction Cible (FR)"
                      value={item.target}
                      onChange={(e) => handleItemChange(idx, 'target', e.target.value)}
                      className="input-chill px-3 py-1.5 text-xs font-mono"
                    />
                    <input
                      type="text"
                      placeholder="Note / Règle (optionnel)"
                      value={item.note || ''}
                      onChange={(e) => handleItemChange(idx, 'note', e.target.value)}
                      className="input-chill px-3 py-1.5 text-xs"
                    />
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-zinc-600 hover:text-rose-400 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-white/5">
              <button
                type="submit"
                className="btn-orange px-6 py-2.5 text-xs flex items-center space-x-2"
              >
                <Save className="w-3.5 h-3.5 fill-white" />
                <span>Sauvegarder le Glossaire</span>
              </button>
            </div>

          </form>

        </div>
      </div>

    </div>
  );
}
