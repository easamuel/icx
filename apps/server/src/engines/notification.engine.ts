import tls from 'node:tls';
import net from 'node:net';
import crypto from 'node:crypto';
import { recordAuditEvent } from '@icx/database';
import { env } from '../config/env.js';

export type NotificationTriggerId =
  | 'NT-01' // Payment confirmed for any order, booking or rental (Customer)
  | 'NT-02' // Edits ready for review (Customer)
  | 'NT-03' // New booking request (Photographer)
  | 'NT-04' // Booking confirmed or declined (Customer)
  | 'NT-05' // New editing job or revision request (Assigned editor)
  | 'NT-06' // New photographer application (Admin)
  | 'NT-07' // Photographer application approved (Photographer)
  | 'NT-08' // Rental return reminder, 1 day before end date (Customer)
  | 'NT-AUTH-VERIFY' // Account registration email confirmation
  | 'NT-AUTH-RESET' // Password reset email
  | 'NT-AUTH-INVITE' // Admin staff invitation email
  | 'NT-ROLE-UPGRADE'; // User role upgraded email notification

interface DispatchNotificationParams {
  triggerId: NotificationTriggerId;
  recipientEmail: string;
  recipientUserId?: string | null;
  subject: string;
  htmlBody: string;
  targetEntity: string;
  targetId: string;
}

/**
 * Wraps email content in a clean, authoritative ICX Studios transactional layout.
 */
export function buildStudioEmailTemplate(options: {
  heading: string;
  subheading?: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
}): string {
  const ctaBlock =
    options.ctaLabel && options.ctaUrl
      ? `
      <div style="margin: 28px 0;">
        <a href="${options.ctaUrl}" style="display: inline-block; background-color: #09090B; color: #FFFFFF; font-weight: 700; font-size: 14px; text-decoration: none; padding: 14px 28px; border-radius: 8px;">
          ${options.ctaLabel}
        </a>
      </div>
      <p style="font-size: 12px; color: #71717A; margin-top: 8px; word-break: break-all;">
        Or copy and paste this link into your browser:<br/>
        <a href="${options.ctaUrl}" style="color: #09090B;">${options.ctaUrl}</a>
      </p>`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${options.heading}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F4F4F5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #09090B;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F4F4F5; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #FFFFFF; border: 1px solid #E4E4E7; border-radius: 12px; overflow: hidden;">
          <tr>
            <td style="background-color: #09090B; padding: 20px 32px;">
              <span style="color: #E6D8C3; font-size: 20px; font-weight: 900; letter-spacing: 1.5px;">ICX STUDIOS</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <h1 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 800; color: #09090B; line-height: 1.3;">
                ${options.heading}
              </h1>
              ${
                options.subheading
                  ? `<p style="margin: 0 0 20px 0; font-size: 14px; font-weight: 600; color: #52525B;">${options.subheading}</p>`
                  : ''
              }
              <div style="font-size: 14px; line-height: 1.65; color: #27272A;">
                ${options.bodyHtml}
              </div>
              ${ctaBlock}
              ${
                options.footerNote
                  ? `<p style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #E4E4E7; font-size: 12px; color: #71717A;">${options.footerNote}</p>`
                  : ''
              }
            </td>
          </tr>
          <tr>
            <td style="background-color: #FAFAFA; border-top: 1px solid #E4E4E7; padding: 20px 32px; font-size: 12px; color: #71717A;">
              <strong>ICX Studios Limited</strong> • Victoria Island &amp; Lekki Phase 1, Lagos • Maitama, Abuja<br/>
              <a href="https://icxora.com" style="color: #09090B; text-decoration: none; font-weight: 600;">icxora.com</a> • support@icxora.com
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Native RFC 5321 / 5322 SMTP over TLS client supporting Implicit TLS (Port 465)
 * and STARTTLS / Plain (Port 587 / 25) for self-hosted mail.icxora.com.
 */
async function sendViaSmtp(options: {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromHeader: string;
  fromEnvelope: string;
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const isImplicitTls = options.port === 465;
    let socket: net.Socket | tls.TLSSocket = isImplicitTls
      ? tls.connect({
          host: options.host,
          port: options.port,
          servername: options.host,
          rejectUnauthorized: false,
        })
      : net.createConnection({ host: options.host, port: options.port });

    socket.setTimeout(15000);

    let buffer = '';
    let step = 0;
    let upgraded = isImplicitTls;

    const sendLine = (line: string) => {
      socket.write(line + '\r\n');
    };

    const advance = (code: number, fullResponse: string) => {
      if (code >= 400) {
        socket.destroy();
        reject(new Error(`SMTP Error ${code}: ${fullResponse.trim()}`));
        return;
      }

      if (step === 0 && code === 220) {
        step = 1;
        sendLine(`EHLO icxora.com`);
      } else if (step === 1 && code === 250) {
        if (!upgraded && fullResponse.includes('STARTTLS')) {
          step = 2;
          sendLine('STARTTLS');
        } else {
          step = 3;
          const authPlain = Buffer.from(`\0${options.user}\0${options.pass}`).toString('base64');
          sendLine(`AUTH PLAIN ${authPlain}`);
        }
      } else if (step === 2 && code === 220) {
        upgraded = true;
        const tlsSocket = tls.connect({
          socket,
          servername: options.host,
          rejectUnauthorized: false,
        });
        socket = tlsSocket;
        tlsSocket.on('data', onData);
        tlsSocket.on('error', onError);
        step = 1;
        sendLine(`EHLO icxora.com`);
      } else if (step === 3 && code === 235) {
        step = 4;
        sendLine(`MAIL FROM:<${options.fromEnvelope}>`);
      } else if (step === 4 && code === 250) {
        step = 5;
        sendLine(`RCPT TO:<${options.to}>`);
      } else if (step === 5 && (code === 250 || code === 251)) {
        step = 6;
        sendLine('DATA');
      } else if (step === 6 && code === 354) {
        step = 7;
        const msgId = `<${crypto.randomUUID()}@icxora.com>`;
        const dateStr = new Date().toUTCString();
        const encodedSubject = `=?UTF-8?B?${Buffer.from(options.subject).toString('base64')}?=`;
        const base64Html = Buffer.from(options.html, 'utf8')
          .toString('base64')
          .replace(/(.{76})/g, '$1\r\n');

        const mimeMessage = [
          `From: ${options.fromHeader}`,
          `To: <${options.to}>`,
          `Subject: ${encodedSubject}`,
          `Message-ID: ${msgId}`,
          `Date: ${dateStr}`,
          `MIME-Version: 1.0`,
          `Content-Type: text/html; charset=UTF-8`,
          `Content-Transfer-Encoding: base64`,
          ``,
          base64Html,
          `.`,
        ].join('\r\n');

        sendLine(mimeMessage);
      } else if (step === 7 && code === 250) {
        step = 8;
        sendLine('QUIT');
        socket.end();
        resolve();
      }
    };

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split('\r\n');
      buffer = lines.pop() || '';

      let accumulated = '';
      for (const line of lines) {
        accumulated += line + '\n';
        if (line.length >= 4 && line[3] === ' ') {
          const code = parseInt(line.slice(0, 3), 10);
          advance(code, accumulated);
          accumulated = '';
        } else if (line.length === 3) {
          const code = parseInt(line, 10);
          advance(code, accumulated);
          accumulated = '';
        }
      }
    };

    const onError = (err: Error) => {
      socket.destroy();
      reject(err);
    };

    socket.on('data', onData);
    socket.on('error', onError);
    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('SMTP connection timed out'));
    });
  });
}

