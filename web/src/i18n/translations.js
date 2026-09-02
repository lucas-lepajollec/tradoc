export const AVAILABLE_LANGUAGES = [
  { code: 'en', label: 'Anglais (EN)', labelEn: 'English (EN)', flag: '🇬🇧' },
  { code: 'fr', label: 'Français (FR)', labelEn: 'French (FR)', flag: '🇫🇷' },
  { code: 'es', label: 'Espagnol (ES)', labelEn: 'Spanish (ES)', flag: '🇪🇸' },
  { code: 'de', label: 'Allemand (DE)', labelEn: 'German (DE)', flag: '🇩🇪' },
  { code: 'it', label: 'Italien (IT)', labelEn: 'Italian (IT)', flag: '🇮🇹' },
  { code: 'pt', label: 'Portugais (PT)', labelEn: 'Portuguese (PT)', flag: '🇵🇹' },
  { code: 'ja', label: 'Japonais (JA)', labelEn: 'Japanese (JA)', flag: '🇯🇵' },
  { code: 'zh', label: 'Chinois (ZH)', labelEn: 'Chinese (ZH)', flag: '🇨🇳' },
  { code: 'ko', label: 'Coréen (KO)', labelEn: 'Korean (KO)', flag: '🇰🇷' },
  { code: 'ru', label: 'Russe (RU)', labelEn: 'Russian (RU)', flag: '🇷🇺' },
  { code: 'nl', label: 'Néerlandais (NL)', labelEn: 'Dutch (NL)', flag: '🇳🇱' },
  { code: 'pl', label: 'Polonais (PL)', labelEn: 'Polish (PL)', flag: '🇵🇱' },
  { code: 'auto', label: 'Auto-détection', labelEn: 'Auto-Detect', flag: '🌐' },
];

export const INTERFACE_LANGUAGES = ['en', 'fr', 'es', 'de'];

const NUMBER_LOCALES = { en: 'en-US', fr: 'fr-FR', es: 'es-ES', de: 'de-DE' };

export function localeTag(lang) {
  return NUMBER_LOCALES[lang] || NUMBER_LOCALES.en;
}

