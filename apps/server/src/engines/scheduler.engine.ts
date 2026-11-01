import { query } from '@icx/database';
import { dispatchNotification } from './notification.engine.js';

/**
 * Requirement PE-11 & NT-08:
 * Automated background scheduler dispatching:
 * 1. Balance reminder emails at 3, 7, and 14 days after edits are ready (`PE-11`).
 * 2. Rental return reminder emails 1 day before `end_date` (`NT-08`).
 */
export async function runScheduledNotificationsSweep(): Promise<{
  balanceRemindersSent: number;
  rentalReturnRemindersSent: number;
}> {
  let balanceRemindersSent = 0;
  let rentalReturnRemindersSent = 0;

  // 1. PE-11: Balance reminder emails at 3, 7, and 14 days after edits are ready
  const balanceOrdersRes = await query<{
    id: string;
    customer_id: string;
    balance_amount: string;
    email: string;
    days_elapsed: number;
  }>(`
    SELECT
      eo.id,
      eo.customer_id,
      eo.balance_amount::text AS balance_amount,
      u.email,
      EXTRACT(DAY FROM (NOW() - eo.created_at))::int AS days_elapsed
    FROM edit_orders eo
    JOIN users u ON u.id = eo.customer_id
    WHERE eo.status = 'ready_for_review'
      AND eo.payment_state = 'deposit_paid'
      AND EXTRACT(DAY FROM (NOW() - eo.created_at))::int IN (3, 7, 14)
      AND NOT EXISTS (
        SELECT 1 FROM audit_events ae
        WHERE ae.target_entity = 'edit_orders'
          AND ae.target_id = eo.id
          AND ae.action = 'NOTIFICATION_SENT_NT-02'
          AND ae.created_at > NOW() - INTERVAL '20 hours'
      )
  `);

  for (const row of balanceOrdersRes.rows) {
    await dispatchNotification({
      triggerId: 'NT-02',
      recipientEmail: row.email,
      recipientUserId: row.customer_id,
      subject: `Day ${row.days_elapsed} Reminder: Your Edited Photos Await Balance Settlement`,
      htmlBody: `<p>Your edited photo proofs for Order <strong>#${row.id.slice(0, 8)}</strong> are ready. Settle your remaining balance of <strong>NGN ${(Number(row.balance_amount) / 100).toLocaleString()}</strong> to unlock 24-hour clean full-resolution downloads.</p>`,
      targetEntity: 'edit_orders',
      targetId: row.id,
    });
    balanceRemindersSent++;
  }

  // 2. NT-08: Rental return reminder 1 day before end_date
  const rentalsDueRes = await query<{
    id: string;
    customer_id: string;
    end_date: string;
    item_name: string;
    email: string;
  }>(`
    SELECT
      r.id,
      r.customer_id,
      r.end_date::text AS end_date,
      ei.name AS item_name,
      u.email
    FROM rentals r
    JOIN equipment_items ei ON ei.id = r.item_id
    JOIN users u ON u.id = r.customer_id
    WHERE r.status = 'out'
      AND r.end_date = (CURRENT_DATE + INTERVAL '1 day')::date
      AND NOT EXISTS (
        SELECT 1 FROM audit_events ae
        WHERE ae.target_entity = 'rentals'
          AND ae.target_id = r.id
          AND ae.action = 'NOTIFICATION_SENT_NT-08'
      )
  `);

  for (const r of rentalsDueRes.rows) {
    await dispatchNotification({
      triggerId: 'NT-08',
      recipientEmail: r.email,
      recipientUserId: r.customer_id,
      subject: `Equipment Return Reminder: ${r.item_name} Due Tomorrow`,
      htmlBody: `<p>Friendly reminder that your rental of <strong>${r.item_name}</strong> is scheduled for studio return tomorrow (${r.end_date.slice(0, 10)}).</p>`,
      targetEntity: 'rentals',
      targetId: r.id,
    });
    rentalReturnRemindersSent++;
  }

  return { balanceRemindersSent, rentalReturnRemindersSent };
}

