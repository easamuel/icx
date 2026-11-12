import { withTransaction, query, recordAuditEvent } from '@icx/database';
import type {
  RentalRecord,
  BookingRecord,
  EquipmentItemRecord,
  AvailabilitySlotRecord,
} from '@icx/shared-types';
import { redis, RedisKeys } from '../lib/redis.js';
import { dispatchNotification } from './notification.engine.js';

export class ConcurrencyConflictError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * Requirement ER-03, ER-06, NF-04:
 * Reserves rental units for 30 minutes inside an ACID PostgreSQL transaction with row-level locks.
 * Two concurrent requests can never overbook the available units of an equipment item.
 */
export async function reserveRentalHoldTransaction(params: {
  customerId: string;
  itemId: string;
  units: number;
  startDate: string;
  endDate: string;
  formDetails: Record<string, unknown>;
}): Promise<RentalRecord> {
  const start = new Date(`${params.startDate}T00:00:00Z`);
  const end = new Date(`${params.endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    throw new ConcurrencyConflictError(
      'INVALID_DATE_RANGE',
      'End date must be on or after start date.'
    );
  }

  const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const rental = await withTransaction(async (client) => {
    // 1. Lock the parent equipment item row first to serialize concurrent holds for the same item
    const itemRes = await client.query<EquipmentItemRecord>(
      `SELECT * FROM equipment_items
       WHERE id = $1
       FOR UPDATE`,
      [params.itemId]
    );

    const item = itemRes.rows[0];
    if (!item || !item.active) {
      throw new ConcurrencyConflictError(
        'EQUIPMENT_UNAVAILABLE',
        'Equipment item is not active or does not exist.'
      );
    }

    if (item.condition === 'under_repair' || item.condition === 'retired') {
      throw new ConcurrencyConflictError(
        'EQUIPMENT_UNDER_REPAIR',
        `This equipment item is currently marked as ${item.condition.replace('_', ' ')} and cannot be rented.`
      );
    }

    // 2. Lock overlapping rentals and sum reserved units per specification:
    // SELECT sum(units) FROM rentals WHERE item_id = $1 AND (status IN ('confirmed', 'out') OR (status = 'held' AND held_until > NOW())) AND daterange(start_date, end_date, '[]') && daterange($2, $3, '[]') FOR UPDATE;
    const overlappingRows = await client.query<{ units: number }>(
      `SELECT units
       FROM rentals
       WHERE item_id = $1
         AND (status IN ('confirmed', 'out') OR (status = 'held' AND held_until > NOW()))
         AND daterange(start_date, end_date, '[]') && daterange($2::date, $3::date, '[]')
       FOR UPDATE`,
      [params.itemId, params.startDate, params.endDate]
    );

    const reservedUnits = overlappingRows.rows.reduce(
      (sum, row) => sum + Number(row.units),
      0
    );
    const availableUnits = item.total_units - reservedUnits;

    if (params.units > availableUnits) {
      throw new ConcurrencyConflictError(
        'INSUFFICIENT_UNITS_AVAILABLE',
        `Only ${Math.max(0, availableUnits)} unit(s) available for the selected dates (${params.startDate} to ${params.endDate}).`
      );
    }

    // ER-05: Rental total = daily_price * days * units
    const totalAmount =
      BigInt(item.daily_price) * BigInt(days) * BigInt(params.units);

    const insertRes = await client.query<RentalRecord>(
      `INSERT INTO rentals (
         customer_id, item_id, units, start_date, end_date,
         total_amount, form_details, status, held_until
       )
       VALUES (
         $1, $2, $3, $4::date, $5::date,
         $6, $7::jsonb, 'held', NOW() + INTERVAL '30 minutes'
       )
       RETURNING *`,
      [
        params.customerId,
        params.itemId,
        params.units,
        params.startDate,
        params.endDate,
        totalAmount.toString(),
        JSON.stringify(params.formDetails),
      ]
    );

    const createdRental = insertRes.rows[0]!;

    await recordAuditEvent(
      {
        actorId: params.customerId,
        action: 'RENTAL_HOLD_CREATED',
        targetEntity: 'rentals',
        targetId: createdRental.id,
        details: {
          itemId: params.itemId,
          units: params.units,
          startDate: params.startDate,
          endDate: params.endDate,
          days,
          totalAmount: totalAmount.toString(),
        },
      },
      client
    );

    return createdRental;
  });

  // Track 30-minute hold TTL in Redis for fast inspection
  await redis
    .set(RedisKeys.rentalHoldTTL(rental.id), String(rental.units), 'EX', 1800)
    .catch(() => undefined);

  return rental;
}

/**
 * Requirement ER-02, ER-03:
 * Computes day-by-day remaining unit availability for an equipment item across a date range
 * so the frontend calendar disables dates where 0 units are free.
 */
export async function getEquipmentAvailabilityCalendar(
  itemId: string,
  fromDate: string,
  toDate: string
): Promise<{
  itemId: string;
  totalUnits: number;
  condition: string;
  dates: Array<{ date: string; reservedUnits: number; availableUnits: number }>;
}> {
  const itemRes = await query<EquipmentItemRecord>(
    'SELECT * FROM equipment_items WHERE id = $1 LIMIT 1',
    [itemId]
  );
  const item = itemRes.rows[0];
  if (!item) {
    throw new ConcurrencyConflictError('ITEM_NOT_FOUND', 'Equipment item not found.');
  }

  const rentalsRes = await query<{
    units: number;
    start_date: string;
    end_date: string;
  }>(
    `SELECT units, start_date::text AS start_date, end_date::text AS end_date
     FROM rentals
     WHERE item_id = $1
       AND (status IN ('confirmed', 'out') OR (status = 'held' AND held_until > NOW()))
       AND daterange(start_date, end_date, '[]') && daterange($2::date, $3::date, '[]')`,
    [itemId, fromDate, toDate]
  );

  const isBlockedByCondition =
    !item.active ||
    item.condition === 'under_repair' ||
    item.condition === 'retired';

  const dates: Array<{ date: string; reservedUnits: number; availableUnits: number }> = [];
  const cursor = new Date(`${fromDate}T00:00:00Z`);
  const end = new Date(`${toDate}T00:00:00Z`);

  while (cursor <= end) {
    const dayStr = cursor.toISOString().slice(0, 10);
    let reserved = 0;

    for (const r of rentalsRes.rows) {
      if (dayStr >= r.start_date.slice(0, 10) && dayStr <= r.end_date.slice(0, 10)) {
        reserved += Number(r.units);
      }
    }

    const available = isBlockedByCondition
      ? 0
      : Math.max(0, item.total_units - reserved);

    dates.push({
      date: dayStr,
      reservedUnits: reserved,
      availableUnits: available,
    });

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return {
    itemId: item.id,
    totalUnits: item.total_units,
    condition: item.condition,
    dates,
  };
}

const DEFAULT_PACKAGE_PRICES: Record<string, number> = {
  'Studio walk in': 7500000,
  'Half day event booking': 15000000,
  'Full day event booking': 28000000,
};

export async function requestDatePackageBookingTransaction(params: {
  customerId: string;
  photographerProfileId: string;
  bookingDate: string;
  packageType: 'Studio walk in' | 'Half day event booking' | 'Full day event booking';
  timePeriod?: string;
  notes?: string;
}): Promise<{ booking: BookingRecord }> {
  const result = await withTransaction(async (client) => {
    // Lock photographer profile row FOR UPDATE to serialize concurrent date/period checks
    const photogRes = await client.query<{
      id: string;
      user_id: string;
      approval_status: string;
      user_status: string;
      email_verified_at: Date | null;
      services_and_prices: Array<{ title: string; price: number }>;
      email: string;
      full_name: string;
    }>(
      `SELECT pp.id, pp.user_id, pp.approval_status, u.status AS user_status, u.email_verified_at,
              pp.services_and_prices, u.email, u.full_name
       FROM photographer_profiles pp
       JOIN users u ON u.id = pp.user_id
       WHERE pp.id = $1
       FOR UPDATE OF pp`,
      [params.photographerProfileId]
    );

    const photog = photogRes.rows[0];
    if (
      !photog ||
      photog.approval_status !== 'approved' ||
      photog.user_status !== 'active' ||
      !photog.email_verified_at
    ) {
      throw new ConcurrencyConflictError(
        'PHOTOGRAPHER_NOT_APPROVED',
        'This photographer is not currently verified and approved to take bookings.'
      );
    }

    const existingBookings = await client.query<{
      package_type: string | null;
      time_period: string | null;
    }>(
      `SELECT package_type, time_period
       FROM bookings
       WHERE photographer_id = $1
         AND booking_date = $2::date
         AND status NOT IN ('cancelled', 'declined', 'expired')`,
      [params.photographerProfileId, params.bookingDate]
    );

    const activeRows = existingBookings.rows;
    const hasFullDay = activeRows.some((r) => r.package_type === 'Full day event booking');

    if (hasFullDay) {
      throw new ConcurrencyConflictError(
        'DATE_UNAVAILABLE',
        'This date is already booked for a Full day event booking.'
      );
    }

    if (params.packageType === 'Full day event booking' && activeRows.length > 0) {
      throw new ConcurrencyConflictError(
        'FULL_DAY_UNAVAILABLE',
        'Full day event booking is unavailable because a time period on this date is already reserved.'
      );
    }

    if (params.packageType !== 'Full day event booking') {
      if (!params.timePeriod) {
        throw new ConcurrencyConflictError(
          'TIME_PERIOD_REQUIRED',
          'A time period is required for this booking package.'
        );
      }
      const periodTaken = activeRows.some((r) => r.time_period === params.timePeriod);
      if (periodTaken) {
        throw new ConcurrencyConflictError(
          'TIME_PERIOD_UNAVAILABLE',
          `${params.timePeriod} is already booked on ${params.bookingDate}. Please choose another time period.`
        );
      }
    }

    const settingsRes = await client.query<{ value: { photographer_commission_rate?: number } }>(
      `SELECT value FROM platform_settings WHERE key = 'commission_rates' LIMIT 1`
    );
    const commissionRate = Number(
      settingsRes.rows[0]?.value?.photographer_commission_rate ?? 15.0
    );

    const matchedService = (photog.services_and_prices || []).find(
      (s) => s.title.toLowerCase() === params.packageType.toLowerCase()
    );
    const priceBigInt = BigInt(
      matchedService ? Number(matchedService.price) : DEFAULT_PACKAGE_PRICES[params.packageType] || 15000000
    );
    const commissionAmount =
      (priceBigInt * BigInt(Math.round(commissionRate * 100))) / 10000n;

    const bookingRes = await client.query<BookingRecord>(
      `INSERT INTO bookings (
         customer_id, photographer_id, slot_id, service_title,
         booking_date, package_type, time_period, notes,
         price, commission_rate, commission_amount, status
       )
       VALUES ($1, $2, NULL, $3, $4::date, $5, $6, $7, $8, $9, $10, 'requested')
       RETURNING *`,
      [
        params.customerId,
        params.photographerProfileId,
        params.timePeriod ? `${params.packageType} — ${params.timePeriod}` : params.packageType,
        params.bookingDate,
        params.packageType,
        params.packageType === 'Full day event booking' ? null : params.timePeriod || null,
        params.notes || null,
        priceBigInt.toString(),
        commissionRate.toFixed(2),
        commissionAmount.toString(),
      ]
    );

    const booking = bookingRes.rows[0]!;

    await recordAuditEvent(
      {
        actorId: params.customerId,
        action: 'BOOKING_CREATED',
        targetEntity: 'bookings',
        targetId: booking.id,
        details: {
          photographerId: params.photographerProfileId,
          bookingDate: params.bookingDate,
          packageType: params.packageType,
          timePeriod: params.timePeriod || null,
        },
      },
      client
    );

    return { booking, photographerEmail: photog.email, photographerName: photog.full_name };
  });

  await dispatchNotification({
    triggerId: 'NT-05',
    recipientEmail: result.photographerEmail,
    recipientUserId: params.photographerProfileId,
    subject: `New ${params.packageType} Booking Request (${params.bookingDate})`,
    htmlBody: `<p>You have a new <strong>${params.packageType}</strong> request for <strong>${params.bookingDate}</strong>${params.timePeriod ? ` (${params.timePeriod})` : ''}. Review it in your Photographer Portal.</p>`,
    targetEntity: 'bookings',
    targetId: result.booking.id,
  });

  return { booking: result.booking };
}

/**
 * Requirement PB-03, PB-04, PB-07, NF-04:
 * Atomically locks a photographer availability slot for 48 hours and creates a booking request.
 */
export async function requestPhotographerSlotTransaction(params: {
  customerId: string;
  photographerProfileId: string;
  slotId: string;
  serviceTitle: string;
}): Promise<{ booking: BookingRecord; slot: AvailabilitySlotRecord }> {
  const result = await withTransaction(async (client) => {
    // 1. Verify photographer profile is approved (live only when approved by admin)
    const photogRes = await client.query<{
      id: string;
      user_id: string;
      approval_status: string;
      services_and_prices: Array<{ title: string; price: number }>;
      email: string;
    }>(
      `SELECT pp.id, pp.user_id, pp.approval_status, pp.services_and_prices, u.email
       FROM photographer_profiles pp
       JOIN users u ON u.id = pp.user_id
       WHERE pp.id = $1
       FOR SHARE`,
      [params.photographerProfileId]
    );

    const photog = photogRes.rows[0];
    if (!photog || photog.approval_status !== 'approved') {
      throw new ConcurrencyConflictError(
        'PHOTOGRAPHER_NOT_APPROVED',
        'This photographer is not currently approved to take bookings.'
      );
    }

    // 2. Lock the availability slot row exclusively (`FOR UPDATE`)
    const slotRes = await client.query<AvailabilitySlotRecord>(
      `SELECT * FROM availability_slots
       WHERE id = $1 AND photographer_id = $2
       FOR UPDATE`,
      [params.slotId, params.photographerProfileId]
    );

    const slot = slotRes.rows[0];
    if (!slot) {
      throw new ConcurrencyConflictError('SLOT_NOT_FOUND', 'Availability slot not found.');
    }

    const isExpiredHold =
      slot.status === 'held' &&
      slot.held_until &&
      new Date(slot.held_until).getTime() <= Date.now();

    if (slot.status !== 'free' && !isExpiredHold) {
      throw new ConcurrencyConflictError(
        'SLOT_ALREADY_RESERVED',
        'This time slot is currently held or booked by another customer.'
      );
    }

    // 3. Look up service price from photographer's services_and_prices JSONB
    const matchedService = (photog.services_and_prices || []).find(
      (s) => s.title.toLowerCase() === params.serviceTitle.toLowerCase()
    );
    if (!matchedService) {
      throw new ConcurrencyConflictError(
        'SERVICE_NOT_FOUND',
        'Selected service is not offered by this photographer.'
      );
    }

    // 4. Fetch platform commission rate set by Admin (Requirement PB-07, AD-06)
    const settingsRes = await client.query<{
      value: { photographer_commission_rate?: number };
    }>("SELECT value FROM platform_settings WHERE key = 'pricing_config' LIMIT 1");
    const commissionRate = Number(
      settingsRes.rows[0]?.value?.photographer_commission_rate ?? 15.0
    );

    const priceBigInt = BigInt(matchedService.price);
    const commissionAmount =
      (priceBigInt * BigInt(Math.round(commissionRate * 100))) / 10000n;

    // 5. Mark slot as 'held' for 48 hours
    const updatedSlotRes = await client.query<AvailabilitySlotRecord>(
      `UPDATE availability_slots
       SET status = 'held', held_until = NOW() + INTERVAL '48 hours'
       WHERE id = $1
       RETURNING *`,
      [params.slotId]
    );

    // 6. Create booking record in 'requested' status
    const bookingRes = await client.query<BookingRecord>(
      `INSERT INTO bookings (
         customer_id, photographer_id, slot_id, service_title,
         price, commission_rate, commission_amount, status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'requested')
       RETURNING *`,
      [
        params.customerId,
        params.photographerProfileId,
        params.slotId,
        matchedService.title,
        priceBigInt.toString(),
        commissionRate.toFixed(2),
        commissionAmount.toString(),
      ]
    );

    const booking = bookingRes.rows[0]!;

    await recordAuditEvent(
      {
        actorId: params.customerId,
        action: 'BOOKING_SLOT_HELD_48H',
        targetEntity: 'bookings',
        targetId: booking.id,
        details: {
          slotId: params.slotId,
          photographerId: params.photographerProfileId,
          serviceTitle: matchedService.title,
          price: priceBigInt.toString(),
        },
      },
      client
    );

    return {
      booking,
      slot: updatedSlotRes.rows[0]!,
      photographerEmail: photog.email,
      photographerUserId: photog.user_id,
    };
  });

  await redis
    .set(
      RedisKeys.slotHoldTTL(result.slot.id),
      result.booking.id,
      'EX',
      48 * 3600
    )
    .catch(() => undefined);

  // NT-03: Notify photographer of new booking request
  await dispatchNotification({
    triggerId: 'NT-03',
    recipientEmail: result.photographerEmail,
    recipientUserId: result.photographerUserId,
    subject: `New Shoot Booking Request: ${result.booking.service_title}`,
    htmlBody: `<p>You have a new booking request for <strong>${result.booking.service_title}</strong>. This slot is held for 48 hours awaiting your acceptance.</p>`,
    targetEntity: 'bookings',
    targetId: result.booking.id,
  });

  return { booking: result.booking, slot: result.slot };
}

/**
 * Background Reaper: Automatically releases expired 30-minute rental holds and
 * 48-hour unaccepted photographer slot holds (Requirements PB-04, ER-06).
 */
export async function releaseExpiredHolds(): Promise<{
  expiredRentals: number;
  expiredSlots: number;
}> {
  return withTransaction(async (client) => {
    // 1. Cancel expired 30-min rental holds
    const rentalRes = await client.query<{ id: string }>(
      `UPDATE rentals
       SET status = 'cancelled', held_until = NULL
       WHERE status = 'held' AND held_until IS NOT NULL AND held_until <= NOW()
       RETURNING id`
    );

    // 2. Expire unaccepted booking requests whose 48h slot hold has elapsed
    const expiredSlotsRes = await client.query<{ id: string }>(
      `UPDATE availability_slots
       SET status = 'free', held_until = NULL
       WHERE status = 'held' AND held_until IS NOT NULL AND held_until <= NOW()
       RETURNING id`
    );

    const slotIds = expiredSlotsRes.rows.map((r) => r.id);
    if (slotIds.length > 0) {
      await client.query(
        `UPDATE bookings
         SET status = 'expired'
         WHERE slot_id = ANY($1::uuid[]) AND status = 'requested'`,
        [slotIds]
      );
    }

    return {
      expiredRentals: rentalRes.rowCount ?? 0,
      expiredSlots: expiredSlotsRes.rowCount ?? 0,
    };
  });
}

