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

const studentProfileFields = z.object({
  phone,
  grade: z.number().int().min(1).max(12),
  section: z.string().trim().toUpperCase().min(1).max(10).optional(), // e.g. "B"
  schoolId: z.string().min(1).optional(), // an APPROVED school
  otherSchoolName: z.string().trim().min(3).max(200).optional(), // "Others"
  guardianEmail: email.optional(),
  guardianPhone: phone,
  guardianConsent: z.literal(true),
});
const oneSchool = (v: { schoolId?: string; otherSchoolName?: string }) => !!v.schoolId !== !!v.otherSchoolName;
const oneSchoolError = { message: 'Pick your school or type its name', path: ['schoolId'] };

export const StudentProfile = studentProfileFields.refine(oneSchool, oneSchoolError);
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

export const CreateStaffRequest = z
  .object({
    role: StaffRole,
    name,
    email,
    password, // admin sets it and hands it over; staff can change it via forgot-password
    expiresAt: z.coerce.date().optional(), // default: end of the event
    eventId: z.string().min(1).optional(), // judges: the event they score
  })
  .refine((v) => v.role !== 'JUDGE' || !!v.eventId, { message: 'Judges need an event', path: ['eventId'] });
export type CreateStaffRequest = z.infer<typeof CreateStaffRequest>;

export const LinkStudentRequest = z.object({ schoolId: z.string().min(1) });
export type LinkStudentRequest = z.infer<typeof LinkStudentRequest>;

export const SchoolStatus = z.enum(['PENDING', 'APPROVED', 'REJECTED']);
export type SchoolStatus = z.infer<typeof SchoolStatus>;

// ---- events, registrations, payments ----

// Science & Innovation Exhibition fee, paid once per student. Needed only to register for EXHIBITION events;
// every other event, the Engagement Wall and entry to AVANTRA are free.
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
  judgingCriteria: z.array(z.string().trim().min(2).max(60)).min(1).max(10).optional(),
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

// Free, except EXHIBITION events need the ₹199 fee paid first.
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

// ---- event day: QR scans and judging ----

export const MAX_POINTS = 10; // per judging criterion

// A scan identifies a student by the QR (qrToken) or, if the QR won't scan, the typed AVANTRA ID.
const studentRef = {
  qrToken: z.string().trim().min(10).max(64).optional(),
  avantraId: AvantraId.optional(),
};
const oneRef = (v: { qrToken?: string; avantraId?: string }) => !!v.qrToken !== !!v.avantraId;

export const CheckInRequest = z
  .object({
    ...studentRef,
    eventId: z.string().min(1).optional(), // omit for the main gate
    scannedAt: z.coerce.date().optional(), // offline scans syncing later
  })
  .refine(oneRef, { message: 'Send qrToken or avantraId', path: ['qrToken'] });
export type CheckInRequest = z.infer<typeof CheckInRequest>;

export const JudgeLookupRequest = z.object(studentRef).refine(oneRef, { message: 'Send qrToken or avantraId', path: ['qrToken'] });
export type JudgeLookupRequest = z.infer<typeof JudgeLookupRequest>;

export const SubmitScoresRequest = z.object({
  teamId: z.string().min(1),
  scores: z
    .array(z.object({ criterion: z.string().min(1).max(60), points: z.number().int().min(0).max(MAX_POINTS) }))
    .min(1)
    .max(10),
});
export type SubmitScoresRequest = z.infer<typeof SubmitScoresRequest>;

export const AssignJudgeRequest = z.object({ eventId: z.string().min(1) });
export type AssignJudgeRequest = z.infer<typeof AssignJudgeRequest>;

// ---- admin desk ----

// Walk-in at the registration desk: admin creates the account and takes the fee in cash.
// Email can be the parent's; the student sets a password later with "Forgot password".
export const WalkInRequest = studentProfileFields.extend({ name, email, note: z.string().trim().max(200).optional() }).refine(oneSchool, oneSchoolError);
export type WalkInRequest = z.infer<typeof WalkInRequest>;

