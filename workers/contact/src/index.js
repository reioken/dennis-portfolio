import { EmailMessage } from 'cloudflare:email';

const MAX = { name: 80, email: 160, subject: 120, message: 4000 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function encodeSubject(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return `=?UTF-8?B?${btoa(bin)}?=`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatWhen(date = new Date()) {
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function buildPlainText({ name, email, subject, message, when }) {
  return [
    'DENNIS BIERRETH-FERNANDEZ',
    'Portfolio inquiry',
    '────────────────────────────────────────',
    '',
    `From:     ${name}`,
    `Email:    ${email}`,
    `Subject:  ${subject}`,
    `Received: ${when} (Europe/Berlin)`,
    `Source:   dennisbf.design/contact`,
    '',
    'Message',
    '────────────────────────────────────────',
    message,
    '',
    '────────────────────────────────────────',
    `Reply to this email to answer ${name} directly.`,
    'Their address is set as Reply-To.',
  ].join('\n');
}

function buildHtml({ name, email, subject, message, when }) {
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeSubject = escapeHtml(subject);
  const safeWhen = escapeHtml(when);
  const safeMessage = escapeHtml(message).replace(/\n/g, '<br>\n');

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Portfolio inquiry</title>
</head>
<body style="margin:0;padding:0;background:#eef1f6;font-family:Segoe UI,Helvetica Neue,Arial,sans-serif;color:#1a1f2b;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f6;padding:28px 14px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #d8dee8;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:22px 28px 18px;background:linear-gradient(120deg,#0b1020 0%,#151b2e 55%,#1a2744 100%);">
              <div style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#9eb0d4;font-weight:700;">Dennis Bierreth-Fernandez</div>
              <div style="margin-top:8px;font-size:22px;line-height:1.25;font-weight:700;color:#ffffff;letter-spacing:0.01em;">New portfolio inquiry</div>
              <div style="margin-top:8px;font-size:13px;color:#c5d0e8;">Via dennisbf.design/contact · ${safeWhen}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e3e8f0;border-radius:12px;background:#f7f9fc;">
                <tr>
                  <td style="padding:14px 16px;border-bottom:1px solid #e3e8f0;">
                    <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#6b778c;font-weight:700;">From</div>
                    <div style="margin-top:4px;font-size:16px;font-weight:650;color:#121826;">${safeName}</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 16px;border-bottom:1px solid #e3e8f0;">
                    <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#6b778c;font-weight:700;">Email</div>
                    <div style="margin-top:4px;font-size:15px;">
                      <a href="mailto:${safeEmail}" style="color:#2f5bdb;text-decoration:none;font-weight:600;">${safeEmail}</a>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 16px;">
                    <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#6b778c;font-weight:700;">Subject</div>
                    <div style="margin-top:4px;font-size:15px;font-weight:600;color:#121826;">${safeSubject}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 8px;">
              <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#6b778c;font-weight:700;margin-bottom:10px;">Message</div>
              <div style="font-size:15px;line-height:1.6;color:#1a1f2b;white-space:normal;">${safeMessage}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px 26px;">
              <div style="border-top:1px solid #e3e8f0;padding-top:16px;font-size:12px;line-height:1.5;color:#6b778c;">
                Reply to this email to answer <strong style="color:#121826;">${safeName}</strong> directly.
                Their address is set as Reply-To.
              </div>
            </td>
          </tr>
        </table>
        <div style="max-width:560px;margin-top:14px;font-size:11px;line-height:1.45;color:#7a8699;text-align:center;">
          Art Director &amp; UI/UX Designer · dennisbf.design
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildRawMime({ fromAddr, fromName, to, replyTo, subject, text, html }) {
  const boundary = `bf_${crypto.randomUUID().replace(/-/g, '')}`;
  const from = fromName
    ? `"${fromName.replace(/["\\\r\n]/g, '')}" <${fromAddr}>`
    : fromAddr;

  return [
    `From: ${from}`,
    `To: ${to}`,
    `Reply-To: ${replyTo}`,
    `Subject: ${encodeSubject(subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    text,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    html,
    '',
    `--${boundary}--`,
    '',
  ].join('\r\n');
}

function clean(value, max) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .trim()
    .slice(0, max);
}

/** Branded result page for no-JS form posts (progressive enhancement fallback). */
function resultPage(ok, errorKey) {
  const messages = {
    missing_fields: 'Bitte Name, E-Mail und Nachricht ausfüllen. / Please fill in name, email and message.',
    invalid_email: 'Bitte prüf die E-Mail-Adresse. / Please check the email address.',
    send_failed: 'Senden fehlgeschlagen — bitte später nochmal versuchen oder direkt mailen. / Sending failed — please retry later or email directly.',
  };
  const title = ok ? 'Nachricht gesendet' : 'Senden fehlgeschlagen';
  const body = ok
    ? 'Danke — deine Nachricht ist unterwegs. / Thanks — your message is on its way.'
    : messages[errorKey] || messages.send_failed;
  const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title} — Dennis Bierreth-Fernandez</title>
<style>
  body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#07080c;color:#f7f8fc;font-family:system-ui,'Segoe UI',sans-serif;padding:1.5rem}
  main{max-width:34rem;text-align:center;border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:2.5rem 2rem;background:rgba(10,12,20,.8)}
  h1{margin:0 0 .75rem;font-size:1.4rem;letter-spacing:.02em}
  p{margin:0 0 1.5rem;color:#8188a1;line-height:1.55}
  a{display:inline-block;padding:.75rem 1.4rem;border-radius:999px;background:linear-gradient(120deg,#ac8bfd,#4a82fe);color:#fff;text-decoration:none;font-weight:600;font-size:.85rem;letter-spacing:.1em;text-transform:uppercase}
</style>
</head>
<body>
<main>
  <h1>${ok ? '✓ ' : ''}${title}</h1>
  <p>${body}</p>
  <a href="/contact/">Zurück zum Kontakt / Back to contact</a>
</main>
</body>
</html>`;
  return new Response(html, {
    status: ok ? 200 : 400,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}

async function handleContact(request, env) {
  // No-JS fallback: plain HTML form posts send urlencoded/multipart instead of JSON
  const contentType = (request.headers.get('content-type') || '').toLowerCase();
  const isFormPost =
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data');
  const respond = (data, status) =>
    isFormPost ? resultPage(!!data.ok, data.error) : json(data, status);

  if (!env.CONTACT) {
    return respond({ ok: false, error: 'mail_binding_missing' }, 503);
  }

  let body;
  if (isFormPost) {
    try {
      body = Object.fromEntries((await request.formData()).entries());
    } catch {
      return respond({ ok: false, error: 'invalid_form' }, 400);
    }
  } else {
    try {
      body = await request.json();
    } catch {
      return respond({ ok: false, error: 'invalid_json' }, 400);
    }
  }

  // Honeypot
  if (body.company || body.website) {
    return respond({ ok: true }, 200);
  }

  const name = clean(body.name, MAX.name);
  const email = clean(body.email, MAX.email).toLowerCase();
  const subject = clean(body.subject, MAX.subject) || 'General inquiry';
  const message = clean(body.message, MAX.message);

  if (!name || !email || !message) {
    return respond({ ok: false, error: 'missing_fields' }, 400);
  }
  if (!EMAIL_RE.test(email)) {
    return respond({ ok: false, error: 'invalid_email' }, 400);
  }

  const to = typeof env.CONTACT_TO === 'string' ? env.CONTACT_TO.trim() : '';
  if (!to) {
    return respond({ ok: false, error: 'mail_inbox_missing' }, 503);
  }
  const fromAddr = env.CONTACT_FROM || 'contact@dennisbf.design';
  const when = formatWhen();
  const mailSubject = `${subject} — ${name}`;
  const text = buildPlainText({ name, email, subject, message, when });
  const html = buildHtml({ name, email, subject, message, when });

  const raw = buildRawMime({
    fromAddr,
    fromName: 'Dennis BF Portfolio',
    to,
    replyTo: `${name.replace(/[<>\r\n]/g, '')} <${email}>`,
    subject: mailSubject,
    text,
    html,
  });

  try {
    await env.CONTACT.send(new EmailMessage(fromAddr, to, raw));
    return respond({ ok: true }, 200);
  } catch (err) {
    console.error('contact mail failed', err?.message || err);
    return respond({ ok: false, error: 'send_failed' }, 502);
  }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'access-control-allow-methods': 'POST, OPTIONS',
          'access-control-allow-headers': 'content-type',
          'access-control-max-age': '86400',
        },
      });
    }

    if (request.method !== 'POST') {
      return json({ ok: false, error: 'method_not_allowed' }, 405);
    }

    return handleContact(request, env);
  },
};
