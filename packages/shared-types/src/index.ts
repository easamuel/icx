import { z } from 'zod';

// ============================================================================
// 1. CANONICAL ENUMS & LITERALS
// ============================================================================

export const UserRoleEnum = z.enum(['customer', 'photographer', 'editor', 'admin']);
export type UserRole = z.infer<typeof UserRoleEnum>;

export const UserStatusEnum = z.enum(['active', 'suspended']);
export type UserStatus = z.infer<typeof UserStatusEnum>;

export const PhotographerApprovalStatusEnum = z.enum([
  'pending',
  'approved',
  'suspended',
  'rejected',
]);
export type PhotographerApprovalStatus = z.infer<typeof PhotographerApprovalStatusEnum>;

export const AvailabilitySlotStatusEnum = z.enum(['free', 'held', 'booked']);
export type AvailabilitySlotStatus = z.infer<typeof AvailabilitySlotStatusEnum>;

export const PaymentStateEnum = z.enum(['unpaid', 'deposit_paid', 'fully_paid']);
export type PaymentState = z.infer<typeof PaymentStateEnum>;

export const EditOrderStatusEnum = z.enum([
  'awaiting_payment',
  'in_queue',
  'in_editing',
  'ready_for_review',
  'revision',
  'delivered',
  'archived',
]);
export type EditOrderStatus = z.infer<typeof EditOrderStatusEnum>;

export const BookingStatusEnum = z.enum([
  'requested',
  'accepted',
  'declined',
  'expired',
  'awaiting_payment',
  'confirmed',
  'delivered',
  'completed',
  'cancelled',
]);
export type BookingStatus = z.infer<typeof BookingStatusEnum>;

export const RentalStatusEnum = z.enum([
  'held',
  'confirmed',
  'out',
  'returned',
  'cancelled',
]);
export type RentalStatus = z.infer<typeof RentalStatusEnum>;

export const PaymentTargetTypeEnum = z.enum(['edit_order', 'booking', 'rental']);
export type PaymentTargetType = z.infer<typeof PaymentTargetTypeEnum>;

export const PaymentTypeEnum = z.enum(['deposit', 'balance', 'full', 'refund']);
export type PaymentType = z.infer<typeof PaymentTypeEnum>;

export const EquipmentConditionEnum = z.enum([
  'excellent',
  'good',
  'fair',
  'under_repair',
  'retired',
]);
export type EquipmentCondition = z.infer<typeof EquipmentConditionEnum>;

// ============================================================================
// 2. STATE TRANSITION MATRICES (SERVER-ENFORCED)
// ============================================================================

export const EDIT_ORDER_TRANSITIONS: Record<EditOrderStatus, readonly EditOrderStatus[]> = {
  awaiting_payment: ['in_queue', 'archived'],
  in_queue: ['in_editing', 'archived'],
  in_editing: ['ready_for_review', 'archived'],
  ready_for_review: ['revision', 'delivered', 'archived'],
  revision: ['in_editing', 'ready_for_review'],
  delivered: ['archived'],
  archived: [],
};

export const BOOKING_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  requested: ['accepted', 'declined', 'expired', 'cancelled'],
  accepted: ['awaiting_payment', 'cancelled'],
  declined: [],
  expired: [],
  awaiting_payment: ['confirmed', 'cancelled'],
  confirmed: ['delivered', 'cancelled'],
  delivered: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export const RENTAL_TRANSITIONS: Record<RentalStatus, readonly RentalStatus[]> = {
  held: ['confirmed', 'cancelled'],
  confirmed: ['out', 'cancelled'],
  out: ['returned'],
  returned: [],
  cancelled: [],
};

export function canTransitionEditOrder(from: EditOrderStatus, to: EditOrderStatus): boolean {
  return EDIT_ORDER_TRANSITIONS[from].includes(to);
}

export function canTransitionBooking(from: BookingStatus, to: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[from].includes(to);
}

export function canTransitionRental(from: RentalStatus, to: RentalStatus): boolean {
  return RENTAL_TRANSITIONS[from].includes(to);
}

// ============================================================================
// 3. ZOD VALIDATION SCHEMAS (API & SHARED CONTRACTS)
// ============================================================================

const NIGERIAN_PHONE_REGEX = /^0(70[1-9]|80[2-9]|81[0-9]|90[1-9]|91[1-356])\d{7}$/;

const DUMMY_NIGERIAN_PHONES = new Set([
  '08012345678',
  '08098765432',
  '08123456789',
  '07012345678',
  '09012345678',
]);

