import { Router, type Request, type Response } from 'express';
import {
  CreateRentalHoldSchema,
  type EquipmentItemRecord,
  type RentalRecord,
} from '@icx/shared-types';
import { query } from '@icx/database';
import { requireAuth } from '../middleware/auth.js';
import {
  reserveRentalHoldTransaction,
  getEquipmentAvailabilityCalendar,
  ConcurrencyConflictError,
} from '../engines/concurrency.engine.js';

export const rentalsRouter = Router();

// ============================================================================
// 1. GET /api/v1/rentals/equipment (ER-01)
// Returns active equipment inventory items.
// ============================================================================
rentalsRouter.get('/equipment', async (_req: Request, res: Response): Promise<void> => {
  const equipRes = await query<EquipmentItemRecord>(
    `SELECT *
     FROM equipment_items
     WHERE active = true AND condition != 'retired'
     ORDER BY daily_price ASC`
  );

  const formConfigRes = await query<{ value: Record<string, unknown> }>(
    "SELECT value FROM platform_settings WHERE key = 'rental_form_config' LIMIT 1"
  );

  res.status(200).json({
    equipment: equipRes.rows,
    rentalFormConfig: formConfigRes.rows[0]?.value ?? {},
  });
});

// ============================================================================
// 2. GET /api/v1/rentals/equipment/:itemId/availability (ER-02, ER-03)
// Returns day-by-day unit availability so calendar disables dates with 0 free units.
// ============================================================================
rentalsRouter.get(
  '/equipment/:itemId/availability',
  async (req: Request, res: Response): Promise<void> => {
    const itemId = String(req.params.itemId || '');
    const today = new Date();
    const defaultFrom = today.toISOString().slice(0, 10);
    const future = new Date(today.getTime() + 45 * 24 * 60 * 60 * 1000);
    const defaultTo = future.toISOString().slice(0, 10);

    const fromDate = String(req.query.from || defaultFrom);
    const toDate = String(req.query.to || defaultTo);

    try {
      const availability = await getEquipmentAvailabilityCalendar(
        itemId,
        fromDate,
        toDate
      );
      res.status(200).json(availability);
    } catch (error) {
      if (error instanceof ConcurrencyConflictError) {
        res.status(404).json({ error: error.code, message: error.message });
        return;
      }
      res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    }
  }
);

// ============================================================================
// 3. POST /api/v1/rentals/hold (ER-04, ER-05, ER-06, NF-04)
// Holds requested units for 30 minutes inside a row-locked PostgreSQL transaction.
// ============================================================================
rentalsRouter.post(
  '/hold',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = CreateRentalHoldSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      });
      return;
    }

    try {
      const rental = await reserveRentalHoldTransaction({
        customerId: req.user!.sub,
        itemId: parsed.data.item_id,
        units: parsed.data.units,
        startDate: parsed.data.start_date,
        endDate: parsed.data.end_date,
        formDetails: parsed.data.form_details,
      });

      res.status(201).json({
        rental,
        holdExpiresAt: rental.held_until,
      });
    } catch (error) {
      if (error instanceof ConcurrencyConflictError) {
        res.status(409).json({
          error: error.code,
          message: error.message,
        });
        return;
      }
      console.error('[ICX-RENTALS] Rental hold error:', error);
      res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    }
  }
);

// ============================================================================
// 4. GET /api/v1/rentals/my (Customer Rental History AC-08)
// ============================================================================
rentalsRouter.get(
  '/my',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const rentalsRes = await query<RentalRecord & { item_name: string; daily_price: string }>(
      `SELECT r.*, ei.name AS item_name, ei.daily_price
       FROM rentals r
       JOIN equipment_items ei ON ei.id = r.item_id
       WHERE r.customer_id = $1
       ORDER BY r.created_at DESC`,
      [req.user!.sub]
    );

    res.status(200).json({ rentals: rentalsRes.rows });
  }
);

