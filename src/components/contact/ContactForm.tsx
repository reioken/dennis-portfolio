import { useState, type FormEvent } from 'react';

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
};

type Props = {
  de: Copy;
  en: Copy;
  endpoint?: string;
};

export default function ContactForm({ de, en, endpoint = '/api/contact' }: Props) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'ok' | 'err'>('idle');
  const [errorKey, setErrorKey] = useState('');

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
      name: String(data.get('name') || ''),
      email: String(data.get('email') || ''),
      subject: String(data.get('subject') || ''),
      message: String(data.get('message') || ''),
      company: String(data.get('company') || ''),
    };

    if (!payload.name || !payload.email || !payload.message) {
      setStatus('err');
      setErrorKey('required');
      return;
    }

    setStatus('sending');
    setErrorKey('');
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setStatus('err');
        setErrorKey(json.error || 'send_failed');
        return;
      }
      setStatus('ok');
      form.reset();
    } catch {
      setStatus('err');
      setErrorKey('send_failed');
    }
  }

  return (
    <form className="contact-form" onSubmit={onSubmit} noValidate>
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
          <input name="name" type="text" autoComplete="name" required maxLength={80} />
        </label>
        <label className="contact-form__field">
          <span>
            <span data-lang="de">{de.email}</span>
            <span data-lang="en">{en.email}</span>
          </span>
          <input name="email" type="email" autoComplete="email" required maxLength={160} />
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
        <textarea name="message" required rows={6} maxLength={4000} />
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
            {errorKey === 'required' ? (
              <>
                <span data-lang="de">{de.required}</span>
                <span data-lang="en">{en.required}</span>
              </>
            ) : (
              <>
                <span data-lang="de">{de.error}</span>
                <span data-lang="en">{en.error}</span>
              </>
            )}
          </p>
        )}
      </div>
    </form>
  );
}