export function normalizeNigerianPhone(raw: string): string {
  const digits = raw.replace(/[\s\-().+]/g, '');
  if (digits.startsWith('234') && digits.length === 13) {
    return `0${digits.slice(3)}`;
  }
  return digits;
}

export function isValidNigerianPhone(raw: string): boolean {
  const normalized = normalizeNigerianPhone(raw);
  if (!NIGERIAN_PHONE_REGEX.test(normalized)) {
    return false;
  }
  // Reject repeated trailing digits (e.g. 08000000000, 08111111111) or known dummy sequences
  if (/^0\d{2}(\d)\1{7}$/.test(normalized) || /(\d)\1{6,}$/.test(normalized)) {
    return false;
  }
  if (DUMMY_NIGERIAN_PHONES.has(normalized)) {
    return false;
  }
  return true;
}

export const NigerianPhoneSchema = z
  .string()
  .trim()
  .transform(normalizeNigerianPhone)
  .refine(isValidNigerianPhone, {
    message:
      'Enter a valid 11-digit Nigerian phone number (e.g., 0803XXXXXXX, 0812XXXXXXX, 0703XXXXXXX, 0902XXXXXXX).',
  });

export const RegisterSchema = z
  .object({
    email: z.string().email().max(255).transform((v) => v.toLowerCase().trim()),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128)
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Must contain at least one digit'),
    full_name: z.string().min(2).max(150).trim(),
    phone: NigerianPhoneSchema,
    role: z.enum(['customer', 'photographer']).default('customer'),
    bio: z.string().max(2000).trim().optional(),
    location: z.string().max(150).trim().optional(),
    specialty: z.string().max(150).trim().optional(),
    years_experience: z.coerce.number().int().min(0).max(60).optional(),
    portfolio_urls: z.array(z.string().min(1)).max(10).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === 'photographer') {
      if (!data.location || data.location.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['location'],
          message: 'Primary city / location is required for photographers.',
        });
      }
      if (!data.specialty || data.specialty.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['specialty'],
          message: 'Photography specialty is required.',
        });
      }
      if (!data.bio || data.bio.length < 20) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['bio'],
          message: 'Please provide a professional bio of at least 20 characters.',
        });
      }
      if (!data.portfolio_urls || data.portfolio_urls.length < 3 || data.portfolio_urls.length > 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['portfolio_urls'],
          message: 'Upload between 3 and 10 proof-of-work portfolio images.',
        });
      }
    }
  });

export const LoginSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
  password: z.string().min(1),
  totp_code: z.string().length(6).optional(),
});

export const AdminInviteStaffSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
  full_name: z.string().min(2).max(150).trim(),
  phone: z.string().min(7).max(30).trim(),
  role: z.enum(['editor', 'admin']),
});

export const PhotographerServiceItemSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(2).max(120),
  description: z.string().max(500).optional(),
  price: z.number().int().positive('Price in kobo/Naira subunit must be positive'),
  duration_hours: z.number().positive().max(24),
});

export const PhotographerProfileUpdateSchema = z.object({
  bio: z.string().min(10).max(2000),
  location: z.string().min(2).max(150),
  portfolio_urls: z.array(z.string().min(1)).max(30),
  services_and_prices: z.array(PhotographerServiceItemSchema).min(1),
});

export const CreateAvailabilitySlotSchema = z.object({
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
});

export const CreateEditOrderSchema = z.object({
  package_id: z.string().uuid(),
  picture_count: z.number().int().min(1).max(100),
  payment_option: z.enum(['deposit', 'full']),
  customer_notes: z.string().max(2000).optional(),
});

export const CreateRevisionRequestSchema = z.object({
  photo_id: z.string().uuid(),
  notes: z.string().min(5).max(1500),
});

export const BOOKING_PACKAGES = [
  'Studio walk in',
  'Full day event booking',
  'Half day event booking',
] as const;

export const BOOKING_TIME_PERIODS = [
  'Morning (9am - 1pm)',
  'Afternoon (2pm - 6pm)',
  'Evening (6pm - 10pm)',
] as const;

export type BookingPackageType = (typeof BOOKING_PACKAGES)[number];
export type BookingTimePeriod = (typeof BOOKING_TIME_PERIODS)[number];

export const CreateBookingRequestSchema = z.object({
  photographer_id: z.string().uuid(),
  slot_id: z.string().uuid().optional(),
  booking_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional(),
  package_type: z.enum(BOOKING_PACKAGES).optional(),
  time_period: z.enum(BOOKING_TIME_PERIODS).optional(),
  service_title: z.string().min(2).max(150).optional(),
  notes: z.string().max(1000).optional(),
});

