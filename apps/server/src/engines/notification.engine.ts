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
  | 'NT-08'; // Rental return reminder, 1 day before end date (Customer)

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
 * Dispatches transactional email notifications (Requirements NT-01 through NT-08)
 * via Resend HTTP API when configured, and records a verifiable audit event.
 */
export async function dispatchNotification(
  params: DispatchNotificationParams
): Promise<void> {
  try {
    const apiKey = process.env.SMTP_PASS;
    const fromAddress = process.env.EMAIL_FROM || 'notifications@icxstudios.com';

    if (
      apiKey &&
      apiKey.startsWith('re_') &&
      apiKey !== 're_replace_with_actual_key'
    ) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `ICX Studios <${fromAddress}>`,
          to: [params.recipientEmail],
          subject: `[ICX Studios] ${params.subject}`,
          html: params.htmlBody,
        }),
      });
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

