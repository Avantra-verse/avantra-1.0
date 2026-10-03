// Contract shared by apps/web and apps/api. Validate with these on both sides.
import { z } from 'zod';

export const Role = z.enum(['STUDENT', 'SCHOOL_COORDINATOR', 'JUDGE', 'VOLUNTEER', 'ADMIN']);
export type Role = z.infer<typeof Role>;

// The two roles that can sign up / log in on the public /login page.
export const PublicRole = z.enum(['STUDENT', 'SCHOOL_COORDINATOR']);
export type PublicRole = z.infer<typeof PublicRole>;

const email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email'));
const password = z.string().min(8, 'At least 8 characters').max(128);
const name = z.string().trim().min(2).max(100);
const code = z.string().regex(/^\d{6}$/, 'Enter the 6-digit code');
const phone = z.string().regex(/^[6-9]\d{9}$/, 'Enter a 10-digit Indian mobile number');

// Step 1 of sign-up: we email a code. No account exists until the code is verified.
export const RegisterRequest = z.object({ role: PublicRole, name, email, password });
export type RegisterRequest = z.infer<typeof RegisterRequest>;

// Step 2: same fields + the code. Creates the account and logs in.
export const VerifyEmailRequest = RegisterRequest.extend({ code });
export type VerifyEmailRequest = z.infer<typeof VerifyEmailRequest>;

export const LoginRequest = z.object({ role: PublicRole, email, password: z.string().min(1).max(128) });
export type LoginRequest = z.infer<typeof LoginRequest>;

// `credential` is the ID token from the Google Identity Services button.
export const GoogleLoginRequest = z.object({ role: PublicRole, credential: z.string().min(1).max(4096) });
export type GoogleLoginRequest = z.infer<typeof GoogleLoginRequest>;

export const ForgotPasswordRequest = z.object({ email });
export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordRequest>;

export const ResetPasswordRequest = z.object({ email, code, password });
export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequest>;

export type Me = {
  id: string;
  email: string;
  name: string;
  role: Role;
  profileComplete: boolean;
};

// Profile steps (after sign-up). Used from build step 2.
export const SchoolProfile = z.object({
  schoolName: z.string().trim().min(3).max(200),
  city: z.string().trim().min(2).max(100),
  address: z.string().trim().min(5).max(500),
  phone,
});
export type SchoolProfile = z.infer<typeof SchoolProfile>;

export const StudentProfile = z
  .object({
    phone,
    grade: z.number().int().min(1).max(12),
    schoolId: z.string().min(1).optional(), // an APPROVED school
    otherSchoolName: z.string().trim().min(3).max(200).optional(), // "Others"
    guardianEmail: email.optional(),
    guardianPhone: phone,
    guardianConsent: z.literal(true),
  })
  .refine((v) => !!v.schoolId !== !!v.otherSchoolName, {
    message: 'Pick your school or type its name',
    path: ['schoolId'],
  });
export type StudentProfile = z.infer<typeof StudentProfile>;

// ---- staff (/staff) and admin (/admin) ----

export const StaffRole = z.enum(['VOLUNTEER', 'JUDGE']);
export type StaffRole = z.infer<typeof StaffRole>;

// Used by POST /auth/staff/login and step 1 of POST /auth/admin/login.
export const PasswordLoginRequest = z.object({ email, password: z.string().min(1).max(128) });
export type PasswordLoginRequest = z.infer<typeof PasswordLoginRequest>;

// Step 2 of admin login: the code emailed after the password was accepted.
export const AdminVerifyRequest = z.object({ email, code });
export type AdminVerifyRequest = z.infer<typeof AdminVerifyRequest>;

export const CreateStaffRequest = z.object({
  role: StaffRole,
  name,
  email,
  password, // admin sets it and hands it over; staff can change it via forgot-password
  expiresAt: z.coerce.date().optional(), // default: end of the event
});
export type CreateStaffRequest = z.infer<typeof CreateStaffRequest>;