export const CreateDateBookingSchema = z
  .object({
    photographer_id: z.string().uuid(),
    booking_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
    package_type: z.enum(BOOKING_PACKAGES),
    time_period: z.enum(BOOKING_TIME_PERIODS).optional(),
    notes: z.string().max(1000).optional(),
  })
  .superRefine((data, ctx) => {
    if (
      (data.package_type === 'Half day event booking' || data.package_type === 'Studio walk in') &&
      !data.time_period
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['time_period'],
        message: 'Please select a time period for this booking package.',
      });
    }
  });

export const RentalFormDetailsSchema = z.object({
  full_name: z.string().min(2).max(150),
  phone: NigerianPhoneSchema,
  email: z.string().email(),
  address: z.string().min(5).max(500),
  government_id_number: z.string().min(4).max(100).optional(),
  project_description: z.string().max(500).optional(),
  extra_fields: z.record(z.string(), z.unknown()).optional(),
});

export const CreateRentalHoldSchema = z.object({
  item_id: z.string().uuid(),
  units: z.number().int().min(1).max(50),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  form_details: RentalFormDetailsSchema,
});

// ============================================================================
// 4. DATABASE ENTITY INTERFACES
// ============================================================================

export interface UserRecord {
  id: string;
  email: string;
  password_hash: string;
  role: UserRole;
  phone: string | null;
  full_name: string;
  two_factor_secret: string | null;
  two_factor_enabled: boolean;
  status: UserStatus;
  email_verified_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export type PublicUserProfile = Omit<
  UserRecord,
  'password_hash' | 'two_factor_secret'
>;

export interface PhotographerProfileRecord {
  id: string;
  user_id: string;
  bio: string | null;
  location: string | null;
  rating: string; // NUMERIC(3,2)
  approval_status: PhotographerApprovalStatus;
  portfolio_urls: string[];
  services_and_prices: z.infer<typeof PhotographerServiceItemSchema>[];
  created_at: Date;
}

export interface AvailabilitySlotRecord {
  id: string;
  photographer_id: string;
  start_time: Date;
  end_time: Date;
  status: AvailabilitySlotStatus;
  held_until: Date | null;
}

export interface EditPackageRecord {
  id: string;
  name: string;
  description: string | null;
  price_per_picture: string; // BIGINT returned as string by pg
  turnaround_hours: number;
  free_revisions: number;
  active: boolean;
}

export interface EditOrderRecord {
  id: string;
  customer_id: string;
  package_id: string;
  picture_count: number;
  total_amount: string; // BIGINT
  amount_paid: string; // BIGINT
  balance_amount: string; // BIGINT
  payment_state: PaymentState;
  status: EditOrderStatus;
  assignee_id: string | null;
  offline_editor_name: string | null;
  customer_notes: string | null;
  due_at: Date | null;
  created_at: Date;
}

export interface PhotoRecord {
  id: string;
  order_id: string | null;
  booking_id: string | null;
  original_storage_key: string;
  edited_storage_key: string | null;
  preview_storage_key: string | null;
  version: number;
  uploaded_by: string;
  created_at: Date;
}

export interface BookingRecord {
  id: string;
  customer_id: string;
  photographer_id: string;
  slot_id: string;
  service_title: string;
  price: string; // BIGINT
  commission_rate: string; // NUMERIC(5,2)
  commission_amount: string; // BIGINT
  status: BookingStatus;
  created_at: Date;
}

export interface EquipmentItemRecord {
  id: string;
  name: string;
  description: string | null;
  photos: string[];
  daily_price: string; // BIGINT
  total_units: number;
  condition: EquipmentCondition;
  active: boolean;
}

export interface RentalRecord {
  id: string;
  customer_id: string;
  item_id: string;
  units: number;
  start_date: string;
  end_date: string;
  total_amount: string; // BIGINT
  form_details: z.infer<typeof RentalFormDetailsSchema>;
  status: RentalStatus;
  held_until: Date | null;
  created_at: Date;
}

export interface PaymentRecord {
  id: string;
  target_type: PaymentTargetType;
  target_id: string;
  type: PaymentType;
  amount: string; // BIGINT
  gateway_reference: string;
  verified_at: Date;
}

export interface RevisionRequestRecord {
  id: string;
  photo_id: string;
  customer_id: string;
  notes: string;
  requested_at: Date;
  resolved_at: Date | null;
}

export interface AuditEventRecord {
  id: string;
  actor_id: string | null;
  action: string;
  target_entity: string;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: Date;
}

