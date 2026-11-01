import { Router, type Request, type Response } from 'express';
import {
  CreateBookingRequestSchema,
  PhotographerProfileUpdateSchema,
  CreateAvailabilitySlotSchema,
  type PhotographerProfileRecord,
  type AvailabilitySlotRecord,
  type BookingRecord,
} from '@icx/shared-types';
import { query, withTransaction, recordAuditEvent } from '@icx/database';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  requestPhotographerSlotTransaction,
  ConcurrencyConflictError,
} from '../engines/concurrency.engine.js';
import { dispatchNotification } from '../engines/notification.engine.js';

export const bookingsRouter = Router();

// ============================================================================
// 1. GET /api/v1/bookings/photographers (PB-01)
// Filterable directory of admin-approved photographers ONLY.
// ============================================================================
bookingsRouter.get(
  '/photographers',
  async (req: Request, res: Response): Promise<void> => {
    const locationFilter = String(req.query.location || '').trim();
    const params: unknown[] = [];
    let locationClause = '';

    if (locationFilter) {
      params.push(`%${locationFilter}%`);
      locationClause = `AND pp.location ILIKE $1`;
    }

    const photogsRes = await query<
      PhotographerProfileRecord & { full_name: string }
    >(
      `SELECT pp.*, u.full_name
       FROM photographer_profiles pp
       JOIN users u ON u.id = pp.user_id
       WHERE pp.approval_status = 'approved'
         AND u.status = 'active'
         ${locationClause}
       ORDER BY pp.rating DESC, pp.created_at DESC`,
      params
    );

    res.status(200).json({ photographers: photogsRes.rows });
  }
);

// ============================================================================
// 2. GET /api/v1/bookings/photographers/:photographerId (PB-01, PB-02)
// Returns approved photographer profile + live availability slots.
// ============================================================================
bookingsRouter.get(
  '/photographers/:photographerId',
  async (req: Request, res: Response): Promise<void> => {
    const photographerId = String(req.params.photographerId || '');

    const profileRes = await query<
      PhotographerProfileRecord & { full_name: string }
    >(
      `SELECT pp.*, u.full_name
       FROM photographer_profiles pp
       JOIN users u ON u.id = pp.user_id
       WHERE pp.id = $1 AND pp.approval_status = 'approved'
       LIMIT 1`,
      [photographerId]
    );

    const profile = profileRes.rows[0];
    if (!profile) {
      res.status(404).json({
        error: 'PHOTOGRAPHER_NOT_FOUND',
        message: 'Approved photographer profile not found.',
      });
      return;
    }

    const slotsRes = await query<AvailabilitySlotRecord>(
      `SELECT *
       FROM availability_slots
       WHERE photographer_id = $1
         AND end_time > NOW()
       ORDER BY start_time ASC`,
      [photographerId]
    );

    res.status(200).json({
      photographer: profile,
      slots: slotsRes.rows,
    });
  }
);

// ============================================================================
// 3. POST /api/v1/bookings (PB-02, PB-03, NF-04)
// Requests a photographer slot and locks it for 48 hours inside a DB transaction.
// ============================================================================
bookingsRouter.post(
  '/',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = CreateBookingRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      });
      return;
    }

    try {
      const result = await requestPhotographerSlotTransaction({
        customerId: req.user!.sub,
        photographerProfileId: parsed.data.photographer_id,
        slotId: parsed.data.slot_id,
        serviceTitle: parsed.data.service_title,
      });

      res.status(201).json(result);
    } catch (error) {
      if (error instanceof ConcurrencyConflictError) {
        res.status(409).json({
          error: error.code,
          message: error.message,
        });
        return;
      }
      console.error('[ICX-BOOKINGS] Slot hold error:', error);
      res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    }
  }
);

