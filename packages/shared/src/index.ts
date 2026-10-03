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
