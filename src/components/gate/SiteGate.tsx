import { useEffect, useState, type FormEvent } from 'react';
import { GATE, isEditorEnabled, isGateEnabled } from '../../lib/gate-config';
import BrandMark from '../brand/BrandMark';
import { isAuthed, readContent, setAuthed } from '../../lib/content-store';
import PersonalEditor from '../editor/PersonalEditor';
import ContentRuntime from '../editor/ContentRuntime';

export default function SiteGate() {
  const lockSite = isGateEnabled();
  const editorOn = isEditorEnabled();
  const [ready, setReady] = useState(!lockSite);
  const [authed, setAuthedState] = useState(!lockSite && !editorOn ? true : false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [content, setContent] = useState<Record<string, string>>({});
  const [editorPrompt, setEditorPrompt] = useState(false);

  useEffect(() => {
    const sync = () => {
      const ok = isAuthed();
      setAuthedState(ok);
      document.documentElement.dataset.gateLocked = lockSite && !ok ? '1' : '0';
      setContent(readContent());
      setReady(true);
    };
    const onContent = () => setContent(readContent());
    sync();
    if (editorOn && new URLSearchParams(window.location.search).has('edit')) {
      setEditorPrompt(true);
    }
    window.addEventListener('db-auth-updated', sync);
    window.addEventListener('db-content-updated', onContent);
    return () => {
      window.removeEventListener('db-auth-updated', sync);
      window.removeEventListener('db-content-updated', onContent);
    };
  }, [lockSite, editorOn]);

  if (!lockSite && !editorOn) return null;

  const title = content['gate.title'] || 'Under Construction';
  const subtitle =
    content['gate.subtitle'] ||
    'Das Portfolio wird gerade feingeschliffen. Mit Passwort kommst du rein.';
  const hint = content['gate.hint'] || 'Passwort eingeben';

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (password === GATE.password) {
      setAuthed(true);
      setError('');
      setPassword('');
      setEditorPrompt(false);
    } else {
      setError('Falsches Passwort');
    }
  };

  if (!ready && lockSite) {
    return <div id="db-site-gate" className="fixed inset-0 z-[200] bg-[var(--bg)]" aria-hidden />;
  }

  // Full-site lock (optional / off in production)
  if (lockSite && !authed) {
    return (
      <div id="db-site-gate" className="gate-screen fixed inset-0 z-[200] flex items-center justify-center px-5">
        <div className="gate-glow" aria-hidden />
        <div className="relative w-full max-w-md">
          <BrandMark size={48} weight="hero" className="mb-5 text-[var(--text)]" />
          <p className="mb-3 text-[0.7rem] font-bold uppercase tracking-[0.28em] text-[var(--faint)]">
            dennisbf.design
          </p>
          <h1 className="name-lock gradient-text mb-4 font-[family-name:var(--font-display)] text-[clamp(1.6rem,5vw,2.4rem)] font-semibold uppercase leading-none tracking-[0.08em]">
            {title}
          </h1>
          <p className="mb-8 max-w-[36ch] text-[0.98rem] normal-case tracking-normal text-[var(--dim)]">
            {subtitle}
          </p>
          <form onSubmit={onSubmit} className="space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[var(--faint)]">
                {hint}
              </span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                className="gate-input w-full"
                placeholder="••••••••"
              />
            </label>
            {error ? <p className="text-sm text-[var(--ember)]">{error}</p> : null}
            <button type="submit" className="btn btn--primary w-full justify-center">
              Freischalten
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Public visitors never see the editor. Open via ?edit=1 or prior auth session.
  const showEditorEntry = editorOn && !authed && editorPrompt;

  return (
    <div id="db-site-gate">
      {authed ? (
        <>
          <ContentRuntime />
          {editorOn ? <PersonalEditor /> : null}
        </>
      ) : showEditorEntry ? (
        <div className="gate-screen fixed inset-0 z-[200] flex items-center justify-center px-5 bg-[color-mix(in_srgb,var(--bg)_72%,transparent)]">
          <div className="relative w-full max-w-sm rounded-[1.15rem] border border-[var(--stroke)] bg-[color-mix(in_srgb,#0a0b12_96%,transparent)] p-6 backdrop-blur-xl">
            <p className="mb-2 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[var(--meta)]">
              Personal Editor
            </p>
            <h2 className="display mb-4 text-xl">Passwort</h2>
            <form onSubmit={onSubmit} className="space-y-3">
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                className="gate-input w-full"
                placeholder="••••••••"
                autoFocus
              />
              {error ? <p className="text-sm text-[var(--ember)]">{error}</p> : null}
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn flex-1 justify-center"
                  onClick={() => {
                    setEditorPrompt(false);
                    const url = new URL(window.location.href);
                    url.searchParams.delete('edit');
                    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
                  }}
                >
                  Abbrechen
                </button>
                <button type="submit" className="btn btn--primary flex-1 justify-center">
                  Öffnen
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