// ============================================================================
// 4. GET /api/v1/bookings/my (Customer Booking History AC-08)
// ============================================================================
bookingsRouter.get(
  '/my',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const bookingsRes = await query(
      `SELECT b.*,
              u.full_name AS photographer_name,
              pp.location AS photographer_location,
              s.start_time,
              s.end_time,
              s.held_until,
              (SELECT COUNT(*) FROM photos p WHERE p.booking_id = b.id)::int AS deliverables_count
       FROM bookings b
       JOIN photographer_profiles pp ON pp.id = b.photographer_id
       JOIN users u ON u.id = pp.user_id
       JOIN availability_slots s ON s.id = b.slot_id
       WHERE b.customer_id = $1
       ORDER BY b.created_at DESC`,
      [req.user!.sub]
    );

    res.status(200).json({ bookings: bookingsRes.rows });
  }
);

// ============================================================================
// 5. GET /api/v1/bookings/:bookingId (Customer / Photographer / Admin detail view)
// ============================================================================
bookingsRouter.get(
  '/:bookingId',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const bookingId = String(req.params.bookingId || '');
    const bookingRes = await query<
      BookingRecord & {
        photographer_user_id: string;
        photographer_name: string;
        start_time: Date;
        end_time: Date;
      }
    >(
      `SELECT b.*,
              pp.user_id AS photographer_user_id,
              u.full_name AS photographer_name,
              s.start_time,
              s.end_time
       FROM bookings b
       JOIN photographer_profiles pp ON pp.id = b.photographer_id
       JOIN users u ON u.id = pp.user_id
       JOIN availability_slots s ON s.id = b.slot_id
       WHERE b.id = $1
       LIMIT 1`,
      [bookingId]
    );

    const booking = bookingRes.rows[0];
    if (!booking) {
      res.status(404).json({ error: 'BOOKING_NOT_FOUND' });
      return;
    }

    const userId = req.user!.sub;
    if (
      booking.customer_id !== userId &&
      booking.photographer_user_id !== userId &&
      req.user!.role !== 'admin'
    ) {
      res.status(403).json({ error: 'FORBIDDEN_BOOKING' });
      return;
    }

    const photosRes = await query<{ id: string; version: number; created_at: Date }>(
      'SELECT id, version, created_at FROM photos WHERE booking_id = $1 ORDER BY created_at ASC',
      [booking.id]
    );

    const paidRes = await query<{ total_paid: string }>(
      `SELECT COALESCE(SUM(amount), 0)::text AS total_paid
       FROM payments
       WHERE target_type = 'booking' AND target_id = $1 AND type != 'refund'`,
      [booking.id]
    );
    const isPaidInFull =
      BigInt(paidRes.rows[0]?.total_paid ?? '0') >= BigInt(booking.price);

    res.status(200).json({
      booking,
      deliverables: photosRes.rows.map((p) => ({
        id: p.id,
        version: p.version,
        created_at: p.created_at,
        previewUrl: `/api/v1/uploads/preview/${p.id}`,
      })),
      canDownloadClean: isPaidInFull,
    });
  }
);

// ============================================================================
// 6. PHOTOGRAPHER PORTAL ENDPOINTS (PP-01 through PP-06)
// ============================================================================

// GET /api/v1/bookings/photographer/workspace
bookingsRouter.get(
  '/photographer/workspace',
  requireAuth,
  requireRole('photographer', 'admin'),
  async (req: Request, res: Response): Promise<void> => {
    const profileRes = await query<PhotographerProfileRecord>(
      'SELECT * FROM photographer_profiles WHERE user_id = $1 LIMIT 1',
      [req.user!.sub]
    );
    const profile = profileRes.rows[0];

    if (!profile) {
      res.status(404).json({ error: 'PHOTOGRAPHER_PROFILE_NOT_FOUND' });
      return;
    }

    const slotsRes = await query<AvailabilitySlotRecord>(
      'SELECT * FROM availability_slots WHERE photographer_id = $1 ORDER BY start_time ASC',
      [profile.id]
    );

    // Note: Photographers NEVER see customer payment gateway details (PRD Privacy Rule)
    const inboxRes = await query(
      `SELECT b.id, b.service_title, b.price, b.commission_rate, b.commission_amount,
              b.status, b.created_at,
              u.full_name AS customer_name,
              s.start_time, s.end_time, s.held_until,
              (SELECT COUNT(*) FROM photos p WHERE p.booking_id = b.id)::int AS deliverables_count
       FROM bookings b
       JOIN users u ON u.id = b.customer_id
       JOIN availability_slots s ON s.id = b.slot_id
       WHERE b.photographer_id = $1
       ORDER BY b.created_at DESC`,
      [profile.id]
    );

    // PP-06: Earnings & Commission Ledger
    const completedBookings = inboxRes.rows.filter((b) =>
      ['delivered', 'completed'].includes(b.status)
    );
    const grossEarningsKobo = completedBookings.reduce(
      (acc, b) => acc + BigInt(b.price),
      0n
    );
    const totalCommissionKobo = completedBookings.reduce(
      (acc, b) => acc + BigInt(b.commission_amount),
      0n
    );
    const netPayableKobo = grossEarningsKobo - totalCommissionKobo;

    res.status(200).json({
      profile,
      slots: slotsRes.rows,
      bookings: inboxRes.rows,
      earningsSummary: {
        completedCount: completedBookings.length,
        grossEarningsKobo: grossEarningsKobo.toString(),
        totalCommissionKobo: totalCommissionKobo.toString(),
        netPayableKobo: netPayableKobo.toString(),
      },
    });
  }
);

