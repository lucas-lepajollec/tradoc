import React, { useEffect, useRef, useState } from 'react';
import { fetchGlossaries, fetchGlossary, saveGlossary, deleteGlossary } from '../api';
import { l } from '../i18n/translations';
import GlossaryWorkspace from './GlossaryWorkspace';

const aiMasterPrompt = (lang) => l(lang,
  `You are an editorial assistant specializing in literary translation.
Analyze the document excerpt below and extract proper names (characters, fictional places, organizations, and artifacts) together with recurring domain-specific terms.

REQUIRED output format (one entry per line, separated by "|"):
Source term | Recommended translation | Note or rule

Example:
Arthur Pendragon | Arthur Pendragon | Keep unchanged
Camelot | Camelot | Kingdom name; keep unchanged
Excalibur | Excalibur | Mythical sword

Rules:
1. If a proper name must not be translated, repeat the source term exactly.
2. Preserve the original capitalization.
3. Add no introduction or conclusion. Return only lines in the required format.

Document excerpt:
[PASTE THE EXCERPT HERE]`,
  `Vous êtes un assistant éditorial spécialisé en traduction littéraire.
Analysez l’extrait ci-dessous et extrayez les noms propres (personnages, lieux fictifs, organisations et artefacts), ainsi que les termes récurrents propres au document.

Format de sortie OBLIGATOIRE (une entrée par ligne, séparée par « | ») :
Terme source | Traduction conseillée | Note ou règle

Exemple :
Arthur Pendragon | Arthur Pendragon | Conserver à l’identique
Camelot | Camelot | Nom du royaume ; conserver à l’identique
Excalibur | Excalibur | Épée mythique

Règles :
1. Si un nom propre ne doit pas être traduit, répétez exactement le terme source.
2. Conservez la casse d’origine.
3. N’ajoutez ni introduction ni conclusion. Renvoyez uniquement les lignes au format demandé.

Extrait du document :
[COLLEZ L’EXTRAIT ICI]`,
  `Eres un asistente editorial especializado en traducción literaria.
Analiza el fragmento siguiente y extrae los nombres propios (personajes, lugares ficticios, organizaciones y artefactos), además de los términos recurrentes específicos del documento.

Formato de salida OBLIGATORIO (una entrada por línea, separada por "|"):
Término de origen | Traducción recomendada | Nota o regla

Ejemplo:
Arthur Pendragon | Arthur Pendragon | Mantener sin cambios
Camelot | Camelot | Nombre del reino; mantener sin cambios
Excalibur | Excalibur | Espada mítica

Reglas:
1. Si un nombre propio no debe traducirse, repite exactamente el término de origen.
2. Conserva las mayúsculas y minúsculas originales.
3. No añadas introducción ni conclusión. Devuelve únicamente líneas con el formato indicado.

Fragmento del documento:
[PEGA AQUÍ EL FRAGMENTO]`,
  `Du bist ein redaktioneller Assistent mit Schwerpunkt auf literarischer Übersetzung.
Analysiere den folgenden Dokumentauszug und extrahiere Eigennamen (Figuren, fiktive Orte, Organisationen und Artefakte) sowie wiederkehrende Fachbegriffe.

VERBINDLICHES Ausgabeformat (ein Eintrag pro Zeile, durch „|“ getrennt):
Ausgangsbegriff | Empfohlene Übersetzung | Hinweis oder Regel

Beispiel:
Arthur Pendragon | Arthur Pendragon | Unverändert lassen
Camelot | Camelot | Name des Königreichs; unverändert lassen
Excalibur | Excalibur | Mythisches Schwert

Regeln:
1. Wenn ein Eigenname nicht übersetzt werden soll, wiederhole den Ausgangsbegriff exakt.
2. Bewahre die ursprüngliche Groß- und Kleinschreibung.
3. Füge weder Einleitung noch Schluss hinzu. Gib ausschließlich Zeilen im geforderten Format zurück.

Dokumentauszug:
[AUSZUG HIER EINFÜGEN]`);

