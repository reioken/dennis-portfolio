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

function buildRawMime({ fromAddr, fromName, to, replyTo, subject, text }) {
  const from = fromName
    ? `"${fromName.replace(/["\\\r\n]/g, '')}" <${fromAddr}>`
    : fromAddr;
  return [
    `From: ${from}`,
    `To: ${to}`,
    `Reply-To: ${replyTo}`,
    `Subject: ${encodeSubject(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    text,
  ].join('\r\n');
}

function clean(value, max) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .trim()
    .slice(0, max);
}

async function handleContact(request, env) {
  if (!env.CONTACT) {
    return json({ ok: false, error: 'mail_unavailable' }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  // Honeypot
  if (body.company || body.website) {
    return json({ ok: true });
  }

  const name = clean(body.name, MAX.name);
  const email = clean(body.email, MAX.email).toLowerCase();
  const subject = clean(body.subject, MAX.subject) || 'Portfolio contact';
  const message = clean(body.message, MAX.message);

  if (!name || !email || !message) {
    return json({ ok: false, error: 'missing_fields' }, 400);
  }
  if (!EMAIL_RE.test(email)) {
    return json({ ok: false, error: 'invalid_email' }, 400);
  }

  const to = env.CONTACT_TO || 'dennis.bierreth@gmail.com';
  const fromAddr = env.CONTACT_FROM || 'contact@dennisbf.design';
  const text = [
    'New message via dennisbf.design/contact',
    '',
    `Name: ${name}`,
    `Email: ${email}`,
    `Subject: ${subject}`,
    '',
    message,
    '',
    '—',
    `Reply directly to this email to answer ${name}.`,
  ].join('\n');

  const raw = buildRawMime({
    fromAddr,
    fromName: 'Dennis BF — Contact',
    to,
    replyTo: `${name.replace(/[<>\r\n]/g, '')} <${email}>`,
    subject: `[Contact] ${subject} — ${name}`,
    text,
  });

  try {
    await env.CONTACT.send(new EmailMessage(fromAddr, to, raw));
    return json({ ok: true });
  } catch (err) {
    console.error('contact mail failed', err?.message || err);
    return json({ ok: false, error: 'send_failed' }, 502);
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