// Cash fee for a student who signed up online.
export const MarkPaidRequest = z.object({ note: z.string().trim().max(200).optional() }); // e.g. receipt number
export type MarkPaidRequest = z.infer<typeof MarkPaidRequest>;

export const SetRankRequest = z.object({ rank: z.number().int().min(1).max(3).nullable() }); // null = clear
export type SetRankRequest = z.infer<typeof SetRankRequest>;

// ---- ARITHI Engagement Wall ----

export const WALL_CATEGORIES = [
  'Mathematics',
  'Science',
  'AI',
  'Technology',
  'Logical Reasoning',
  'Puzzle',
  'Entrepreneurship',
  'Observation',
  'Exhibition',
] as const;
// Tries before a challenge locks for that student. Multiple choice gets one, or guessing would win.
export const WALL_TYPED_ATTEMPTS = 3;
export const WALL_CHOICE_ATTEMPTS = 1;
export const wallAttempts = (c: { options: string[] }) => (c.options.length ? WALL_CHOICE_ATTEMPTS : WALL_TYPED_ATTEMPTS);

// The code printed on a chit. Same alphabet as invite codes: no 0/O/1/I.
export const ChitCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[2-9A-HJ-NP-Z]{6}$/, 'Chit codes are 6 letters/digits');

// How answers are compared: case, spacing and a trailing full stop don't matter; numbers compare by value ("1,000" = "1000.0").
export function normalizeAnswer(s: string): string {
  const t = s.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim().replace(/[.!]+$/, '');
  const n = t.replace(/,/g, '');
  return /^-?\d+(\.\d+)?$/.test(n) ? String(Number(n)) : t;
}
export const answerMatches = (given: string, accepted: string[]) => accepted.some((a) => normalizeAnswer(a) === normalizeAnswer(given));

const text = (max: number) => z.string().trim().min(1).max(max);
const wallFields = z.object({
  number: z.number().int().min(1).max(9999),
  category: z.enum(WALL_CATEGORIES),
  difficulty: z.number().int().min(1).max(8),
  points: z.number().int().min(1).max(1000).optional(), // default 10 × difficulty
  question: text(1000),
  options: z.array(text(200)).max(6).optional(), // multiple choice (2–6); omit for a typed answer
  answers: z.array(text(200)).min(1).max(20), // every accepted answer; for multiple choice, the correct option(s)
  active: z.boolean().optional(),
});
// Multiple choice: 2+ options and every answer is one of them. Also checked on edits, after merging.
export const wallAnswersValid = (v: { options?: string[]; answers?: string[] }) =>
  !v.options?.length || (v.options.length >= 2 && (v.answers ?? []).every((a) => answerMatches(a, v.options!)));
const wallAnswersError = { message: 'Multiple choice needs 2+ options, and each answer must be one of them', path: ['answers'] };

export const WallChallengeInput = wallFields.refine(wallAnswersValid, wallAnswersError);
export type WallChallengeInput = z.infer<typeof WallChallengeInput>;
// Admin adds one or many (e.g. a whole sheet) at once; all or nothing.
export const CreateWallChallengesRequest = z.array(WallChallengeInput).min(1).max(500);
export type CreateWallChallengesRequest = z.infer<typeof CreateWallChallengesRequest>;
export const UpdateWallChallengeRequest = wallFields.partial();
export type UpdateWallChallengeRequest = z.infer<typeof UpdateWallChallengeRequest>;

// The filled template, read in the browser as text (FileReader / file.text()).
export const WallImportRequest = z.object({ csv: z.string().min(1).max(2_000_000) });
export type WallImportRequest = z.infer<typeof WallImportRequest>;

export const WallAnswerRequest = z.object({ answer: text(200) }); // multiple choice: the option text
export type WallAnswerRequest = z.infer<typeof WallAnswerRequest>;

// open: codes can be played. frozen: the public leaderboard stops at this moment (final-hour suspense).
export const WallStateRequest = z
  .object({ open: z.boolean().optional(), frozen: z.boolean().optional() })
  .refine((v) => v.open !== undefined || v.frozen !== undefined, { message: 'Send open and/or frozen' });
export type WallStateRequest = z.infer<typeof WallStateRequest>;
