import React from 'react';
import { BookMarked, Plus, Trash2, Save, Copy, Check, Upload, Sparkles, HelpCircle, FileCode, ArrowDown } from 'lucide-react';
import { l } from '../i18n/translations';

export default function GlossaryWorkspace({
  lang, glossaries, selectedName, nameInput, setNameInput, descInput, setDescInput,
  items, message, activeTool, setActiveTool, copiedPrompt, pasteText, setPasteText,
  fileInputRef, aiPrompt, onCreate, onSelect, onDelete, onCopyPrompt, onFileUpload,
  onParsePaste, onAddItem, onItemChange, onRemoveItem, onSave,
}) {
  return (
    <div className="glossary-v2 page-stack">
      <header className="page-intro glossary-v2-header">
        <div>
          <p className="page-kicker">{l(lang, 'Terminology consistency', 'Cohérence terminologique', 'Coherencia terminológica', 'Terminologische Konsistenz')}</p>
          <h1>{l(lang, 'Translation glossaries', 'Glossaires de traduction', 'Glosarios de traducción', 'Übersetzungsglossare')}</h1>
          <p>{l(lang, 'Centralize names, places, and rules that must remain consistent throughout the document.', 'Centralisez les noms, lieux et règles qui doivent rester cohérents dans tout le document.', 'Centraliza los nombres, lugares y reglas que deben mantenerse coherentes en todo el documento.', 'Verwalte Namen, Orte und Regeln zentral, damit sie im gesamten Dokument konsistent bleiben.')}</p>
        </div>
        <button type="button" className="primary-action" onClick={onCreate}><Plus />{l(lang, 'New glossary', 'Nouveau glossaire', 'Nuevo glosario', 'Neues Glossar')}</button>
      </header>

      <nav className="glossary-strip" aria-label={l(lang, 'Available glossaries', 'Glossaires disponibles', 'Glosarios disponibles', 'Verfügbare Glossare')}>
        {glossaries.length === 0 ? (
          <button type="button" className="glossary-empty-tab" onClick={onCreate}><Plus /><span>{l(lang, 'Create your first glossary', 'Créer votre premier glossaire', 'Crea tu primer glosario', 'Erstelle dein erstes Glossar')}</span></button>
        ) : glossaries.map((name) => (
          <div key={name} className={`glossary-tab ${selectedName === name ? 'is-active' : ''}`}>
            <button type="button" onClick={() => onSelect(name)}><BookMarked /><span>{name}</span></button>
            <button type="button" className="tab-delete" onClick={() => onDelete(name)} title={l(lang, 'Delete', 'Supprimer', 'Eliminar', 'Löschen')}><Trash2 /></button>
          </div>
        ))}
      </nav>

      <section className="glossary-bulk-card">
        <div className="tools-heading">
          <div className="bulk-heading-copy">
            <Sparkles />
            <div>
              <span>{l(lang, 'Add multiple terms', 'Ajouter plusieurs termes', 'Añadir varios términos', 'Mehrere Begriffe hinzufügen')}</span>
              <p>{l(lang, 'Import a list or quickly prepare entries with the assistant.', 'Importez une liste ou préparez rapidement des entrées avec l’assistant.', 'Importa una lista o prepara entradas rápidamente con el asistente.', 'Importiere eine Liste oder bereite Einträge schnell mit dem Assistenten vor.')}</p>
            </div>
          </div>
          <div className="tool-tabs">
            <button type="button" className={activeTool === 'prompt' ? 'is-active' : ''} onClick={() => setActiveTool(activeTool === 'prompt' ? null : 'prompt')}><Sparkles />{l(lang, 'AI prompt', 'Prompt IA', 'Prompt de IA', 'KI-Prompt')}</button>
            <button type="button" className={activeTool === 'import' ? 'is-active' : ''} onClick={() => setActiveTool(activeTool === 'import' ? null : 'import')}><FileCode />{l(lang, 'Import', 'Importer', 'Importar', 'Importieren')}</button>
            <button type="button" className={activeTool === 'guide' ? 'is-active' : ''} onClick={() => setActiveTool(activeTool === 'guide' ? null : 'guide')}><HelpCircle />{l(lang, 'Guide', 'Guide', 'Guía', 'Leitfaden')}</button>
          </div>
        </div>

        {activeTool === 'prompt' && <div className="tool-panel prompt-panel"><div><p>{l(lang, 'Copy this prompt with a document excerpt to extract its terminology automatically.', 'Copiez ce prompt avec un extrait du document pour extraire automatiquement sa terminologie.', 'Copia este prompt junto con un fragmento del documento para extraer automáticamente su terminología.', 'Kopiere diesen Prompt zusammen mit einem Dokumentauszug, um dessen Terminologie automatisch zu extrahieren.')}</p><button type="button" onClick={onCopyPrompt}>{copiedPrompt ? <Check /> : <Copy />}{copiedPrompt ? l(lang, 'Copied', 'Copié', 'Copiado', 'Kopiert') : l(lang, 'Copy prompt', 'Copier le prompt', 'Copiar prompt', 'Prompt kopieren')}</button></div><pre>{aiPrompt}</pre></div>}

        {activeTool === 'import' && <div className="tool-panel import-panel">
          <div className="import-copy"><p>{l(lang, 'One term per line: Source | Translation | Note', 'Une ligne par terme : Source | Traduction | Note', 'Un término por línea: Origen | Traducción | Nota', 'Ein Begriff pro Zeile: Ausgangstext | Übersetzung | Hinweis')}</p><input type="file" accept=".csv,.txt,.json" ref={fileInputRef} onChange={onFileUpload} className="hidden" /><button type="button" onClick={() => fileInputRef.current?.click()}><Upload />{l(lang, 'Choose file', 'Choisir un fichier', 'Elegir archivo', 'Datei auswählen')}</button></div>
          <textarea rows={5} value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder={'Arthur Pendragon | Arthur Pendragon | Ne pas traduire\nCamelot | Camelot | Nom du royaume'} />
          <button type="button" className="primary-action import-submit" disabled={!pasteText.trim()} onClick={onParsePaste}><ArrowDown />{l(lang, 'Add these terms', 'Ajouter ces termes', 'Añadir estos términos', 'Diese Begriffe hinzufügen')}</button>
        </div>}

        {activeTool === 'guide' && <div className="tool-panel guide-panel"><article><strong>01</strong><div><h3>{l(lang, 'Source term', 'Terme source', 'Término de origen', 'Ausgangsbegriff')}</h3><p>{l(lang, 'The exact form found in the document.', 'La forme exacte rencontrée dans le document.', 'La forma exacta que aparece en el documento.', 'Die exakte Form im Dokument.')}</p></div></article><article><strong>02</strong><div><h3>{l(lang, 'Target translation', 'Traduction cible', 'Traducción de destino', 'Zielübersetzung')}</h3><p>{l(lang, 'The form TraDoc must always use.', 'La forme que TraDoc doit toujours utiliser.', 'La forma que TraDoc debe utilizar siempre.', 'Die Form, die TraDoc immer verwenden soll.')}</p></div></article><article><strong>03</strong><div><h3>{l(lang, 'Instruction', 'Directive', 'Instrucción', 'Anweisung')}</h3><p>{l(lang, 'A short rule provided to the model.', 'Une règle courte donnée au modèle.', 'Una regla breve para el modelo.', 'Eine kurze Regel für das Modell.')}</p></div></article></div>}
      </section>

      <form onSubmit={onSave} className="glossary-canvas">
        <div className="glossary-canvas-header">
          <div className="glossary-title-fields">
            <label><span>{l(lang, 'Glossary name', 'Nom du glossaire', 'Nombre del glosario', 'Glossarname')}</span><input value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder="fantasy_terms" /></label>
            <label><span>{l(lang, 'Description', 'Description', 'Descripción', 'Beschreibung')}</span><input value={descInput} onChange={(e) => setDescInput(e.target.value)} placeholder={l(lang, 'Characters, places, and terminology', 'Personnages, lieux et terminologie', 'Personajes, lugares y terminología', 'Figuren, Orte und Terminologie')} /></label>
          </div>
          <div className="glossary-save-area">
            {message && <span className="save-message"><Check />{message}</span>}
            <button type="submit" className="primary-action"><Save />{l(lang, 'Save', 'Enregistrer', 'Guardar', 'Speichern')}</button>
          </div>
        </div>

        <section className="terminology-editor">
          <div className="terminology-heading"><div><h2>{l(lang, 'Terminology', 'Terminologie', 'Terminología', 'Terminologie')}</h2><span>{items.length} {l(lang, items.length === 1 ? 'term' : 'terms', items.length > 1 ? 'termes' : 'terme', items.length === 1 ? 'término' : 'términos', items.length === 1 ? 'Begriff' : 'Begriffe')}</span></div><button type="button" onClick={onAddItem}><Plus />{l(lang, 'Add term', 'Ajouter un terme', 'Añadir término', 'Begriff hinzufügen')}</button></div>
          <div className="term-table">
            <div className="term-table-head"><span>{l(lang, 'Source', 'Source', 'Origen', 'Ausgangstext')}</span><span>{l(lang, 'Translation', 'Traduction', 'Traducción', 'Übersetzung')}</span><span>{l(lang, 'Instruction', 'Directive', 'Instrucción', 'Anweisung')}</span><span /></div>
            {items.length === 0 ? <div className="term-empty"><BookMarked /><strong>{l(lang, 'No terms yet', 'Aucun terme pour le moment', 'Aún no hay términos', 'Noch keine Begriffe')}</strong><p>{l(lang, 'Add a row or use the import tools above.', 'Ajoutez une ligne ou utilisez les outils d’import ci-dessus.', 'Añade una fila o utiliza las herramientas de importación anteriores.', 'Füge eine Zeile hinzu oder nutze die Importwerkzeuge oben.')}</p></div> : items.map((item, index) => (
              <div className="term-row" key={index}>
                <input value={item.source} onChange={(e) => onItemChange(index, 'source', e.target.value)} placeholder={l(lang, 'Original term', 'Terme original', 'Término original', 'Originalbegriff')} />
                <input value={item.target} onChange={(e) => onItemChange(index, 'target', e.target.value)} placeholder={l(lang, 'Preferred translation', 'Traduction retenue', 'Traducción preferida', 'Bevorzugte Übersetzung')} />
                <input value={item.note || ''} onChange={(e) => onItemChange(index, 'note', e.target.value)} placeholder={l(lang, 'Optional instruction', 'Consigne optionnelle', 'Instrucción opcional', 'Optionale Anweisung')} />
                <button type="button" onClick={() => onRemoveItem(index)} title={l(lang, 'Delete row', 'Supprimer la ligne', 'Eliminar fila', 'Zeile löschen')}><Trash2 /></button>
              </div>
            ))}
          </div>
        </section>
      </form>
    </div>
  );
}