/**
 * Dispatches transactional email notifications via self-hosted SMTP (mail.icxora.com)
 * or Resend HTTP API when configured, and records a verifiable audit event.
 */
export async function dispatchNotification(
  params: DispatchNotificationParams
): Promise<void> {
  try {
    const smtpHost = process.env.SMTP_HOST || 'mail.icxora.com';
    const smtpPort = Number(process.env.SMTP_PORT || 465);
    const smtpUser = process.env.SMTP_USER || 'no-reply@icxora.com';
    const smtpPass = process.env.SMTP_PASS || '';
    const rawFrom = process.env.EMAIL_FROM || 'ICX Studios <no-reply@icxora.com>';

    const envelopeMatch = rawFrom.match(/<([^>]+)>/);
    const fromEnvelope = envelopeMatch ? envelopeMatch[1]! : smtpUser;
    const fromHeader = rawFrom.includes('<') ? rawFrom : `ICX Studios <${rawFrom}>`;

    if (
      smtpPass &&
      smtpPass.startsWith('re_') &&
      smtpPass !== 're_replace_with_actual_key'
    ) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${smtpPass}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromHeader,
          to: [params.recipientEmail],
          subject: params.subject,
          html: params.htmlBody,
        }),
      });
    } else if (
      smtpHost &&
      smtpUser &&
      smtpPass &&
      smtpPass !== 're_replace_with_actual_key' &&
      env.NODE_ENV !== 'test'
    ) {
      await sendViaSmtp({
        host: smtpHost,
        port: smtpPort,
        user: smtpUser,
        pass: smtpPass,
        fromHeader,
        fromEnvelope,
        to: params.recipientEmail,
        subject: params.subject,
        html: params.htmlBody,
      });
      console.log(
        `[ICX-SMTP] Delivered (${params.triggerId}) -> ${params.recipientEmail} | ${params.subject}`
      );
    } else if (env.NODE_ENV !== 'test') {
      console.log(
        `[ICX-NOTIFY] (${params.triggerId}) -> ${params.recipientEmail} | ${params.subject}`
      );
    }

    await recordAuditEvent({
      actorId: params.recipientUserId ?? null,
      action: `NOTIFICATION_SENT_${params.triggerId}`,
      targetEntity: params.targetEntity,
      targetId: params.targetId,
      details: {
        triggerId: params.triggerId,
        recipientEmail: params.recipientEmail,
        subject: params.subject,
      },
    });
  } catch (err) {
    console.error(`[ICX-NOTIFY] Failed to dispatch ${params.triggerId}:`, err);
  }
}
