import { useEffect, useRef, useState, type FormEvent } from 'react';

type Copy = {
  name: string;
  email: string;
  subject: string;
  message: string;
  send: string;
  sending: string;
  success: string;
  error: string;
  required: string;
  invalidEmail: string;
  rateLimit: string;
};

type Props = {
  de: Copy;
  en: Copy;
  endpoint?: string;
  privacyHref?: string;
  privacyHrefEn?: string;
};

/** Same shape the worker enforces server-side. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ErrorKey = 'required' | 'invalid_email' | 'rate_limited' | 'send_failed';

type FieldErrorKey = 'required' | 'invalid_email';

export default function ContactForm({
  de,
  en,
  endpoint = '/api/contact',
  privacyHref = '/privacy/',
  privacyHrefEn = '/en/privacy/',
}: Props) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'ok' | 'err'>('idle');
  const [errorKey, setErrorKey] = useState<ErrorKey | ''>('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, FieldErrorKey>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => () => {
    requestRef.current?.abort();
    requestRef.current = null;
  }, []);

  function fail(key: ErrorKey, fields: string[]) {
    setStatus('err');
    setErrorKey(key);
    const map: Record<string, FieldErrorKey> = {};
    for (const f of fields) {
      map[f] = key === 'invalid_email' && f === 'email' ? 'invalid_email' : 'required';
    }
    setFieldErrors(map);
    if (fields.length && formRef.current) {
      const first = formRef.current.querySelector<HTMLElement>(`[name="${fields[0]}"]`);
      first?.focus();
    }
  }

  /** Any edit after a result clears the stale note. */
  function onInput(event: FormEvent<HTMLFormElement>) {
    const field = (event.target as HTMLInputElement).name;
    if (status === 'ok' || status === 'err') {
      setStatus('idle');
      setErrorKey('');
    }
    if (fieldErrors[field]) setFieldErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  /** Per-field inline error, linked via aria-describedby. */
  function FieldError({ field }: { field: string }) {
    const kind = fieldErrors[field];
    if (!kind) return null;
    return (
      <span className="contact-form__field-error" id={`fe-${field}`}>
        {kind === 'invalid_email' ? (
          <>
            <span data-lang="de">Bitte gültige E-Mail-Adresse angeben.</span>
            <span data-lang="en">Please enter a valid email address.</span>
          </>
        ) : (
          <>
            <span data-lang="de">Bitte ausfüllen.</span>
            <span data-lang="en">This field is required.</span>
          </>
        )}
      </span>
    );
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === 'sending' || requestRef.current) return;
    const form = e.currentTarget;
    const data = new FormData(form);

    // Honeypot
    if (String(data.get('company') || '')) {
      setStatus('ok');
      return;
    }

    const payload = {
      name: String(data.get('name') || '').trim(),
      email: String(data.get('email') || '').trim(),
      subject: String(data.get('subject') || '').trim(),
      message: String(data.get('message') || '').trim(),
      company: String(data.get('company') || ''),
    };

    const missing = (['name', 'email', 'message'] as const).filter((f) => !payload[f]);
    if (missing.length) {
      fail('required', missing);
      return;
    }
    if (!EMAIL_RE.test(payload.email)) {
      fail('invalid_email', ['email']);
      return;
    }

    setStatus('sending');
    setErrorKey('');
    setFieldErrors({});
    const request = new AbortController();
    requestRef.current = request;
    const timeout = window.setTimeout(() => request.abort(), 20000);
    try {
      const res = await fetch(endpoint, {
        signal: request.signal,
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        if (json.error === 'invalid_email') fail('invalid_email', ['email']);
        else if (json.error === 'missing_fields') fail('required', []);
        else if (json.error === 'rate_limited') fail('rate_limited', []);
        else fail('send_failed', []);
        return;
      }
      setStatus('ok');
      form.reset();
    } catch {
      if (requestRef.current === request) fail('send_failed', []);
    } finally {
      window.clearTimeout(timeout);
      if (requestRef.current === request) requestRef.current = null;
    }
  }

  const isInvalid = (field: string) => Boolean(fieldErrors[field]);

  const errorText = (key: ErrorKey | '') => {
    const pick = (c: Copy) =>
      key === 'required'
        ? c.required
        : key === 'invalid_email'
          ? c.invalidEmail
          : key === 'rate_limited'
            ? c.rateLimit
            : c.error;
    return (
      <>
        <span data-lang="de">{pick(de)}</span>
        <span data-lang="en">{pick(en)}</span>
      </>
    );
  };

  // action/method: without JS this posts as a normal HTML form to the worker,
  // which answers with a branded result page — JS path stays as enhancement
  return (
    <form
      ref={formRef}
      className="contact-form"
      action={endpoint}
      method="POST"
      onSubmit={onSubmit}
      onInput={onInput}
      noValidate
      aria-busy={status === 'sending'}
    >
      {/* honeypot */}
      <div className="contact-form__hp" hidden aria-hidden="true">
        <label htmlFor="company-field">Company</label>
        <input id="company-field" type="text" name="company" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="contact-form__grid">
        <label className="contact-form__field">
          <span>
            <span data-lang="de">{de.name}</span>
            <span data-lang="en">{en.name}</span>
            <span className="contact-form__required" aria-hidden="true"> *</span>
          </span>
          <input
            name="name"
            type="text"
            autoComplete="name"
            disabled={status === 'sending'}
            required
            maxLength={80}
            aria-invalid={isInvalid('name') || undefined}
            aria-describedby={isInvalid('name') ? 'fe-name' : undefined}
          />
          <FieldError field="name" />
        </label>
        <label className="contact-form__field">
          <span>
            <span data-lang="de">{de.email}</span>
            <span data-lang="en">{en.email}</span>
            <span className="contact-form__required" aria-hidden="true"> *</span>
          </span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            disabled={status === 'sending'}
            required
            maxLength={160}
            aria-invalid={isInvalid('email') || undefined}
            aria-describedby={isInvalid('email') ? 'fe-email' : undefined}
          />
          <FieldError field="email" />
        </label>
      </div>

      <label className="contact-form__field">
        <span>
          <span data-lang="de">{de.subject}</span>
          <span data-lang="en">{en.subject}</span>
        </span>
        <input name="subject" type="text" autoComplete="off" maxLength={120} disabled={status === 'sending'} />
      </label>

      <label className="contact-form__field">
          <span>
            <span data-lang="de">{de.message}</span>
            <span data-lang="en">{en.message}</span>
            <span className="contact-form__required" aria-hidden="true"> *</span>
        </span>
        <textarea
          name="message"
          disabled={status === 'sending'}
          required
          rows={6}
          maxLength={8000}
          aria-invalid={isInvalid('message') || undefined}
          aria-describedby={isInvalid('message') ? 'fe-message' : undefined}
        />
        <FieldError field="message" />
      </label>

      <p className="contact-form__privacy">
        <span data-lang="de">
          * Pflichtfeld. Deine Angaben werden nur zur Bearbeitung deiner Anfrage verwendet.{' '}
          <a href={privacyHref}>Datenschutz</a>
        </span>
        <span data-lang="en">
          * Required. Your details are used only to handle your inquiry.{' '}
          <a href={privacyHrefEn}>Privacy</a>
        </span>
      </p>

      <div className="contact-form__actions">
        <button className="btn btn--primary" type="submit" disabled={status === 'sending'}>
          {status === 'sending' ? (
            <>
              <span data-lang="de">{de.sending}</span>
              <span data-lang="en">{en.sending}</span>
            </>
          ) : (
            <>
              <span data-lang="de">{de.send}</span>
              <span data-lang="en">{en.send}</span>
            </>
          )}
        </button>
        {status === 'ok' && (
          <p className="contact-form__note contact-form__note--ok" role="status">
            <span data-lang="de">{de.success}</span>
            <span data-lang="en">{en.success}</span>
          </p>
        )}
        {status === 'err' && (
          <p className="contact-form__note contact-form__note--err" role="alert">
            {errorText(errorKey)}
          </p>
        )}
      </div>
    </form>
  );
}