export function l(lang, en, fr, es, de, params = {}) {
  let text = ({ en, fr, es, de }[lang] || en);
  for (const [key, value] of Object.entries(params)) {
    text = text.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return text;
}

const DOCUMENT_LANGUAGE_NAMES = {
  en: { en: 'English', fr: 'French', es: 'Spanish', de: 'German', it: 'Italian', pt: 'Portuguese', ja: 'Japanese', zh: 'Chinese', ko: 'Korean', ru: 'Russian', nl: 'Dutch', pl: 'Polish', auto: 'Auto-detect' },
  fr: { en: 'Anglais', fr: 'Français', es: 'Espagnol', de: 'Allemand', it: 'Italien', pt: 'Portugais', ja: 'Japonais', zh: 'Chinois', ko: 'Coréen', ru: 'Russe', nl: 'Néerlandais', pl: 'Polonais', auto: 'Détection automatique' },
  es: { en: 'Inglés', fr: 'Francés', es: 'Español', de: 'Alemán', it: 'Italiano', pt: 'Portugués', ja: 'Japonés', zh: 'Chino', ko: 'Coreano', ru: 'Ruso', nl: 'Neerlandés', pl: 'Polaco', auto: 'Detección automática' },
  de: { en: 'Englisch', fr: 'Französisch', es: 'Spanisch', de: 'Deutsch', it: 'Italienisch', pt: 'Portugiesisch', ja: 'Japanisch', zh: 'Chinesisch', ko: 'Koreanisch', ru: 'Russisch', nl: 'Niederländisch', pl: 'Polnisch', auto: 'Automatisch erkennen' },
};

export function languageLabel(code, lang) {
  return DOCUMENT_LANGUAGE_NAMES[lang]?.[code] || DOCUMENT_LANGUAGE_NAMES.en[code] || code.toUpperCase();
}

export const translations = {
  en: {
    meta: {
      title: 'TraDoc — Structured document translation',
      description: 'Translate long documents while preserving structure, terminology, context, and resumable progress.',
    },
    // Sidebar & Common Navigation
    nav: {
      appName: 'TraDoc',
      appSubtitle: 'AI Literary Translation',
      projects: 'Dashboard',
      inspector: 'Inspector & Tracking',
      vram: 'Estimator',
      sandbox: 'Test',
      glossaries: 'Glossary',
      settings: 'Settings',
      presets: 'Preset Profiling',
      presetSelect: 'Select Config Preset',
      defaultPreset: 'Default Preset',
      serverStatus: 'LLM Server',
      gpuOnline: 'GPU Online',
      gpuOffline: 'GPU Offline',
      unreachableBanner: 'GPU Server unreachable:',
      checkServerUrl: 'Check server at',
      configureIp: 'Configure IP',
    },

    // Dashboard / Main Upload View
    dashboard: {
      importBook: 'Import a Book',
      dragDropText: 'Drag & drop your file here or click to browse',
      supportedFormats: 'EPUB or PDF file',
      formatBadge: 'EPUB / PDF',
      translationMode: 'Translation Mode',
      proofreadMode: 'Proofreading & Editorial Pass Mode',
      // Upload & Import Card
      importTitle: 'Import a Document',
      importSubtitle: 'Drag and drop your EPUB, PDF, DOCX, MD, or TXT file',
      dropHere: 'Drop your document here or click to browse',
      allowedFormats: 'EPUB, PDF, DOCX, Markdown (.md) or Text (.txt) files',
      proofreadSourcePrompt: 'Select an existing project or upload a file for the editorial pass:',
      sourceProject: 'Source Project for Editorial Pass',
      uploadNewFile: 'Upload a New File',
      llmModel: 'LLM Model',
      literaryGlossary: 'Literary Glossary',
      noGlossary: 'No glossary',
      analyzing: 'Analyzing document...',
      startTranslation: 'Start Translation',
      startProofreading: 'Start Editorial Pass',
      prepareInspect: 'Prepare & Inspect (Without Running)',
      recentProjects: 'Saved Projects',
      noProjectsYet: 'No active or completed projects found.',
      paused: 'PAUSED',
      completed: 'COMPLETED',
      processing: 'PROCESSING',
      failed: 'FAILED',
      resume: 'Resume',
      pause: 'Pause',
      inspect: 'Inspect',
      downloadEpub: 'EPUB',
      deleteProject: 'Delete Project',
      confirmDelete: 'Permanently delete project "{title}"?',

      // Server Parameters Box
      serverParams: 'Server Parameters',
      provider: 'Provider',
      model: 'Active Model',
      concurrency: 'Concurrency',
      semanticWindow: 'Semantic Window',
      requestsUnit: 'requests',
      tokensUnit: 'tokens',
      editConfig: 'Modify Configuration',

      // Live Tester Widget
      liveTester: 'Live Tester',
      liveTesterDesc: 'Test your sentences and model in 2 seconds without importing a book.',
      openSandbox: 'Open Sandbox',
    },

    // Jobs Inspector & Split Visualizer
    inspector: {
      title: 'Segment Inspector',
      selectProjectPrompt: 'Select a project from the left panel to inspect segments in real time.',
      projectsList: 'Book Projects',
      modeTranslation: 'Translation',
      modeProofread: 'Proofreading',
      segment: 'Segment',
      originalText: 'Original text (source)',
      targetText: 'Target translation (pass 1)',
      proofreadText: 'Editorial Proofread Output (Pass 2)',
      liveSseLogs: 'Live Server-Sent Events (SSE) Stream',
      noLogsYet: 'Waiting for stream logs...',
      copyText: 'Copy',
      copied: 'Copied!',
      reorderNotice: 'Double click on any segment to edit target text directly.',
    },

    // Glossary Manager
    glossary: {
      title: 'Literary Glossaries',
      desc: 'Maintain strict terminology, character names, and universe consistency.',
      aiPromptTitle: '1. AI Prompt Assistant',
      aiPromptDesc: 'Generate a clean glossary from your book using a single AI prompt.',
      copyPromptBtn: 'Copy AI Extraction Prompt',
      promptCopied: 'Prompt copied to clipboard!',

      pasteImportTitle: '2. Import / Paste Glossary Data',
      pasteImportDesc: 'Paste terms generated by your AI (Format: Original | Target | Note) or upload a text file.',
      pastePlaceholder: 'Character_Name | Nom_Français | Note or directive...',
      insertInList: 'Insert into Glossary Below',
      uploadFileBtn: 'Upload Glossary File',

      manualGuideTitle: '3. Manual Creation Guide',
      manualGuideDesc: 'How to build and format your own literary glossary.',
      manualStep1: 'Use 1 line per term with exact spelling.',
      manualStep2: 'Include notes for context (e.g., gender, title, formal vs informal).',

      termsList: 'Glossary Terms Table',
      sourceTerm: 'Source term',
      targetTerm: 'Target translation',
      noteDirective: 'Note / Editorial Directive',
      action: 'Action',
      addNewTerm: 'Add New Term',
      searchPlaceholder: 'Search glossary terms...',
      noTermsFound: 'No glossary terms defined yet.',
      confirmDeleteTerm: 'Delete term "{term}"?',
      saveGlossary: 'Save Glossary',
      savedSuccess: 'Glossary saved successfully!',
    },

    // Test Sandbox Modal
    sandbox: {
      title: 'Live Sandbox & Prompt Preview',
      desc: 'Test your active LLM model on custom literary excerpts before running large translation jobs.',
      sourceInputLabel: 'Source Excerpt (EN)',
      resultOutputLabel: 'Model Output (FR)',
      sampleText: 'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.',
      runInference: 'Run Test Inference',
      runningInference: 'Processing inference...',
      resetExcerpt: 'Reset Sample Text',
      copyResult: 'Copy Translation',
    },

    // Setup Wizard / VRAM Cost Estimator
    wizard: {
      title: 'VRAM & Processing Cost Estimator',
      desc: 'Calculate token consumption, GPU VRAM requirements, and API costs.',
      executionEnv: '1. Execution Environment',
      localServer: 'Local GPU Server',
      localDesc: 'Ollama, LM Studio, Qwen 3.5',
      localBadge: '100% Free & Private',
      cloudApi: 'Online Cloud API',
      cloudDesc: 'DeepSeek, OpenAI, Claude',
      cloudBadge: 'High Speed by Chapters',
      activeBadge: 'Active',
      bookSizeTitle: '2. Book Size',
      pagesUnit: 'pages',
      novella: 'Novella (50 p.)',
      novel: 'Novel (300 p.)',
      thickBook: 'Thick Book (800 p.)',
      fullSeries: 'Full Series (2500 p.)',
      fineTuningTitle: '3. Fine Tuning & API Prices',
      chunkSize: 'Chunk Size (Tokens)',
      concurrencySlots: 'Concurrency (Slots)',
      inputPrice: 'Input Price ($/1M tks)',
      outputPrice: 'Output Price ($/1M tks)',
      enableCaching: 'Enable Prompt Caching discount (-90%)',
      resultsTitle: 'Results & Projections',
      chunksUnit: 'chunks',
      estimatedVolume: 'Estimated volume:',
      totalTokens: 'Total Tokens:',
      estimatedCost: 'Estimated Book Cost',
      freeLocal: '100% Free on your GPU',
      officialApi: 'Official API pricing (${inPrice} in / ${outPrice} out)',
      cachingSavings: 'Prompt Caching savings: -${savings}',
      localAdvice: 'Ideal setting to preserve GPU VRAM and maintain smooth literary quality.',
      cloudAdvice: 'Large text blocks with Prompt Caching active for ultra-fast chapter translation.',
      disclaimer: '* Note: These figures are estimates based on standard literary averages (~275 words/page).',
      applySettings: 'Apply these settings to project',
    },

    // Settings Refactored View
    settings: {
      title: 'GPU & LLM Engine Configuration',
      subtitle: 'Manage your API providers, models, translation parameters, and application preferences.',

      // Internal Sidebar Tabs
      tabProviders: 'Providers & Models',
      tabTranslation: 'Translation Engine',
      tabGlobal: 'Global & Language',
      tabPresets: 'Config Presets',

      // Providers Tab
      chooseProvider: 'Choose LLM Provider',
      apiKey: 'Provider API Key',
      apiKeyPlaceholder: 'sk-...',
      notRequired: 'Not required for local hosting',
      activeModel: 'Active Model',
      detectingModels: 'Detecting models...',
      searchModelPlaceholder: 'Filter or search model...',
      customEndpoint: 'Endpoint URL',
      testConnection: 'Test Connection',
      testingConnection: 'Testing connection...',
      connectionSuccess: 'Connection successful!',
      connectionFailed: 'Connection failed',

      // Translation Engine Tab
      chunkSizeLabel: 'Segment Chunk Size ({count} tokens)',
      chunkSizeAdvice: 'Local: 500–2,500 (recommended 1,000) | Cloud: 2,500–10,000 (recommended 7,000)',
      temperatureLabel: 'Temperature ({val})',
      temperatureAdvice: 'Recommended: 0.15 for precise literary translation',
      concurrencyLabel: 'Max Concurrency ({val} requests)',
      concurrencyAdvice: 'Local: 1-4 | Cloud API: 8-16',
      proofreadingTitle: 'Editorial Proofreading Pass (Pass 2)',
      proofreadingBadge: 'Pro Quality (99%)',
      proofreadingDesc: 'Runs a second editorial pass on each segment to correct transfer errors and refine style in the target language.',
      systemPromptTitle: 'System Prompt Presets',
      systemPromptDesc: 'Customize the instructions sent to the LLM for translation.',
      customPresetName: 'New preset name...',
      createPresetBtn: 'Create Preset',

      // Global Tab
      languageTitle: 'Application Interface Language',
      languageDesc: 'Choose the display language for the TraDoc interface.',
      langEnglish: 'English (Default)',
      langFrench: 'Français',
      langSpanish: 'Español',
      langGerman: 'Deutsch',

      // Presets Manager Tab
      presetsManagerTitle: 'Configuration Profiles & Presets',
      presetsManagerDesc: 'Save complete snapshots of your provider, model, API keys, and translation settings.',
      saveCurrentAsPreset: 'Save Current Config as New Preset',
      presetNamePlaceholder: 'Preset Name (e.g. DeepSeek Cloud Fast)',
      savePresetBtn: 'Save Profile Preset',
      savedPresetsList: 'Saved Config Presets',
      activatePresetBtn: 'Activate',
      activeBadge: 'ACTIVE',
      deletePresetBtn: 'Delete Preset',
      confirmDeletePreset: 'Delete preset profile "{name}"?',
      
      saveAllSettings: 'Save All Settings',
      saveAllSuccess: 'Configuration saved successfully!',
    }
  },

  fr: {
    meta: {
      title: 'TraDoc — Traduction structurée de documents',
      description: 'Traduisez de longs documents en préservant leur structure, leur terminologie, leur contexte et la reprise du travail.',
    },
    // Sidebar & Navigation Commune
    nav: {
      appName: 'TraDoc',
      appSubtitle: 'Traduction Littéraire IA',
      projects: 'Dashboard',
      inspector: 'Inspecteur & Suivi',
      vram: 'Estimateur',
      sandbox: 'Test',
      glossaries: 'Glossaire',
      settings: 'Paramètres',
      presets: 'Profils Presets',
      presetSelect: 'Sélectionner un Preset',
      defaultPreset: 'Preset par défaut',
      serverStatus: 'Serveur LLM',
      gpuOnline: 'GPU En ligne',
      gpuOffline: 'GPU Hors-ligne',
      unreachableBanner: 'Serveur GPU injoignable :',
      checkServerUrl: 'Vérifiez le serveur sur',
      configureIp: 'Configurer IP',
    },

    // Dashboard / Vue d'importation
    dashboard: {
      importTitle: 'Importer un document',
      importSubtitle: 'Glissez-déposez votre fichier EPUB, PDF, DOCX, MD ou TXT',
      dropHere: 'Déposez votre document ici ou cliquez pour choisir',
      allowedFormats: 'Fichiers EPUB, PDF, DOCX, Markdown (.md) ou Texte (.txt)',
      importBook: 'Importer un livre',
      dragDropText: 'Déposez votre livre ici ou cliquez pour choisir',
      supportedFormats: 'Fichier EPUB ou PDF littéraire',
      formatBadge: 'EPUB / PDF',
      translationMode: 'Mode Traduction',
      proofreadMode: 'Mode Relecture Éditoriale',
      proofreadSourcePrompt: 'Sélectionnez un projet existant ou chargez le fichier pour la passe d\'édition :',
      sourceProject: 'Projet Source pour la Passe Éditoriale',
      uploadNewFile: 'Charger un Nouveau Fichier',
      llmModel: 'Modèle LLM',
      literaryGlossary: 'Glossaire Littéraire',
      noGlossary: 'Aucun glossaire',
      analyzing: 'Analyse du document en cours...',
      startTranslation: 'Démarrer la Traduction',
      startProofreading: 'Démarrer la Relecture Éditoriale',
      prepareInspect: 'Préparer & Inspecter (Sans lancer)',
      recentProjects: 'Projets enregistrés',
      noProjectsYet: 'Aucun projet actif ou terminé.',
      paused: 'EN PAUSE',
      completed: 'TERMINÉ',
      processing: 'EN COURS',
      failed: 'ÉCHOUÉ',
      resume: 'Reprendre',
      pause: 'Pause',
      inspect: 'Inspecter',
      downloadEpub: 'EPUB',
      deleteProject: 'Supprimer le Projet',
      confirmDelete: 'Supprimer définitivement le projet "{title}" ?',

      // Bloc Paramètres du Serveur
      serverParams: 'Paramètres du Serveur',
      provider: 'Fournisseur',
      model: 'Modèle Actif',
      concurrency: 'Concurrence',
      semanticWindow: 'Fenêtre Sémantique',
      requestsUnit: 'requêtes',
      tokensUnit: 'tokens',
      editConfig: 'Modifier la configuration',

      // Module Testeur en Direct
      liveTester: 'Testeur en Direct',
      liveTesterDesc: 'Testez vos phrases et votre modèle en 2 secondes sans importer de livre.',
      openSandbox: 'Ouvrir le Bac à Sable',
    },

    // Inspecteur de Segments
    inspector: {
      title: 'Inspecteur de Segment',
      selectProjectPrompt: 'Sélectionnez un projet dans le panneau de gauche pour inspecter les segments en temps réel.',
      projectsList: 'Livres & Projets',
      modeTranslation: 'Traduction',
      modeProofread: 'Relecture',
      segment: 'Segment',
      originalText: 'Texte original (source)',
      targetText: 'Traduction cible (passe 1)',
      proofreadText: 'Rendu Relecture Éditoriale (Passe 2)',
      liveSseLogs: 'Journal des Événements SSE en Direct',
      noLogsYet: 'En attente du flux de logs...',
      copyText: 'Copier',
      copied: 'Copié !',
      reorderNotice: 'Double-cliquez sur n\'importe quel segment pour modifier la traduction directement.',
    },

    // Gestionnaire de Glossaires
    glossary: {
      title: 'Glossaires Littéraires',
      desc: 'Maintenez une terminologie stricte, des noms propres et une cohérence d\'univers.',
      aiPromptTitle: '1. Assistant Prompt IA',
      aiPromptDesc: 'Générez un glossaire propre depuis votre livre avec un prompt IA prêt à l\'emploi.',
      copyPromptBtn: 'Copier le Prompt d\'Extraction IA',
      promptCopied: 'Prompt copié dans le presse-papier !',

      pasteImportTitle: '2. Coller / Importer un Glossaire',
      pasteImportDesc: 'Collez les lignes générées par l\'IA (format Original | Traduction | Note) ou chargez un fichier.',
      pastePlaceholder: 'Nom_Personnage | Translation_Française | Note ou directive...',
      insertInList: 'Insérer dans la liste ci-dessous',
      uploadFileBtn: 'Charger un Fichier Glossaire',

      manualGuideTitle: '3. Guide de Création Manuel',
      manualGuideDesc: 'Comment structurer votre propre glossaire littéraire.',
      manualStep1: 'Utilisez 1 ligne par terme avec l\'orthographe exacte.',
      manualStep2: 'Ajoutez des notes de contexte (genre, vouvoiement/tutoiement, titres).',

      termsList: 'Tableau des Termes du Glossaire',
      sourceTerm: 'Terme source',
      targetTerm: 'Traduction cible',
      noteDirective: 'Note / Directive Éditoriale',
      action: 'Action',
      addNewTerm: 'Ajouter un Terme',
      searchPlaceholder: 'Rechercher un terme...',
      noTermsFound: 'Aucun terme défini dans ce glossaire.',
      confirmDeleteTerm: 'Supprimer le terme "{term}" ?',
      saveGlossary: 'Enregistrer le Glossaire',
      savedSuccess: 'Glossaire enregistré avec succès !',
    },

    // Bac à Sable
    sandbox: {
      title: 'Bac à Sable & Aperçu en Direct',
      desc: 'Testez votre modèle LLM actif sur des extraits littéraires avant de lancer une traduction complète.',
      sourceInputLabel: 'Extrait Source (EN)',
      resultOutputLabel: 'Résultat du Modèle (FR)',
      sampleText: 'C\'est une vérité universellement reconnue qu\'un célibataire pourvu d\'une belle fortune doit avoir envie de se marier.',
      runInference: 'Lancer l\'Inférence de Test',
      runningInference: 'Traitement en cours...',
      resetExcerpt: 'Réinitialiser le Texte Exemple',
      copyResult: 'Copier la Traduction',
    },

    // Assistant de Coûts / VRAM
    wizard: {
      title: 'Calculateur VRAM & Estimation des Coûts',
      desc: 'Calculez la consommation de tokens, le besoin en mémoire VRAM GPU et les coûts API.',
      executionEnv: '1. Environnement d\'Exécution',
      localServer: 'Serveur GPU Local',
      localDesc: 'Ollama, LM Studio, Qwen 3.5',
      localBadge: '100% Gratuit & Privé',
      cloudApi: 'API Cloud en Ligne',
      cloudDesc: 'DeepSeek, OpenAI, Claude',
      cloudBadge: 'Haute Vitesse par Chapitres',
      activeBadge: 'Actif',
      bookSizeTitle: '2. Taille du Livre',
      pagesUnit: 'pages',
      novella: 'Nouvelle (50 p.)',
      novel: 'Roman (300 p.)',
      thickBook: 'Pavé (800 p.)',
      fullSeries: 'Intégrale (2500 p.)',
      fineTuningTitle: '3. Réglages Fins & Tarifs API',
      chunkSize: 'Taille de Chunk (Tokens)',
      concurrencySlots: 'Concurrence (Slots)',
      inputPrice: 'Prix Input ($/1M tks)',
      outputPrice: 'Prix Output ($/1M tks)',
      enableCaching: 'Activer la réduction Prompt Caching (-90%)',
      resultsTitle: 'Résultats & Projections',
      chunksUnit: 'chunks',
      estimatedVolume: 'Volume estimé :',
      totalTokens: 'Total Tokens :',
      estimatedCost: 'Coût Estimé du Livre',
      freeLocal: '100% Gratuit sur votre GPU',
      officialApi: 'Prix API officiel (${inPrice}$ in / ${outPrice}$ out)',
      cachingSavings: 'Économie Prompt Caching : -${savings}',
      localAdvice: 'Réglage idéal pour préserver la mémoire GPU et maintenir une excellente fluidité littéraire.',
      cloudAdvice: 'Grands blocs de texte avec Prompt Caching actif pour une traduction ultra-rapide par chapitres.',
      disclaimer: '* Note : Ces valeurs sont des estimations calculées sur des moyennes littéraires (~275 mots/page) et sont données à titre indicatif.',
      applySettings: 'Appliquer ces réglages au projet',
    },

    // Paramètres Refondus
    settings: {
      title: 'Configuration GPU & Moteur LLM',
      subtitle: 'Gérez vos fournisseurs API, modèles, paramètres de traduction et préférences globales.',

      // Onglets Sidebar Interne
      tabProviders: 'Fournisseurs & Modèles',
      tabTranslation: 'Moteur de Traduction',
      tabGlobal: 'Paramètres Globaux',
      tabPresets: 'Gestionnaire de Presets',

      // Onglet Providers
      chooseProvider: 'Choisir le Fournisseur LLM',
      apiKey: 'Clé API Fournisseur',
      apiKeyPlaceholder: 'sk-...',
      notRequired: 'Non requis pour l\'hébergement local',
      activeModel: 'Modèle Actif',
      detectingModels: 'Détection des modèles...',
      searchModelPlaceholder: 'Filtrer ou rechercher un modèle...',
      customEndpoint: 'Endpoint URL',
      testConnection: 'Tester la Connexion',
      testingConnection: 'Test de connexion...',
      connectionSuccess: 'Connexion réussie !',
      connectionFailed: 'Échec de la connexion',

      // Onglet Moteur de Traduction
      chunkSizeLabel: 'Taille du segment ({count} tokens)',
      chunkSizeAdvice: 'Local : 500–2 500 (recommandé 1 000) | Cloud : 2 500–10 000 (recommandé 7 000)',
      temperatureLabel: 'Température ({val})',
      temperatureAdvice: 'Recommandé : 0.15 pour une traduction littéraire précise',
      concurrencyLabel: 'Concurrence Max ({val} requêtes)',
      concurrencyAdvice: 'Local : 1-4 | Cloud API : 8-16',
      proofreadingTitle: 'Relecture & Correcteur Éditorial (Passe 2)',
      proofreadingBadge: 'Qualité Pro (99%)',
      proofreadingDesc: 'Exécute une seconde passe éditoriale sur chaque segment pour corriger les erreurs de transfert et affiner le style dans la langue cible.',
      systemPromptTitle: 'Presets de Prompt Système',
      systemPromptDesc: 'Personnalisez les instructions envoyées au LLM pour la traduction.',
      customPresetName: 'Nom du nouveau preset...',
      createPresetBtn: 'Créer le Preset',

      // Onglet Globaux
      languageTitle: 'Langue de l\'Interface de l\'Application',
      languageDesc: 'Choisissez la langue d\'affichage de l\'interface TraDoc.',
      langEnglish: 'English (Anglais par défaut)',
      langFrench: 'Français',
      langSpanish: 'Español',
      langGerman: 'Deutsch',

      // Onglet Presets Manager
      presetsManagerTitle: 'Profils de Configuration & Presets',
      presetsManagerDesc: 'Enregistrez des instantanés complets de votre fournisseur, modèle, clés API et paramètres de traduction.',
      saveCurrentAsPreset: 'Enregistrer la Config Actuelle comme Nouveau Preset',
      presetNamePlaceholder: 'Nom du Preset (ex: DeepSeek Cloud Rapide)',
      savePresetBtn: 'Enregistrer le Profil Preset',
      savedPresetsList: 'Presets de Config Enregistrés',
      activatePresetBtn: 'Activer',
      activeBadge: 'ACTIF',
      deletePresetBtn: 'Delete Preset',
      confirmDeletePreset: 'Supprimer le profil preset "{name}" ?',
      
      saveAllSettings: 'Enregistrer la Configuration',
      saveAllSuccess: 'Configuration enregistrée avec succès !',
    }
  },

  es: {
    meta: {
      title: 'TraDoc — Traducción estructurada de documentos',
      description: 'Traduce documentos largos conservando la estructura, la terminología, el contexto y el progreso reanudable.',
    },
    nav: {
      appName: 'TraDoc', appSubtitle: 'Traducción literaria con IA', projects: 'Panel', inspector: 'Inspector y seguimiento',
      vram: 'Estimador', sandbox: 'Prueba', glossaries: 'Glosario', settings: 'Ajustes', presets: 'Perfiles',
      presetSelect: 'Seleccionar perfil', defaultPreset: 'Perfil predeterminado', serverStatus: 'Servidor LLM',
      gpuOnline: 'GPU conectada', gpuOffline: 'GPU sin conexión', unreachableBanner: 'Servidor GPU inaccesible:',
      checkServerUrl: 'Comprueba el servidor en', configureIp: 'Configurar dirección',
    },
    dashboard: {
      importBook: 'Importar un libro', dragDropText: 'Arrastra el archivo aquí o haz clic para elegirlo',
      supportedFormats: 'Archivo EPUB o PDF', formatBadge: 'EPUB / PDF', translationMode: 'Modo traducción',
      proofreadMode: 'Modo de revisión editorial', proofreadSourcePrompt: 'Selecciona un proyecto o carga el archivo que quieres revisar:',
      sourceProject: 'Proyecto de origen para la revisión', importTitle: 'Importar un documento',
      importSubtitle: 'Arrastra un archivo EPUB, PDF, DOCX, MD o TXT', dropHere: 'Suelta el documento aquí o haz clic para elegirlo',
      allowedFormats: 'Archivos EPUB, PDF, DOCX, Markdown (.md) o texto (.txt)', uploadNewFile: 'Cargar un archivo nuevo',
      llmModel: 'Modelo LLM', literaryGlossary: 'Glosario literario', noGlossary: 'Sin glosario',
      analyzing: 'Analizando el documento…', startTranslation: 'Iniciar traducción', startProofreading: 'Iniciar revisión editorial',
      prepareInspect: 'Preparar e inspeccionar (sin ejecutar)', recentProjects: 'Proyectos guardados',
      noProjectsYet: 'No hay proyectos activos ni terminados.', paused: 'EN PAUSA', completed: 'TERMINADO',
      processing: 'EN CURSO', failed: 'FALLIDO', resume: 'Reanudar', pause: 'Pausar', inspect: 'Inspeccionar',
      downloadEpub: 'EPUB', deleteProject: 'Eliminar proyecto', confirmDelete: '¿Eliminar definitivamente el proyecto «{title}»?',
      serverParams: 'Parámetros del servidor', provider: 'Proveedor', model: 'Modelo activo', concurrency: 'Concurrencia',
      semanticWindow: 'Ventana semántica', requestsUnit: 'solicitudes', tokensUnit: 'tokens', editConfig: 'Modificar configuración',
      liveTester: 'Prueba en directo', liveTesterDesc: 'Prueba frases y el modelo en segundos sin importar un libro.',
      openSandbox: 'Abrir entorno de prueba',
    },
    inspector: {
      title: 'Inspector de segmentos', selectProjectPrompt: 'Selecciona un proyecto en el panel izquierdo para inspeccionar sus segmentos en tiempo real.',
      projectsList: 'Proyectos de libros', modeTranslation: 'Traducción', modeProofread: 'Revisión', segment: 'Segmento',
      originalText: 'Texto original', targetText: 'Traducción de destino (pasada 1)', proofreadText: 'Resultado de la revisión editorial (pasada 2)',
      liveSseLogs: 'Flujo de eventos del servidor (SSE)', noLogsYet: 'Esperando eventos…', copyText: 'Copiar', copied: 'Copiado',
      reorderNotice: 'Haz doble clic en un segmento para editar directamente el texto de destino.',
    },
    glossary: {
      title: 'Glosarios literarios', desc: 'Mantén una terminología, nombres propios y universo coherentes.',
      aiPromptTitle: '1. Asistente de prompt con IA', aiPromptDesc: 'Genera un glosario limpio a partir del libro con un único prompt.',
      copyPromptBtn: 'Copiar prompt de extracción', promptCopied: 'Prompt copiado al portapapeles',
      pasteImportTitle: '2. Importar o pegar datos', pasteImportDesc: 'Pega términos generados por IA (Original | Destino | Nota) o carga un archivo de texto.',
      pastePlaceholder: 'Nombre_personaje | Traducción_elegida | Nota o directiva…', insertInList: 'Insertar en el glosario',
      uploadFileBtn: 'Cargar archivo de glosario', manualGuideTitle: '3. Guía de creación manual',
      manualGuideDesc: 'Cómo crear y dar formato a un glosario literario.', manualStep1: 'Usa una línea por término con su grafía exacta.',
      manualStep2: 'Añade notas de contexto: género, título, registro formal o informal.', termsList: 'Tabla de términos',
      sourceTerm: 'Término de origen', targetTerm: 'Traducción de destino', noteDirective: 'Nota o directiva editorial',
      action: 'Acción', addNewTerm: 'Añadir término', searchPlaceholder: 'Buscar términos…', noTermsFound: 'Todavía no hay términos definidos.',
      confirmDeleteTerm: '¿Eliminar el término «{term}»?', saveGlossary: 'Guardar glosario', savedSuccess: 'Glosario guardado correctamente',
    },
    sandbox: {
      title: 'Entorno de prueba y vista del prompt', desc: 'Prueba el modelo LLM activo con fragmentos literarios antes de iniciar un trabajo largo.',
      sourceInputLabel: 'Fragmento de origen', resultOutputLabel: 'Resultado del modelo',
      sampleText: 'Es una verdad universalmente reconocida que un hombre soltero, poseedor de una gran fortuna, necesita esposa.',
      runInference: 'Ejecutar prueba', runningInference: 'Procesando…', resetExcerpt: 'Restablecer texto de ejemplo', copyResult: 'Copiar traducción',
    },
    wizard: {
      title: 'Estimador de VRAM y coste', desc: 'Calcula el consumo de tokens, la VRAM necesaria y los costes de API.',
      executionEnv: '1. Entorno de ejecución', localServer: 'Servidor GPU local', localDesc: 'Ollama, LM Studio, Qwen 3.5',
      localBadge: 'Gratis y privado', cloudApi: 'API en la nube', cloudDesc: 'DeepSeek, OpenAI, Claude',
      cloudBadge: 'Alta velocidad por capítulos', activeBadge: 'Activo', bookSizeTitle: '2. Tamaño del libro', pagesUnit: 'páginas',
      novella: 'Novela corta (50 pág.)', novel: 'Novela (300 pág.)', thickBook: 'Libro extenso (800 pág.)',
      fullSeries: 'Serie completa (2500 pág.)', fineTuningTitle: '3. Ajustes y precios de API', chunkSize: 'Tamaño del segmento (tokens)',
      concurrencySlots: 'Concurrencia', inputPrice: 'Precio de entrada ($/1M tokens)', outputPrice: 'Precio de salida ($/1M tokens)',
      enableCaching: 'Aplicar descuento de caché de prompts (-90 %)', resultsTitle: 'Resultados y proyecciones', chunksUnit: 'segmentos',
      estimatedVolume: 'Volumen estimado:', totalTokens: 'Tokens totales:', estimatedCost: 'Coste estimado del libro',
      freeLocal: 'Sin coste de API en tu GPU', officialApi: 'Tarifa oficial (${inPrice} entrada / ${outPrice} salida)',
      cachingSavings: 'Ahorro por caché: -${savings}', localAdvice: 'Una configuración equilibrada para conservar VRAM y mantener la calidad literaria.',
      cloudAdvice: 'Segmentos grandes y caché de prompts para acelerar la traducción de capítulos.',
      disclaimer: '* Estimaciones basadas en una media literaria aproximada de 275 palabras por página.',
      applySettings: 'Aplicar estos ajustes al proyecto',
    },
    settings: {
      title: 'Configuración de GPU y motor LLM', subtitle: 'Gestiona proveedores, modelos, parámetros de traducción y preferencias.',
      tabProviders: 'Proveedores y modelos', tabTranslation: 'Motor de traducción', tabGlobal: 'General e idioma', tabPresets: 'Perfiles',
      chooseProvider: 'Elegir proveedor LLM', apiKey: 'Clave API del proveedor', apiKeyPlaceholder: 'sk-…',
      notRequired: 'No es necesaria para un servidor local', activeModel: 'Modelo activo', detectingModels: 'Detectando modelos…',
      searchModelPlaceholder: 'Filtrar o buscar modelo…', customEndpoint: 'URL del endpoint', testConnection: 'Probar conexión',
      testingConnection: 'Probando conexión…', connectionSuccess: 'Conexión correcta', connectionFailed: 'Error de conexión',
      chunkSizeLabel: 'Tamaño del segmento ({count} tokens)', chunkSizeAdvice: 'Local: 500–2500 (recomendado 1000) | Nube: 2500–10 000 (recomendado 7000)',
      temperatureLabel: 'Temperatura ({val})', temperatureAdvice: 'Recomendación: 0,15 para una traducción literaria precisa',
      concurrencyLabel: 'Concurrencia máxima ({val} solicitudes)', concurrencyAdvice: 'Local: 1–4 | API en la nube: 8–16',
      proofreadingTitle: 'Revisión editorial (pasada 2)', proofreadingBadge: 'Control adicional',
      proofreadingDesc: 'Ejecuta una segunda pasada editorial sobre cada segmento para corregir calcos y pulir el estilo en el idioma de destino.',
      systemPromptTitle: 'Perfiles de prompt de sistema', systemPromptDesc: 'Personaliza las instrucciones de traducción enviadas al modelo.',
      customPresetName: 'Nombre del perfil nuevo…', createPresetBtn: 'Crear perfil', languageTitle: 'Idioma de la interfaz',
      languageDesc: 'Elige el idioma de visualización de TraDoc.', langEnglish: 'English', langFrench: 'Français',
      langSpanish: 'Español', langGerman: 'Deutsch', presetsManagerTitle: 'Perfiles de configuración',
      presetsManagerDesc: 'Guarda instantáneas completas del proveedor, modelo y parámetros de traducción. Las claves API no se conservan en el navegador.',
      saveCurrentAsPreset: 'Guardar la configuración actual como perfil', presetNamePlaceholder: 'Nombre del perfil (p. ej., DeepSeek rápido)',
      savePresetBtn: 'Guardar perfil', savedPresetsList: 'Perfiles guardados', activatePresetBtn: 'Activar', activeBadge: 'ACTIVO',
      deletePresetBtn: 'Eliminar perfil', confirmDeletePreset: '¿Eliminar el perfil «{name}»?', saveAllSettings: 'Guardar ajustes',
      saveAllSuccess: 'Configuración guardada correctamente',
    },
  },

  de: {
    meta: {
      title: 'TraDoc — Strukturierte Dokumentübersetzung',
      description: 'Übersetze lange Dokumente und bewahre Struktur, Terminologie, Kontext und fortsetzbaren Fortschritt.',
    },
    nav: {
      appName: 'TraDoc', appSubtitle: 'Literarische KI-Übersetzung', projects: 'Übersicht', inspector: 'Inspektor und Fortschritt',
      vram: 'Schätzung', sandbox: 'Test', glossaries: 'Glossar', settings: 'Einstellungen', presets: 'Profile',
      presetSelect: 'Konfigurationsprofil wählen', defaultPreset: 'Standardprofil', serverStatus: 'LLM-Server',
      gpuOnline: 'GPU online', gpuOffline: 'GPU offline', unreachableBanner: 'GPU-Server nicht erreichbar:',
      checkServerUrl: 'Server prüfen unter', configureIp: 'Adresse konfigurieren',
    },
    dashboard: {
      importBook: 'Buch importieren', dragDropText: 'Datei hier ablegen oder zum Auswählen klicken', supportedFormats: 'EPUB- oder PDF-Datei',
      formatBadge: 'EPUB / PDF', translationMode: 'Übersetzungsmodus', proofreadMode: 'Redaktionelle Überarbeitung',
      proofreadSourcePrompt: 'Vorhandenes Projekt auswählen oder zu überarbeitende Datei hochladen:', sourceProject: 'Ausgangsprojekt der Überarbeitung',
      importTitle: 'Dokument importieren', importSubtitle: 'EPUB-, PDF-, DOCX-, MD- oder TXT-Datei ablegen',
      dropHere: 'Dokument hier ablegen oder zum Auswählen klicken', allowedFormats: 'EPUB, PDF, DOCX, Markdown (.md) oder Text (.txt)',
      uploadNewFile: 'Neue Datei hochladen', llmModel: 'LLM-Modell', literaryGlossary: 'Literarisches Glossar', noGlossary: 'Kein Glossar',
      analyzing: 'Dokument wird analysiert…', startTranslation: 'Übersetzung starten', startProofreading: 'Überarbeitung starten',
      prepareInspect: 'Vorbereiten und prüfen (nicht starten)', recentProjects: 'Gespeicherte Projekte', noProjectsYet: 'Keine aktiven oder abgeschlossenen Projekte.',
      paused: 'PAUSIERT', completed: 'ABGESCHLOSSEN', processing: 'IN ARBEIT', failed: 'FEHLGESCHLAGEN', resume: 'Fortsetzen',
      pause: 'Pausieren', inspect: 'Prüfen', downloadEpub: 'EPUB', deleteProject: 'Projekt löschen',
      confirmDelete: 'Projekt „{title}“ endgültig löschen?', serverParams: 'Serverparameter', provider: 'Anbieter', model: 'Aktives Modell',
      concurrency: 'Parallelität', semanticWindow: 'Semantisches Fenster', requestsUnit: 'Anfragen', tokensUnit: 'Tokens',
      editConfig: 'Konfiguration ändern', liveTester: 'Direkttest',
      liveTesterDesc: 'Teste Sätze und Modell in wenigen Sekunden, ohne ein Buch zu importieren.', openSandbox: 'Testumgebung öffnen',
    },
    inspector: {
      title: 'Segmentinspektor', selectProjectPrompt: 'Wähle links ein Projekt, um dessen Segmente in Echtzeit zu prüfen.',
      projectsList: 'Buchprojekte', modeTranslation: 'Übersetzung', modeProofread: 'Überarbeitung', segment: 'Segment',
      originalText: 'Ausgangstext', targetText: 'Zielübersetzung (Durchgang 1)', proofreadText: 'Redaktionelles Ergebnis (Durchgang 2)',
      liveSseLogs: 'Serverereignisse (SSE)', noLogsYet: 'Warte auf Ereignisse…', copyText: 'Kopieren', copied: 'Kopiert',
      reorderNotice: 'Doppelklicke auf ein Segment, um den Zieltext direkt zu bearbeiten.',
    },
    glossary: {
      title: 'Literarische Glossare', desc: 'Sichere konsistente Terminologie, Eigennamen und Weltbegriffe.',
      aiPromptTitle: '1. KI-Prompt-Assistent', aiPromptDesc: 'Erzeuge mit einem einzigen Prompt ein sauberes Glossar aus dem Buch.',
      copyPromptBtn: 'Extraktionsprompt kopieren', promptCopied: 'Prompt in die Zwischenablage kopiert',
      pasteImportTitle: '2. Daten importieren oder einfügen', pasteImportDesc: 'KI-Begriffe im Format Original | Ziel | Hinweis einfügen oder Textdatei laden.',
      pastePlaceholder: 'Figurenname | Gewählte_Übersetzung | Hinweis oder Vorgabe…', insertInList: 'In das Glossar übernehmen',
      uploadFileBtn: 'Glossardatei laden', manualGuideTitle: '3. Anleitung zur manuellen Erstellung',
      manualGuideDesc: 'So wird ein literarisches Glossar aufgebaut und formatiert.', manualStep1: 'Eine Zeile je Begriff mit genauer Schreibweise verwenden.',
      manualStep2: 'Kontext wie Geschlecht, Titel und formelle oder informelle Anrede ergänzen.', termsList: 'Glossarbegriffe',
      sourceTerm: 'Ausgangsbegriff', targetTerm: 'Zielübersetzung', noteDirective: 'Hinweis oder redaktionelle Vorgabe', action: 'Aktion',
      addNewTerm: 'Begriff hinzufügen', searchPlaceholder: 'Glossar durchsuchen…', noTermsFound: 'Noch keine Begriffe definiert.',
      confirmDeleteTerm: 'Begriff „{term}“ löschen?', saveGlossary: 'Glossar speichern', savedSuccess: 'Glossar wurde gespeichert',
    },
    sandbox: {
      title: 'Testumgebung und Prompt-Vorschau', desc: 'Teste das aktive LLM an literarischen Auszügen, bevor ein großer Auftrag startet.',
      sourceInputLabel: 'Ausgangsauszug', resultOutputLabel: 'Modellergebnis',
      sampleText: 'Es ist eine allgemein anerkannte Wahrheit, dass ein alleinstehender Mann im Besitz eines beträchtlichen Vermögens einer Frau bedarf.',
      runInference: 'Test ausführen', runningInference: 'Wird verarbeitet…', resetExcerpt: 'Beispieltext zurücksetzen', copyResult: 'Übersetzung kopieren',
    },
    wizard: {
      title: 'VRAM- und Kostenschätzung', desc: 'Schätze Tokenverbrauch, benötigten GPU-Speicher und API-Kosten.',
      executionEnv: '1. Ausführungsumgebung', localServer: 'Lokaler GPU-Server', localDesc: 'Ollama, LM Studio, Qwen 3.5',
      localBadge: 'Kostenlos und privat', cloudApi: 'Cloud-API', cloudDesc: 'DeepSeek, OpenAI, Claude', cloudBadge: 'Hohe Geschwindigkeit je Kapitel',
      activeBadge: 'Aktiv', bookSizeTitle: '2. Buchumfang', pagesUnit: 'Seiten', novella: 'Novelle (50 S.)', novel: 'Roman (300 S.)',
      thickBook: 'Umfangreiches Buch (800 S.)', fullSeries: 'Gesamte Reihe (2500 S.)', fineTuningTitle: '3. Feineinstellungen und API-Preise',
      chunkSize: 'Segmentgröße (Tokens)', concurrencySlots: 'Parallelität', inputPrice: 'Eingabepreis ($/1 Mio. Tokens)',
      outputPrice: 'Ausgabepreis ($/1 Mio. Tokens)', enableCaching: 'Prompt-Cache-Rabatt anwenden (-90 %)', resultsTitle: 'Ergebnisse und Hochrechnung',
      chunksUnit: 'Segmente', estimatedVolume: 'Geschätzter Umfang:', totalTokens: 'Tokens insgesamt:', estimatedCost: 'Geschätzte Buchkosten',
      freeLocal: 'Keine API-Kosten auf deiner GPU', officialApi: 'Offizieller API-Preis (${inPrice} Eingabe / ${outPrice} Ausgabe)',
      cachingSavings: 'Ersparnis durch Prompt-Cache: -${savings}', localAdvice: 'Ausgewogene Einstellung für wenig VRAM-Verbrauch und gleichmäßige literarische Qualität.',
      cloudAdvice: 'Große Segmente mit Prompt-Cache für schnelle Kapitelübersetzungen.',
      disclaimer: '* Schätzung auf Grundlage eines literarischen Durchschnitts von etwa 275 Wörtern pro Seite.',
      applySettings: 'Einstellungen auf das Projekt anwenden',
    },
    settings: {
      title: 'GPU- und LLM-Konfiguration', subtitle: 'Anbieter, Modelle, Übersetzungsparameter und Anwendungseinstellungen verwalten.',
      tabProviders: 'Anbieter und Modelle', tabTranslation: 'Übersetzungsmodul', tabGlobal: 'Allgemein und Sprache', tabPresets: 'Profile',
      chooseProvider: 'LLM-Anbieter wählen', apiKey: 'API-Schlüssel des Anbieters', apiKeyPlaceholder: 'sk-…',
      notRequired: 'Für einen lokalen Server nicht erforderlich', activeModel: 'Aktives Modell', detectingModels: 'Modelle werden erkannt…',
      searchModelPlaceholder: 'Modell filtern oder suchen…', customEndpoint: 'Endpunkt-URL', testConnection: 'Verbindung testen',
      testingConnection: 'Verbindung wird getestet…', connectionSuccess: 'Verbindung hergestellt', connectionFailed: 'Verbindung fehlgeschlagen',
      chunkSizeLabel: 'Segmentgröße ({count} Tokens)', chunkSizeAdvice: 'Lokal: 500–2500 (empfohlen 1000) | Cloud: 2500–10.000 (empfohlen 7000)',
      temperatureLabel: 'Temperatur ({val})', temperatureAdvice: 'Empfehlung: 0,15 für präzise literarische Übersetzungen',
      concurrencyLabel: 'Maximale Parallelität ({val} Anfragen)', concurrencyAdvice: 'Lokal: 1–4 | Cloud-API: 8–16',
      proofreadingTitle: 'Redaktionelle Überarbeitung (Durchgang 2)', proofreadingBadge: 'Zusätzliche Prüfung',
      proofreadingDesc: 'Führt für jedes Segment einen zweiten redaktionellen Durchgang aus, um Übertragungsfehler zu korrigieren und den Stil in der Zielsprache zu glätten.',
      systemPromptTitle: 'Systemprompt-Profile', systemPromptDesc: 'Passe die Übersetzungsanweisungen für das Modell an.',
      customPresetName: 'Name des neuen Profils…', createPresetBtn: 'Profil erstellen', languageTitle: 'Sprache der Oberfläche',
      languageDesc: 'Wähle die Anzeigesprache von TraDoc.', langEnglish: 'English', langFrench: 'Français', langSpanish: 'Español',
      langGerman: 'Deutsch', presetsManagerTitle: 'Konfigurationsprofile',
      presetsManagerDesc: 'Speichere Anbieter, Modell und Übersetzungsparameter als Profil. API-Schlüssel werden nicht im Browser gespeichert.',
      saveCurrentAsPreset: 'Aktuelle Konfiguration als Profil speichern', presetNamePlaceholder: 'Profilname (z. B. DeepSeek schnell)',
      savePresetBtn: 'Profil speichern', savedPresetsList: 'Gespeicherte Profile', activatePresetBtn: 'Aktivieren', activeBadge: 'AKTIV',
      deletePresetBtn: 'Profil löschen', confirmDeletePreset: 'Profil „{name}“ löschen?', saveAllSettings: 'Einstellungen speichern',
      saveAllSuccess: 'Konfiguration wurde gespeichert',
    },
  }
};

// Helper pour récupérer une chaîne traduite avec fallback propre
export function t(keyPath, lang = 'en', params = {}) {
  const dictionary = translations[lang] || translations.en;
  const fallbackDict = translations.en;

  const keys = keyPath.split('.');
  let result = dictionary;
  let fallbackResult = fallbackDict;

  for (const key of keys) {
    if (result && typeof result === 'object') {
      result = result[key];
    } else {
      result = undefined;
    }
    if (fallbackResult && typeof fallbackResult === 'object') {
      fallbackResult = fallbackResult[key];
    } else {
      fallbackResult = undefined;
    }
  }

  let text = result !== undefined ? result : (fallbackResult !== undefined ? fallbackResult : keyPath);

  if (typeof text === 'string') {
    Object.keys(params).forEach((paramKey) => {
      text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), params[paramKey]);
    });
  }

  return text;
}