// PUT /api/v1/bookings/photographer/profile (PP-01)
bookingsRouter.put(
  '/photographer/profile',
  requireAuth,
  requireRole('photographer', 'admin'),
  async (req: Request, res: Response): Promise<void> => {
    const parsed = PhotographerProfileUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      });
      return;
    }

    const { bio, location, portfolio_urls, services_and_prices } = parsed.data;
    const updated = await query<PhotographerProfileRecord>(
      `UPDATE photographer_profiles
       SET bio = $1,
           location = $2,
           portfolio_urls = $3::jsonb,
           services_and_prices = $4::jsonb
       WHERE user_id = $5
       RETURNING *`,
      [
        bio,
        location,
        JSON.stringify(portfolio_urls),
        JSON.stringify(services_and_prices),
        req.user!.sub,
      ]
    );

    res.status(200).json({ profile: updated.rows[0] });
  }
);

// POST /api/v1/bookings/photographer/slots (PP-02)
bookingsRouter.post(
  '/photographer/slots',
  requireAuth,
  requireRole('photographer', 'admin'),
  async (req: Request, res: Response): Promise<void> => {
    const parsed = CreateAvailabilitySlotSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      });
      return;
    }

    try {
      const profileRes = await query<{ id: string }>(
        'SELECT id FROM photographer_profiles WHERE user_id = $1 LIMIT 1',
        [req.user!.sub]
      );
      const profileId = profileRes.rows[0]?.id;
      if (!profileId) {
        res.status(404).json({ error: 'PHOTOGRAPHER_PROFILE_NOT_FOUND' });
        return;
      }

      const slotRes = await query<AvailabilitySlotRecord>(
        `INSERT INTO availability_slots (photographer_id, start_time, end_time, status)
         VALUES ($1, $2::timestamptz, $3::timestamptz, 'free')
         RETURNING *`,
        [profileId, parsed.data.start_time, parsed.data.end_time]
      );

      res.status(201).json({ slot: slotRes.rows[0] });
    } catch {
      res.status(409).json({
        error: 'OVERLAPPING_SLOT',
        message: 'This time slot overlaps with an existing availability slot on your schedule.',
      });
    }
  }
);

