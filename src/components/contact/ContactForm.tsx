import { useRef, useState, type FormEvent } from 'react';

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
};

type Props = {
  de: Copy;
  en: Copy;
  endpoint?: string;
};

/** Same shape the worker enforces server-side. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ErrorKey = 'required' | 'invalid_email' | 'send_failed';

export default function ContactForm({ de, en, endpoint = '/api/contact' }: Props) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'ok' | 'err'>('idle');
  const [errorKey, setErrorKey] = useState<ErrorKey | ''>('');
  const [invalidFields, setInvalidFields] = useState<string[]>([]);
  const formRef = useRef<HTMLFormElement>(null);

  function fail(key: ErrorKey, fields: string[]) {
    setStatus('err');
    setErrorKey(key);
    setInvalidFields(fields);
    if (fields.length && formRef.current) {
      const first = formRef.current.querySelector<HTMLElement>(`[name="${fields[0]}"]`);
      first?.focus();
    }
  }

  /** Any edit after a result clears the stale note. */
  function onInput() {
    if (status === 'ok' || status === 'err') {
      setStatus('idle');
      setErrorKey('');
      setInvalidFields([]);
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === 'sending') return;
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
    setInvalidFields([]);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        if (json.error === 'invalid_email') fail('invalid_email', ['email']);
        else if (json.error === 'missing_fields') fail('required', []);
        else fail('send_failed', []);
        return;
      }
      setStatus('ok');
      form.reset();
    } catch {
      fail('send_failed', []);
    }
  }

  const isInvalid = (field: string) => invalidFields.includes(field);

  const errorText = (key: ErrorKey | '') => {
    const pick = (c: Copy) =>
      key === 'required' ? c.required : key === 'invalid_email' ? c.invalidEmail : c.error;
    return (
      <>
        <span data-lang="de">{pick(de)}</span>
        <span data-lang="en">{pick(en)}</span>
      </>
    );
  };

  return (
    <form ref={formRef} className="contact-form" onSubmit={onSubmit} onInput={onInput} noValidate>
      {/* honeypot */}
      <label className="contact-form__hp" aria-hidden="true">
        <span>Company</span>
        <input type="text" name="company" tabIndex={-1} autoComplete="off" />
      </label>

      <div className="contact-form__grid">
        <label className="contact-form__field">
          <span>
            <span data-lang="de">{de.name}</span>
            <span data-lang="en">{en.name}</span>
          </span>
          <input
            name="name"
            type="text"
            autoComplete="name"
            required
            maxLength={80}
            aria-invalid={isInvalid('name') || undefined}
          />
        </label>
        <label className="contact-form__field">
          <span>
            <span data-lang="de">{de.email}</span>
            <span data-lang="en">{en.email}</span>
          </span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={160}
            aria-invalid={isInvalid('email') || undefined}
          />
        </label>
      </div>

      <label className="contact-form__field">
        <span>
          <span data-lang="de">{de.subject}</span>
          <span data-lang="en">{en.subject}</span>
        </span>
        <input name="subject" type="text" autoComplete="off" maxLength={120} />
      </label>

      <label className="contact-form__field">
        <span>
          <span data-lang="de">{de.message}</span>
          <span data-lang="en">{en.message}</span>
        </span>
        <textarea
          name="message"
          required
          rows={6}
          maxLength={4000}
          aria-invalid={isInvalid('message') || undefined}
        />
      </label>

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
