import React from 'react';
import { BookMarked, Plus, Trash2, Save, Copy, Check, Upload, Sparkles, HelpCircle, FileCode, ArrowDown } from 'lucide-react';

export default function GlossaryWorkspace({
  lang, glossaries, selectedName, nameInput, setNameInput, descInput, setDescInput,
  items, message, activeTool, setActiveTool, copiedPrompt, pasteText, setPasteText,
  fileInputRef, aiPrompt, onCreate, onSelect, onDelete, onCopyPrompt, onFileUpload,
  onParsePaste, onAddItem, onItemChange, onRemoveItem, onSave,
}) {
  const fr = lang === 'fr';

  return (
    <div className="glossary-v2 page-stack">
      <header className="page-intro glossary-v2-header">
        <div>
          <p className="page-kicker">{fr ? 'Cohérence terminologique' : 'Terminology consistency'}</p>
          <h1>{fr ? 'Glossaires de traduction' : 'Translation glossaries'}</h1>
          <p>{fr ? 'Centralisez les noms, lieux et règles qui doivent rester cohérents dans tout le document.' : 'Centralize names, places, and rules that must remain consistent throughout the document.'}</p>
        </div>
        <button type="button" className="primary-action" onClick={onCreate}><Plus />{fr ? 'Nouveau glossaire' : 'New glossary'}</button>
      </header>

      <nav className="glossary-strip" aria-label={fr ? 'Glossaires disponibles' : 'Available glossaries'}>
        {glossaries.length === 0 ? (
          <button type="button" className="glossary-empty-tab" onClick={onCreate}><Plus /><span>{fr ? 'Créer votre premier glossaire' : 'Create your first glossary'}</span></button>
        ) : glossaries.map((name) => (
          <div key={name} className={`glossary-tab ${selectedName === name ? 'is-active' : ''}`}>
            <button type="button" onClick={() => onSelect(name)}><BookMarked /><span>{name}</span></button>
            <button type="button" className="tab-delete" onClick={() => onDelete(name)} title={fr ? 'Supprimer' : 'Delete'}><Trash2 /></button>
          </div>
        ))}
      </nav>

      <section className="glossary-bulk-card">
        <div className="tools-heading">
          <div className="bulk-heading-copy">
            <Sparkles />
            <div>
              <span>{fr ? 'Ajouter plusieurs termes' : 'Add multiple terms'}</span>
              <p>{fr ? 'Importez une liste ou préparez rapidement des entrées avec l’assistant.' : 'Import a list or quickly prepare entries with the assistant.'}</p>
            </div>
          </div>
          <div className="tool-tabs">
            <button type="button" className={activeTool === 'prompt' ? 'is-active' : ''} onClick={() => setActiveTool(activeTool === 'prompt' ? null : 'prompt')}><Sparkles />{fr ? 'Prompt IA' : 'AI prompt'}</button>
            <button type="button" className={activeTool === 'import' ? 'is-active' : ''} onClick={() => setActiveTool(activeTool === 'import' ? null : 'import')}><FileCode />{fr ? 'Importer' : 'Import'}</button>
            <button type="button" className={activeTool === 'guide' ? 'is-active' : ''} onClick={() => setActiveTool(activeTool === 'guide' ? null : 'guide')}><HelpCircle />{fr ? 'Guide' : 'Guide'}</button>
          </div>
        </div>

        {activeTool === 'prompt' && <div className="tool-panel prompt-panel"><div><p>{fr ? 'Copiez ce prompt avec un extrait du livre pour extraire automatiquement sa terminologie.' : 'Copy this prompt with a book excerpt to automatically extract terminology.'}</p><button type="button" onClick={onCopyPrompt}>{copiedPrompt ? <Check /> : <Copy />}{copiedPrompt ? (fr ? 'Copié' : 'Copied') : (fr ? 'Copier le prompt' : 'Copy prompt')}</button></div><pre>{aiPrompt}</pre></div>}

        {activeTool === 'import' && <div className="tool-panel import-panel">
          <div className="import-copy"><p>{fr ? 'Une ligne par terme : Original | Traduction | Note' : 'One term per line: Original | Translation | Note'}</p><input type="file" accept=".csv,.txt,.json" ref={fileInputRef} onChange={onFileUpload} className="hidden" /><button type="button" onClick={() => fileInputRef.current?.click()}><Upload />{fr ? 'Choisir un fichier' : 'Choose file'}</button></div>
          <textarea rows={5} value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder={'Arthur Pendragon | Arthur Pendragon | Ne pas traduire\nCamelot | Camelot | Nom du royaume'} />
          <button type="button" className="primary-action import-submit" disabled={!pasteText.trim()} onClick={onParsePaste}><ArrowDown />{fr ? 'Ajouter ces termes' : 'Add these terms'}</button>
        </div>}

        {activeTool === 'guide' && <div className="tool-panel guide-panel"><article><strong>01</strong><div><h3>{fr ? 'Terme source' : 'Source term'}</h3><p>{fr ? 'La forme exacte rencontrée dans le document.' : 'The exact form found in the document.'}</p></div></article><article><strong>02</strong><div><h3>{fr ? 'Traduction cible' : 'Target translation'}</h3><p>{fr ? 'La forme que TraDoc doit toujours utiliser.' : 'The form TraDoc must always use.'}</p></div></article><article><strong>03</strong><div><h3>{fr ? 'Directive' : 'Directive'}</h3><p>{fr ? 'Une règle courte donnée au modèle.' : 'A short rule provided to the model.'}</p></div></article></div>}
      </section>

      <form onSubmit={onSave} className="glossary-canvas">
        <div className="glossary-canvas-header">
          <div className="glossary-title-fields">
            <label><span>{fr ? 'Nom du glossaire' : 'Glossary name'}</span><input value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder="fantasy_fr" /></label>
            <label><span>{fr ? 'Description' : 'Description'}</span><input value={descInput} onChange={(e) => setDescInput(e.target.value)} placeholder={fr ? 'Personnages, lieux et terminologie' : 'Characters, places, and terminology'} /></label>
          </div>
          <div className="glossary-save-area">
            {message && <span className="save-message"><Check />{message}</span>}
            <button type="submit" className="primary-action"><Save />{fr ? 'Enregistrer' : 'Save'}</button>
          </div>
        </div>

        <section className="terminology-editor">
          <div className="terminology-heading"><div><h2>{fr ? 'Terminologie' : 'Terminology'}</h2><span>{items.length} {fr ? 'termes' : 'terms'}</span></div><button type="button" onClick={onAddItem}><Plus />{fr ? 'Ajouter un terme' : 'Add term'}</button></div>
          <div className="term-table">
            <div className="term-table-head"><span>{fr ? 'Source' : 'Source'}</span><span>{fr ? 'Traduction' : 'Translation'}</span><span>{fr ? 'Directive' : 'Directive'}</span><span /></div>
            {items.length === 0 ? <div className="term-empty"><BookMarked /><strong>{fr ? 'Aucun terme pour le moment' : 'No terms yet'}</strong><p>{fr ? 'Ajoutez une ligne ou utilisez les outils d’import ci-dessus.' : 'Add a row or use the import tools above.'}</p></div> : items.map((item, index) => (
              <div className="term-row" key={index}>
                <input value={item.source} onChange={(e) => onItemChange(index, 'source', e.target.value)} placeholder={fr ? 'Terme original' : 'Original term'} />
                <input value={item.target} onChange={(e) => onItemChange(index, 'target', e.target.value)} placeholder={fr ? 'Traduction retenue' : 'Preferred translation'} />
                <input value={item.note || ''} onChange={(e) => onItemChange(index, 'note', e.target.value)} placeholder={fr ? 'Consigne optionnelle' : 'Optional instruction'} />
                <button type="button" onClick={() => onRemoveItem(index)} title={fr ? 'Supprimer la ligne' : 'Delete row'}><Trash2 /></button>
              </div>
            ))}
          </div>
        </section>
      </form>
    </div>
  );
}