// POST /api/v1/bookings/:bookingId/respond (PB-04, PP-03: Accept or Decline)
bookingsRouter.post(
  '/:bookingId/respond',
  requireAuth,
  requireRole('photographer', 'admin'),
  async (req: Request, res: Response): Promise<void> => {
    const bookingId = String(req.params.bookingId || '');
    const decision = req.body?.decision as 'accept' | 'decline';

    if (!['accept', 'decline'].includes(decision)) {
      res.status(400).json({ error: 'INVALID_DECISION' });
      return;
    }

    const outcome = await withTransaction(async (client) => {
      const bookingRes = await client.query<
        BookingRecord & { photographer_user_id: string; customer_email: string }
      >(
        `SELECT b.*, pp.user_id AS photographer_user_id, u.email AS customer_email
         FROM bookings b
         JOIN photographer_profiles pp ON pp.id = b.photographer_id
         JOIN users u ON u.id = b.customer_id
         WHERE b.id = $1
         FOR UPDATE OF b`,
        [bookingId]
      );

      const booking = bookingRes.rows[0];
      if (!booking) {
        return { status: 404 as const, body: { error: 'BOOKING_NOT_FOUND' } };
      }

      if (
        booking.photographer_user_id !== req.user!.sub &&
        req.user!.role !== 'admin'
      ) {
        return { status: 403 as const, body: { error: 'FORBIDDEN' } };
      }

      if (booking.status !== 'requested') {
        return {
          status: 409 as const,
          body: {
            error: 'INVALID_BOOKING_STATE',
            message: `Booking is already in '${booking.status}' status.`,
          },
        };
      }

      if (decision === 'accept') {
        const updated = await client.query<BookingRecord>(
          `UPDATE bookings
           SET status = 'awaiting_payment'
           WHERE id = $1
           RETURNING *`,
          [booking.id]
        );
        return {
          status: 200 as const,
          body: { booking: updated.rows[0]! },
          customerEmail: booking.customer_email,
          customerId: booking.customer_id,
          decision,
        };
      } else {
        const updated = await client.query<BookingRecord>(
          `UPDATE bookings
           SET status = 'declined'
           WHERE id = $1
           RETURNING *`,
          [booking.id]
        );
        // Release held slot back to 'free' immediately
        await client.query(
          `UPDATE availability_slots
           SET status = 'free', held_until = NULL
           WHERE id = $1`,
          [booking.slot_id]
        );
        return {
          status: 200 as const,
          body: { booking: updated.rows[0]! },
          customerEmail: booking.customer_email,
          customerId: booking.customer_id,
          decision,
        };
      }
    });

    if (outcome.status === 200 && outcome.customerEmail) {
      await dispatchNotification({
        triggerId: 'NT-04',
        recipientEmail: outcome.customerEmail,
        recipientUserId: outcome.customerId,
        subject:
          outcome.decision === 'accept'
            ? 'Booking Accepted — Ready for Payment'
            : 'Booking Request Declined',
        htmlBody:
          outcome.decision === 'accept'
            ? '<p>Your photographer has accepted your booking request! You can now complete payment on your ICX Studios dashboard to confirm the shoot.</p>'
            : '<p>Unfortunately, the photographer was unable to accept this slot. You may select another slot or photographer at any time.</p>',
        targetEntity: 'bookings',
        targetId: bookingId,
      });
    }

    res.status(outcome.status).json(outcome.body);
  }
);

// POST /api/v1/bookings/:bookingId/complete (PB-07: Complete shoot & finalize commission)
bookingsRouter.post(
  '/:bookingId/complete',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const bookingId = String(req.params.bookingId || '');
    const bookingRes = await query<BookingRecord>(
      `UPDATE bookings
       SET status = 'completed'
       WHERE id = $1
         AND (customer_id = $2 OR $3 = 'admin')
         AND status = 'delivered'
       RETURNING *`,
      [bookingId, req.user!.sub, req.user!.role]
    );

    if (!bookingRes.rows[0]) {
      res.status(400).json({
        error: 'CANNOT_COMPLETE_BOOKING',
        message: 'Booking must be in delivered status before marking completed.',
      });
      return;
    }

    await recordAuditEvent({
      actorId: req.user!.sub,
      action: 'BOOKING_COMPLETED_COMMISSION_RECORDED',
      targetEntity: 'bookings',
      targetId: bookingId,
      details: {
        commissionRate: bookingRes.rows[0].commission_rate,
        commissionAmount: bookingRes.rows[0].commission_amount,
      },
    });

    res.status(200).json({ booking: bookingRes.rows[0] });
  }
);