export default function GlossaryManager({ lang = 'en' }) {
  const [glossaries, setGlossaries] = useState([]);
  const [selectedName, setSelectedName] = useState(null);
  const [nameInput, setNameInput] = useState('');
  const [descInput, setDescInput] = useState('');
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState(null);
  const [activeTool, setActiveTool] = useState('import');
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => { loadGlossaryList(); }, []);

  const loadGlossaryList = async () => {
    try {
      const list = await fetchGlossaries();
      setGlossaries(list);
      if (list.length > 0 && !selectedName) await loadSingleGlossary(list[0]);
    } catch (error) { console.error(error); }
  };

  const loadSingleGlossary = async (name) => {
    try {
      const glossary = await fetchGlossary(name);
      setSelectedName(glossary.name);
      setNameInput(glossary.name);
      setDescInput(glossary.description || '');
      setItems(glossary.items || []);
    } catch (error) { console.error(error); }
  };

  const handleCreateNew = () => {
    setSelectedName(null);
    setNameInput('new_glossary');
    setDescInput(l(lang, 'Glossary for proper names and unique terms', 'Glossaire pour les noms propres et les termes uniques', 'Glosario para nombres propios y términos únicos', 'Glossar für Eigennamen und besondere Begriffe'));
    setItems([{ source: 'Arthur Pendragon', target: 'Arthur Pendragon', category: 'name', note: l(lang, 'Keep unchanged', 'Conserver à l’identique', 'Mantener sin cambios', 'Unverändert lassen') }]);
  };

  const handleAddItem = () => setItems((current) => [...current, { source: '', target: '', category: 'general', note: '' }]);
  const handleRemoveItem = (index) => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  const handleItemChange = (index, field, value) => setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));

  const handleSave = async (event) => {
    event?.preventDefault();
    if (!nameInput) return;
    try {
      await saveGlossary({ name: nameInput, description: descInput, items: items.filter((item) => item.source.trim() !== '') });
      setMessage(l(lang, 'Glossary saved successfully.', 'Glossaire enregistré.', 'Glosario guardado correctamente.', 'Glossar erfolgreich gespeichert.'));
      await loadGlossaryList();
      setSelectedName(nameInput);
      setTimeout(() => setMessage(null), 3000);
    } catch (error) { window.alert(error.message); }
  };

  const handleDelete = async (name) => {
    if (!window.confirm(l(lang, `Delete the “${name}” glossary?`, `Supprimer le glossaire « ${name} » ?`, `¿Eliminar el glosario “${name}”?`, `Glossar „${name}“ löschen?`))) return;
    try {
      await deleteGlossary(name);
      setSelectedName(null);
      await loadGlossaryList();
    } catch (error) { window.alert(error.message); }
  };

  const handleCopyPrompt = async () => {
    await navigator.clipboard.writeText(aiMasterPrompt(lang));
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const handleParseBatchPaste = () => {
    if (!pasteText.trim()) return;
    const parsedItems = pasteText.split('\n').flatMap((rawLine) => {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) return [];
      const separator = line.includes('|') ? '|' : line.includes('->') ? '->' : line.includes(',') ? ',' : null;
      const parts = separator ? line.split(separator).map((part) => part.trim()) : [line];
      const source = parts[0] || '';
      return source ? [{ source, target: parts[1] || source, category: 'general', note: parts[2] || '' }] : [];
    });
    if (parsedItems.length === 0) return;
    setItems((current) => [...current, ...parsedItems]);
    setPasteText('');
    setActiveTool(null);
    setMessage(l(lang, `${parsedItems.length} ${parsedItems.length === 1 ? 'term added' : 'terms added'}.`, `${parsedItems.length} ${parsedItems.length > 1 ? 'termes ajoutés' : 'terme ajouté'}.`, `${parsedItems.length} ${parsedItems.length === 1 ? 'término añadido' : 'términos añadidos'}.`, `${parsedItems.length} ${parsedItems.length === 1 ? 'Begriff hinzugefügt' : 'Begriffe hinzugefügt'}.`));
    setTimeout(() => setMessage(null), 4000);
  };

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ({ target }) => {
      if (file.name.endsWith('.json')) {
        try {
          const parsed = JSON.parse(target.result);
          const importedItems = Array.isArray(parsed) ? parsed : parsed.items;
          if (!Array.isArray(importedItems)) throw new Error('invalid_shape');
          setItems((current) => [...current, ...importedItems]);
          setMessage(l(lang, 'JSON terms imported successfully.', 'Termes JSON importés.', 'Términos JSON importados correctamente.', 'JSON-Begriffe erfolgreich importiert.'));
          setTimeout(() => setMessage(null), 3000);
        } catch {
          window.alert(l(lang, 'The JSON file could not be read.', 'Impossible de lire le fichier JSON.', 'No se ha podido leer el archivo JSON.', 'Die JSON-Datei konnte nicht gelesen werden.'));
        }
      } else {
        setPasteText(target.result);
        setActiveTool('import');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return <GlossaryWorkspace
    lang={lang} glossaries={glossaries} selectedName={selectedName}
    nameInput={nameInput} setNameInput={setNameInput} descInput={descInput} setDescInput={setDescInput}
    items={items} message={message} activeTool={activeTool} setActiveTool={setActiveTool}
    copiedPrompt={copiedPrompt} pasteText={pasteText} setPasteText={setPasteText}
    fileInputRef={fileInputRef} aiPrompt={aiMasterPrompt(lang)} onCreate={handleCreateNew}
    onSelect={loadSingleGlossary} onDelete={handleDelete} onCopyPrompt={handleCopyPrompt}
    onFileUpload={handleFileUpload} onParsePaste={handleParseBatchPaste} onAddItem={handleAddItem}
    onItemChange={handleItemChange} onRemoveItem={handleRemoveItem} onSave={handleSave}
  />;
}