export const LinkStudentRequest = z.object({ schoolId: z.string().min(1) });
export type LinkStudentRequest = z.infer<typeof LinkStudentRequest>;

export const SchoolStatus = z.enum(['PENDING', 'APPROVED', 'REJECTED']);
export type SchoolStatus = z.infer<typeof SchoolStatus>;

// ---- events, registrations, payments ----

// AVANTRA registration fee, paid once per student. Without it a student can't enter any event.
export const AVANTRA_FEE_PAISE = 19900; // ₹199

export const EventCategory = z.enum(['EXHIBITION', 'TECHNOLOGY', 'EXPERIENCE', 'WORKSHOP']);
export type EventCategory = z.infer<typeof EventCategory>;

// From the brochure. Exhibition registrations must pick one.
export const EXHIBITION_TOPICS = [
  'Artificial Intelligence & Machine Learning',
  'Robotics',
  'Smart Infrastructure & Engineering',
  'Emerging Technology',
  'IoT & Smart Systems',
  'HealthTech & Bio-Innovation',
  'Climate & Sustainability',
  'Social Innovation & Entrepreneurship',
  'AgriTech & Food Innovation',
] as const;
export const ExhibitionTopic = z.enum(EXHIBITION_TOPICS);

const eventFields = z.object({
  slug: z.string().regex(/^[a-z0-9-]{2,50}$/, 'lowercase letters, digits and dashes'),
  name,
  category: EventCategory,
  description: z.string().trim().max(2000).optional(),
  teamMin: z.number().int().min(1).max(20),
  teamMax: z.number().int().min(1).max(20),
  capacity: z.number().int().positive().nullable().optional(), // max teams; null = unlimited
  registrationOpen: z.boolean().optional(),
});
export const CreateEventRequest = eventFields.refine((e) => e.teamMin <= e.teamMax, {
  message: 'teamMin must be ≤ teamMax',
  path: ['teamMax'],
});
export type CreateEventRequest = z.infer<typeof CreateEventRequest>;
export const UpdateEventRequest = eventFields.partial();
export type UpdateEventRequest = z.infer<typeof UpdateEventRequest>;

export const AvantraId = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^AV26-[2-9A-HJ-NP-Z]{5}$/, 'Invalid AVANTRA ID');

// A student who paid the AVANTRA fee registers for an event. Free.
export const CreateRegistrationRequest = z.object({ eventId: z.string().min(1) });
export type CreateRegistrationRequest = z.infer<typeof CreateRegistrationRequest>;

// Teams: created by a confirmed participant, joined by other participants of the same event via code.
const teamName = z.string().trim().min(2).max(60);
const projectTitle = z.string().trim().min(3).max(150);

export const CreateTeamRequest = z.object({
  eventId: z.string().min(1),
  name: teamName,
  projectTitle: projectTitle.optional(), // exhibition only, required there
  topic: ExhibitionTopic.optional(), // exhibition only, required there
});
export type CreateTeamRequest = z.infer<typeof CreateTeamRequest>;

export const UpdateTeamRequest = z.object({ name: teamName, projectTitle, topic: ExhibitionTopic }).partial();
export type UpdateTeamRequest = z.infer<typeof UpdateTeamRequest>;

export const InviteCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[2-9A-HJ-NP-Z]{6}$/, 'Invite codes are 6 letters/digits');
export const JoinTeamRequest = z.object({ inviteCode: InviteCode });
export type JoinTeamRequest = z.infer<typeof JoinTeamRequest>;

// What Razorpay Checkout's handler receives on success. Field names are Razorpay's.
export const VerifyPaymentRequest = z.object({
  razorpay_order_id: z.string().min(1).max(100),
  razorpay_payment_id: z.string().min(1).max(100),
  razorpay_signature: z.string().regex(/^[0-9a-f]{64}$/),
});
export type VerifyPaymentRequest = z.infer<typeof VerifyPaymentRequest>;