// ============================================================================
// 7. POST /api/v1/bookings/:bookingId/cancel (PB-08: Booking Cancellation)
// Customer can cancel before payment confirmation; after payment, only Admin can cancel.
// ============================================================================
bookingsRouter.post(
  '/:bookingId/cancel',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const bookingId = String(req.params.bookingId || '');
    const userId = req.user!.sub;
    const isAdmin = req.user!.role === 'admin';

    const outcome = await withTransaction(async (client) => {
      const bookingRes = await client.query<BookingRecord>(
        'SELECT * FROM bookings WHERE id = $1 FOR UPDATE',
        [bookingId]
      );
      const booking = bookingRes.rows[0];
      if (!booking) {
        return { status: 404 as const, body: { error: 'BOOKING_NOT_FOUND' } };
      }

      if (booking.customer_id !== userId && !isAdmin) {
        return { status: 403 as const, body: { error: 'FORBIDDEN' } };
      }

      if (booking.status === 'completed' || booking.status === 'cancelled') {
        return {
          status: 400 as const,
          body: {
            error: 'CANNOT_CANCEL',
            message: `Booking is already ${booking.status}.`,
          },
        };
      }

      // PB-08: Customer can only cancel before payment confirmation; post-payment requires Admin
      const isPostPayment = ['confirmed', 'delivered'].includes(booking.status);
      if (isPostPayment && !isAdmin) {
        return {
          status: 403 as const,
          body: {
            error: 'ADMIN_REQUIRED_POST_PAYMENT',
            message:
              'Confirmed bookings that have been paid require an ICX Administrator to cancel and process a refund.',
          },
        };
      }

      const updated = await client.query<BookingRecord>(
        `UPDATE bookings SET status = 'cancelled' WHERE id = $1 RETURNING *`,
        [booking.id]
      );

      await client.query(
        `UPDATE availability_slots
         SET status = 'free', held_until = NULL
         WHERE id = $1`,
        [booking.slot_id]
      );

      await recordAuditEvent(
        {
          actorId: userId,
          action: 'BOOKING_CANCELLED',
          targetEntity: 'bookings',
          targetId: booking.id,
          details: { previousStatus: booking.status, cancelledByRole: req.user!.role },
        },
        client
      );

      return { status: 200 as const, body: { booking: updated.rows[0]! } };
    });

    res.status(outcome.status).json(outcome.body);
  }
);

// ============================================================================
// 8. POST /api/v1/bookings/:bookingId/rate (PB-09: Customer Rating of Photographer)
// ============================================================================
bookingsRouter.post(
  '/:bookingId/rate',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const bookingId = String(req.params.bookingId || '');
    const ratingValue = Number(req.body?.rating);

    if (!Number.isFinite(ratingValue) || ratingValue < 1 || ratingValue > 5) {
      res.status(400).json({
        error: 'INVALID_RATING',
        message: 'Rating must be between 1 and 5 stars.',
      });
      return;
    }

    const outcome = await withTransaction(async (client) => {
      const bookingRes = await client.query<BookingRecord>(
        'SELECT * FROM bookings WHERE id = $1 AND customer_id = $2 LIMIT 1',
        [bookingId, req.user!.sub]
      );
      const booking = bookingRes.rows[0];

      if (!booking || !['delivered', 'completed'].includes(booking.status)) {
        return {
          status: 400 as const,
          body: {
            error: 'BOOKING_NOT_ELIGIBLE_FOR_RATING',
            message: 'You can only rate a photographer after shoot deliverables are received.',
          },
        };
      }

      // Update rolling average rating on photographer_profiles
      const updatedProfile = await client.query<{ rating: string }>(
        `UPDATE photographer_profiles
         SET rating = ROUND(((rating * 4 + $1::numeric) / 5), 2)
         WHERE id = $2
         RETURNING rating`,
        [ratingValue, booking.photographer_id]
      );

      await recordAuditEvent(
        {
          actorId: req.user!.sub,
          action: 'PHOTOGRAPHER_RATED_BY_CUSTOMER',
          targetEntity: 'photographer_profiles',
          targetId: booking.photographer_id,
          details: { bookingId, ratingGiven: ratingValue },
        },
        client
      );

      return {
        status: 200 as const,
        body: {
          status: 'rating_recorded',
          newRating: updatedProfile.rows[0]?.rating,
        },
      };
    });

    res.status(outcome.status).json(outcome.body);
  }
);


