import React from 'react';
import { ArrowRight, Check, Copy, Plus, Trash2, Upload, X } from 'lucide-react';
import { l } from '../i18n/translations';

export default function GlossaryWorkspace({
  lang, glossaries, selectedName, nameInput, setNameInput, descInput, setDescInput,
  items, message, activeTool, setActiveTool, copiedPrompt, pasteText, setPasteText,
  fileInputRef, aiPrompt, onCreate, onSelect, onDelete, onCopyPrompt, onFileUpload,
  onParsePaste, onAddItem, onItemChange, onRemoveItem, onSave,
}) {
  const tools = [
    ['import', l(lang, 'Import', 'Importer', 'Importar', 'Importieren')],
    ['prompt', l(lang, 'AI prompt', 'Prompt IA', 'Prompt de IA', 'KI-Prompt')],
    ['guide', l(lang, 'Guide', 'Guide', 'Guía', 'Leitfaden')],
  ];
  const guide = [
    [l(lang, 'Source term', 'Terme source', 'Término de origen', 'Ausgangsbegriff'), l(lang, 'The exact form found in the document.', 'La forme exacte rencontrée dans le document.', 'La forma exacta que aparece en el documento.', 'Die exakte Form im Dokument.')],
    [l(lang, 'Target translation', 'Traduction cible', 'Traducción de destino', 'Zielübersetzung'), l(lang, 'The form TraDoc must always use.', 'La forme que TraDoc doit toujours utiliser.', 'La forma que TraDoc debe utilizar siempre.', 'Die Form, die TraDoc immer verwenden soll.')],
    [l(lang, 'Instruction', 'Directive', 'Instrucción', 'Anweisung'), l(lang, 'A short rule provided to the model.', 'Une règle courte donnée au modèle.', 'Una regla breve para el modelo.', 'Eine kurze Regel für das Modell.')],
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{l(lang, 'Translation glossaries', 'Glossaires de traduction', 'Glosarios de traducción', 'Übersetzungsglossare')}</h1>
          <p>{l(lang, 'Centralize names, places, and rules that must remain consistent throughout the document.', 'Centralisez les noms, lieux et règles qui doivent rester cohérents dans tout le document.', 'Centraliza los nombres, lugares y reglas que deben mantenerse coherentes en todo el documento.', 'Verwalte Namen, Orte und Regeln zentral, damit sie im gesamten Dokument konsistent bleiben.')}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={onCreate}><Plus aria-hidden="true" />{l(lang, 'New glossary', 'Nouveau glossaire', 'Nuevo glosario', 'Neues Glossar')}</button>
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <nav aria-label={l(lang, 'Available glossaries', 'Glossaires disponibles', 'Glosarios disponibles', 'Verfügbare Glossare')} className="flex min-w-0 flex-[1_1_240px] flex-col gap-1">
          {glossaries.length === 0 ? (
            <button type="button" className="btn btn-secondary justify-start" onClick={onCreate}>
              <Plus aria-hidden="true" />{l(lang, 'Create your first glossary', 'Créer votre premier glossaire', 'Crea tu primer glosario', 'Erstelle dein erstes Glossar')}
            </button>
          ) : glossaries.map((name) => {
            const isActive = selectedName === name;
            return (
              <div key={name} className={`flex items-center gap-1 rounded-[14px] border p-1 ${isActive ? 'border-line bg-card' : 'border-transparent'}`}>
                <button type="button" aria-current={isActive ? 'true' : undefined} onClick={() => onSelect(name)} className="min-w-0 flex-1 truncate rounded-[10px] border-0 bg-transparent px-2.5 py-2 text-left font-medium hover:bg-well">
                  {name}
                </button>
                <button type="button" className="icon-btn is-plain !size-8" onClick={() => onDelete(name)} aria-label={`${l(lang, 'Delete', 'Supprimer', 'Eliminar', 'Löschen')} — ${name}`}>
                  <Trash2 aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </nav>

        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
          <form onSubmit={onSave} className="card">
            <div className="flex flex-wrap items-end gap-3 px-6 py-5">
              <label className="field flex-[1_1_200px]">
                <span className="field-label">{l(lang, 'Glossary name', 'Nom du glossaire', 'Nombre del glosario', 'Glossarname')}</span>
                <input className="input" value={nameInput} onChange={(event) => setNameInput(event.target.value)} placeholder="fantasy_terms" />
              </label>
              <label className="field flex-[3_1_300px]">
                <span className="field-label">{l(lang, 'Description', 'Description', 'Descripción', 'Beschreibung')}</span>
                <input className="input" value={descInput} onChange={(event) => setDescInput(event.target.value)} placeholder={l(lang, 'Characters, places, and terminology', 'Personnages, lieux et terminologie', 'Personajes, lugares y terminología', 'Figuren, Orte und Terminologie')} />
              </label>
              <button type="submit" className="btn btn-primary btn-lg">{l(lang, 'Save', 'Enregistrer', 'Guardar', 'Speichern')}</button>
            </div>
            {message && (
              <p role="status" className="mx-6 mb-4 mt-0 flex items-center gap-2 text-[13px] text-good"><Check className="size-4" aria-hidden="true" />{message}</p>
            )}

            <div className="flex items-center justify-between border-t border-line px-6 py-3">
              <h2 className="section-title">
                {l(lang, 'Terminology', 'Terminologie', 'Terminología', 'Terminologie')} <span className="font-normal text-sec">{items.length}</span>
              </h2>
              <button type="button" className="btn btn-secondary btn-sm" onClick={onAddItem}><Plus aria-hidden="true" />{l(lang, 'Add term', 'Ajouter un terme', 'Añadir término', 'Begriff hinzufügen')}</button>
            </div>

            {items.length === 0 ? (
              <div className="mx-3 mb-3 rounded-[14px] bg-well px-4 py-8 text-center">
                <strong className="font-medium">{l(lang, 'No terms yet', 'Aucun terme pour le moment', 'Aún no hay términos', 'Noch keine Begriffe')}</strong>
                <p className="m-0 mt-1 text-[13px] text-sec">{l(lang, 'Add a row or use the import tools below.', 'Ajoutez une ligne ou utilisez les outils d’import ci-dessous.', 'Añade una fila o utiliza las herramientas de importación de abajo.', 'Füge eine Zeile hinzu oder nutze die Importwerkzeuge unten.')}</p>
              </div>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-1.5 px-3 pb-3">
                {items.map((item, index) => (
                  <li key={index} className="flex flex-wrap items-center gap-1.5 rounded-[14px] bg-well p-1.5">
                    <input className="input input-on-card min-w-0 flex-[1_1_160px] font-medium" aria-label={l(lang, 'Source term', 'Terme source', 'Término de origen', 'Ausgangsbegriff')} value={item.source} onChange={(event) => onItemChange(index, 'source', event.target.value)} placeholder={l(lang, 'Original term', 'Terme original', 'Término original', 'Originalbegriff')} />
                    <ArrowRight className="size-3.5 flex-none text-sec" aria-hidden="true" />
                    <input className="input input-on-card min-w-0 flex-[1_1_160px] font-medium" aria-label={l(lang, 'Target translation', 'Traduction cible', 'Traducción de destino', 'Zielübersetzung')} value={item.target} onChange={(event) => onItemChange(index, 'target', event.target.value)} placeholder={l(lang, 'Preferred translation', 'Traduction retenue', 'Traducción preferida', 'Bevorzugte Übersetzung')} />
                    <input className="input min-w-0 flex-[2_1_200px] !bg-transparent text-sec" aria-label={l(lang, 'Instruction', 'Directive', 'Instrucción', 'Anweisung')} value={item.note || ''} onChange={(event) => onItemChange(index, 'note', event.target.value)} placeholder={l(lang, 'Optional instruction', 'Consigne optionnelle', 'Instrucción opcional', 'Optionale Anweisung')} />
                    <button type="button" className="icon-btn is-plain" onClick={() => onRemoveItem(index)} aria-label={l(lang, 'Delete row', 'Supprimer la ligne', 'Eliminar fila', 'Zeile löschen')}>
                      <X aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </form>

          <section aria-labelledby="bulk-title" className="card">
            <div className="flex flex-wrap items-center justify-between gap-2.5 py-3.5 pl-6 pr-3.5">
              <div>
                <h2 id="bulk-title" className="section-title">{l(lang, 'Add multiple terms', 'Ajouter plusieurs termes', 'Añadir varios términos', 'Mehrere Begriffe hinzufügen')}</h2>
                <p className="m-0 mt-0.5 text-[13px] text-sec">{l(lang, 'Import a list or quickly prepare entries with the assistant.', 'Importez une liste ou préparez rapidement des entrées avec l’assistant.', 'Importa una lista o prepara entradas rápidamente con el asistente.', 'Importiere eine Liste oder bereite Einträge schnell mit dem Assistenten vor.')}</p>
              </div>
              <div className="seg" role="tablist" aria-label={l(lang, 'Add multiple terms', 'Ajouter plusieurs termes', 'Añadir varios términos', 'Mehrere Begriffe hinzufügen')}>
                {tools.map(([id, label]) => (
                  <button key={id} type="button" role="tab" aria-selected={activeTool === id} onClick={() => setActiveTool(activeTool === id ? null : id)}>{label}</button>
                ))}
              </div>
            </div>

            {activeTool === 'import' && (
              <div className="flex flex-col gap-2.5 px-6 pb-5">
                <label className="field">
                  <span className="field-label">{l(lang, 'One term per line: Source | Translation | Note', 'Une ligne par terme : Source | Traduction | Note', 'Un término por línea: Origen | Traducción | Nota', 'Ein Begriff pro Zeile: Ausgangstext | Übersetzung | Hinweis')}</span>
                  <textarea className="input" rows={5} value={pasteText} onChange={(event) => setPasteText(event.target.value)} placeholder={'Arthur Pendragon | Arthur Pendragon | Keep unchanged\nCamelot | Camelot | Kingdom name'} />
                </label>
                <div className="flex flex-wrap justify-between gap-2">
                  <input type="file" accept=".csv,.txt,.json" ref={fileInputRef} onChange={onFileUpload} className="sr-only" tabIndex={-1} aria-hidden="true" />
                  <button type="button" className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}><Upload aria-hidden="true" />{l(lang, 'Choose file', 'Choisir un fichier', 'Elegir archivo', 'Datei auswählen')} (TXT, CSV, JSON)</button>
                  <button type="button" className="btn btn-solid" disabled={!pasteText.trim()} onClick={onParsePaste}>{l(lang, 'Add these terms', 'Ajouter ces termes', 'Añadir estos términos', 'Diese Begriffe hinzufügen')}</button>
                </div>
              </div>
            )}

            {activeTool === 'prompt' && (
              <div className="flex flex-col gap-2.5 px-6 pb-5">
                <p className="m-0 text-[13px] text-sec">{l(lang, 'Copy this prompt with a document excerpt to extract its terminology automatically.', 'Copiez ce prompt avec un extrait du document pour extraire automatiquement sa terminologie.', 'Copia este prompt junto con un fragmento del documento para extraer automáticamente su terminología.', 'Kopiere diesen Prompt zusammen mit einem Dokumentauszug, um dessen Terminologie automatisch zu extrahieren.')}</p>
                <pre className="well m-0 max-h-64 overflow-auto whitespace-pre-wrap px-4 py-3.5 font-sans text-[13px] leading-relaxed">{aiPrompt}</pre>
                <div>
                  <button type="button" className="btn btn-secondary" onClick={onCopyPrompt}>
                    {copiedPrompt ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                    {copiedPrompt ? l(lang, 'Copied', 'Copié', 'Copiado', 'Kopiert') : l(lang, 'Copy prompt', 'Copier le prompt', 'Copiar prompt', 'Prompt kopieren')}
                  </button>
                </div>
              </div>
            )}

            {activeTool === 'guide' && (
              <ol className="m-0 flex flex-col gap-2 px-6 pb-5 pl-11 text-[14px]">
                {guide.map(([title, text]) => (
                  <li key={title}><strong className="font-semibold">{title}</strong> — {text}</li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
