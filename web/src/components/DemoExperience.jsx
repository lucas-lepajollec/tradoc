import { useEffect, useRef, useState } from 'react';
import { HelpCircle, RotateCcw, ShieldCheck } from 'lucide-react';
import { l } from '../i18n/translations';

const INTRO_KEY = 'lh-demo-intro-seen';
const LINKS = {
  site: 'https://tradoc.lucas-homelab.fr',
  docs: 'https://docs.tradoc.lucas-homelab.fr',
  source: 'https://github.com/lucas-lepajollec/tradoc',
};

function readIntroSeen() {
  try {
    return sessionStorage.getItem(INTRO_KEY) === '1';
  } catch {
    return false;
  }
}

export default function DemoExperience({ lang }) {
  const [isGuideOpen, setGuideOpen] = useState(() => !readIntroSeen());
  const [announcement, setAnnouncement] = useState('');
  const dialogRef = useRef(null);
  const titleRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isGuideOpen && !dialog.open) {
      dialog.showModal();
      titleRef.current?.focus({ preventScroll: true });
      dialog.scrollTop = 0;
    }
    if (!isGuideOpen && dialog.open) dialog.close();
  }, [isGuideOpen]);

  const closeGuide = () => {
    try {
      sessionStorage.setItem(INTRO_KEY, '1');
    } catch {
      /* ignore */
    }
    setGuideOpen(false);
  };

  const resetDemo = () => {
    try {
      sessionStorage.removeItem(INTRO_KEY);
    } catch {
      /* ignore */
    }
    setAnnouncement(l(lang, 'The demo is being reset.', 'La démonstration est en cours de réinitialisation.', 'La demo se está restableciendo.', 'Die Demo wird zurückgesetzt.'));
    window.location.reload();
  };

  const copy = {
    public: l(lang, 'Public demo', 'Démonstration publique', 'Demostración pública', 'Öffentliche Demo'),
    chip: l(lang, 'Demo', 'Démo', 'Demo', 'Demo'),
    info: l(lang, 'Show demo information', 'Afficher les informations de la démonstration', 'Mostrar información de la demo', 'Informationen zur Demo anzeigen'),
    reset: l(lang, 'Reset', 'Réinitialiser', 'Restablecer', 'Zurücksetzen'),
    resetAria: l(lang, 'Reset the demo', 'Réinitialiser la démonstration', 'Restablecer la demo', 'Demo zurücksetzen'),
    continue: l(lang, 'Continue', 'Continuer', 'Continuar', 'Weiter'),
    title: l(lang, 'Try the translation workflow, not a real studio.', 'Essayez le flux de traduction, pas un vrai studio.', 'Prueba el flujo de traducción, no un estudio real.', 'Teste den Übersetzungsablauf, kein echtes Studio.'),
    body: l(
      lang,
      'This is an isolated preview of TraDoc. Projects, translations, models and glossaries here are fictional. Nothing on this page contacts an AI provider.',
      'Ceci est un aperçu isolé de TraDoc. Les projets, traductions, modèles et glossaires sont fictifs. Rien sur cette page ne contacte un fournisseur d’IA.',
      'Esta es una vista previa aislada de TraDoc. Los proyectos, traducciones, modelos y glosarios son ficticios. Nada en esta página contacta con un proveedor de IA.',
      'Dies ist eine isolierte Vorschau von TraDoc. Projekte, Übersetzungen, Modelle und Glossare sind fiktiv. Nichts auf dieser Seite kontaktiert einen KI-Anbieter.',
    ),
    try: l(lang, 'You can try', 'Vous pouvez essayer', 'Puedes probar', 'Du kannst ausprobieren'),
    tryBody: l(lang, 'Browse projects, the inspector, settings and glossaries.', 'Parcourir les projets, l’inspecteur, les réglages et les glossaires.', 'Recorrer proyectos, el inspector, ajustes y glosarios.', 'Projekte, Inspektor, Einstellungen und Glossare durchsuchen.'),
    sim: l(lang, 'What is simulated', 'Ce qui est simulé', 'Qué está simulado', 'Was simuliert wird'),
    simBody: l(lang, 'Translations, models and glossaries stay fictional in this browser.', 'Les traductions, modèles et glossaires restent fictifs dans ce navigateur.', 'Las traducciones, modelos y glosarios siguen siendo ficticios en este navegador.', 'Übersetzungen, Modelle und Glossare bleiben in diesem Browser fiktiv.'),
    never: l(lang, 'What never happens', 'Ce qui n’arrive jamais', 'Qué no ocurre nunca', 'Was nie passiert'),
    neverBody: l(lang, 'No FastAPI backend, AI provider or credentials are used.', 'Aucun backend FastAPI, fournisseur d’IA ou identifiant n’est utilisé.', 'No se usa backend FastAPI, proveedor de IA ni credenciales.', 'Es wird kein FastAPI-Backend, KI-Anbieter oder Zugangsdaten verwendet.'),
    limits: l(lang, 'Reloading the page resets this demo.', 'Recharger la page réinitialise cette démonstration.', 'Recargar la página restablece esta demostración.', 'Ein Neuladen der Seite setzt diese Demo zurück.'),
    site: l(lang, 'Site', 'Site', 'Sitio', 'Website'),
    docs: l(lang, 'Docs', 'Docs', 'Docs', 'Doku'),
    source: l(lang, 'Source', 'Source', 'Código', 'Quellcode'),
  };

  const cards = [
    { title: copy.try, text: copy.tryBody },
    { title: copy.sim, text: copy.simBody },
    { title: copy.never, text: copy.neverBody },
  ];

  return (
    <>
      <div className={`lh-demo-chip pointer-events-none fixed bottom-4 right-4 z-[80] ${isGuideOpen ? 'invisible' : ''}`}>
        <div className="pointer-events-auto flex items-center rounded-full border border-white/[0.08] bg-[#14171d]/92 p-1 text-white shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setGuideOpen(true)}
            className="flex min-h-9 items-center gap-2 rounded-full px-3 text-[11px] font-semibold tracking-[0.14em] uppercase text-white/90 transition-colors hover:bg-white/8"
            aria-label={copy.info}
          >
            <span>{copy.chip}</span>
            <HelpCircle size={14} className="text-white/45" aria-hidden="true" />
          </button>
          <span className="h-4 w-px bg-white/12" aria-hidden="true" />
          <button
            type="button"
            onClick={resetDemo}
            className="grid size-9 place-items-center rounded-full text-white/55 transition-colors hover:bg-white/10 hover:text-white"
            aria-label={copy.resetAria}
            title={copy.reset}
          >
            <RotateCcw size={14} aria-hidden="true" />
          </button>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">{announcement}</p>

      <dialog
        ref={dialogRef}
        onClick={(event) => {
          if (event.target === dialogRef.current) closeGuide();
        }}
        onCancel={(event) => {
          event.preventDefault();
          closeGuide();
        }}
        onClose={closeGuide}
        aria-labelledby="lh-demo-title"
        aria-describedby="lh-demo-body"
        className="lh-demo-dialog m-auto max-h-[calc(100dvh-1.5rem)] w-[min(92vw,640px)] max-w-none overflow-x-hidden overflow-y-auto rounded-[28px] border border-white/[0.08] bg-[#14171d] p-0 text-white shadow-[0_30px_120px_rgba(0,0,0,0.72)] backdrop:bg-black/72"
      >
        <div className="relative overflow-hidden px-5 py-6 sm:px-8 sm:py-8">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[10px] font-semibold tracking-[0.16em] uppercase text-white/70">
              <ShieldCheck size={13} aria-hidden="true" />
              {copy.public}
            </div>
          </div>

          <h2 ref={titleRef} id="lh-demo-title" tabIndex={-1} className="max-w-xl text-[1.7rem] font-semibold tracking-tight outline-none sm:text-4xl">
            {copy.title}
          </h2>
          <p id="lh-demo-body" className="mt-3 max-w-xl text-sm leading-6 text-white/55 sm:text-[15px]">
            {copy.body}
          </p>

          <div className="mt-6 grid gap-2 sm:grid-cols-3 sm:gap-3">
            {cards.map((card) => (
              <div key={card.title} className="lh-demo-card rounded-2xl bg-white/[0.03] p-3.5">
                <h3 className="text-[11px] font-semibold tracking-[0.08em] uppercase text-white/80">{card.title}</h3>
                <p className="mt-2 text-xs leading-5 text-white/[0.42]">{card.text}</p>
              </div>
            ))}
          </div>

          <p className="lh-demo-limits mt-5 rounded-2xl bg-white/[0.025] px-4 py-3 text-xs leading-5 text-white/[0.42]">
            {copy.limits}
          </p>

          <nav className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-xs text-white/50" aria-label={copy.public}>
            <a className="underline decoration-white/20 underline-offset-4 hover:text-white" href={LINKS.site} target="_blank" rel="noreferrer">{copy.site}</a>
            <a className="underline decoration-white/20 underline-offset-4 hover:text-white" href={LINKS.docs} target="_blank" rel="noreferrer">{copy.docs}</a>
            <a className="underline decoration-white/20 underline-offset-4 hover:text-white" href={LINKS.source} target="_blank" rel="noreferrer">{copy.source}</a>
          </nav>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={resetDemo}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.08] px-4 text-sm text-white/60 transition-colors hover:bg-white/5 hover:text-white sm:order-1"
            >
              <RotateCcw size={15} aria-hidden="true" />
              {copy.reset}
            </button>
            <button
              type="button"
              onClick={closeGuide}
              className="min-h-11 rounded-xl bg-white px-6 text-sm font-semibold text-[#0b0e13] transition-colors hover:bg-white/90 sm:order-2"
            >
              {copy.continue}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
