// Contract shared by apps/web and apps/api. Validate with these on both sides.
import { z } from 'zod';

export const Role = z.enum(['STUDENT', 'SCHOOL_COORDINATOR', 'JUDGE', 'VOLUNTEER', 'ADMIN']);
export type Role = z.infer<typeof Role>;

const phone = z.string().regex(/^[6-9]\d{9}$/, 'Enter a 10-digit Indian mobile number');

export const SchoolRegistration = z.object({
  schoolName: z.string().trim().min(3).max(200),
  city: z.string().trim().min(2).max(100),
  address: z.string().trim().min(5).max(500),
  coordinatorName: z.string().trim().min(2).max(100),
  email: z.string().email(),
  phone,
  password: z.string().min(8).max(128),
});
export type SchoolRegistration = z.infer<typeof SchoolRegistration>;

export const StudentRegistration = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().email(),
  phone,
  password: z.string().min(8).max(128),
  schoolId: z.string().min(1),
  grade: z.number().int().min(1).max(12),
  guardianPhone: phone,
  guardianConsent: z.literal(true),
});
export type StudentRegistration = z.infer<typeof StudentRegistration>;
