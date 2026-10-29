-- AVANTRA 2026 schema, generated from apps/api/prisma/schema.prisma (prisma migrate diff) and adapted for Supabase:
-- Session and EmailCode are gone (Supabase Auth), user ids are auth.users ids (uuid), timestamps are timestamptz.
-- Column names stay camelCase so the web pages keep their field names.

CREATE TYPE "Role" AS ENUM ('STUDENT', 'JUDGE', 'VOLUNTEER', 'ADMIN');

CREATE TYPE "EventCategory" AS ENUM ('EXHIBITION', 'TECHNOLOGY', 'EXPERIENCE', 'WORKSHOP');

CREATE TYPE "PaymentMethod" AS ENUM ('ONLINE', 'OFFLINE', 'UPI');

CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'PAID', 'FAILED', 'REFUNDED');

CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "role" "Role" NOT NULL,
    "disabledAt" TIMESTAMPTZ(3),
    "expiresAt" TIMESTAMPTZ(3),
    "assignedEventId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Student" (
    "userId" UUID NOT NULL,
    "schoolName" TEXT NOT NULL,
    "referralCode" TEXT,
    "grade" INTEGER NOT NULL,
    "section" TEXT,
    "guardianEmail" TEXT,
    "guardianPhone" TEXT,
    "guardianConsentAt" TIMESTAMPTZ(3) NOT NULL,
    "avantraId" TEXT NOT NULL,
    "qrToken" TEXT NOT NULL,
    "feePaidAt" TIMESTAMPTZ(3),

    CONSTRAINT "Student_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "Event" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "registrationOpen" BOOLEAN NOT NULL DEFAULT true,
    "category" "EventCategory" NOT NULL,
    "teamMin" INTEGER NOT NULL DEFAULT 1,
    "teamMax" INTEGER NOT NULL DEFAULT 1,
    "capacity" INTEGER,
    "judgingCriteria" TEXT[] DEFAULT ARRAY['Innovation', 'Scientific understanding', 'Presentation', 'Practical impact']::TEXT[],

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Registration" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "eventId" TEXT NOT NULL,
    "studentId" UUID NOT NULL,
    "certificateCode" TEXT,
    "certificateIssuedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Team" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "projectTitle" TEXT,
    "topic" TEXT,
    "rank" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeamMember" (
    "registrationId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "isLeader" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("registrationId")
);

CREATE TABLE "TeamJoinRequest" (
    "teamId" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamJoinRequest_pkey" PRIMARY KEY ("teamId","registrationId")
);

CREATE TABLE "Payment" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "studentId" UUID NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'ONLINE',
    "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "recordedById" UUID,
    "note" TEXT,
    "utr" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CheckIn" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "studentId" UUID NOT NULL,
    "eventId" TEXT,
    "scannedById" UUID NOT NULL,
    "scannedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckIn_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Score" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "teamId" TEXT NOT NULL,
    "judgeId" UUID NOT NULL,
    "criterion" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Score_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WallChallenge" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "code" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "question" TEXT NOT NULL,
    "options" TEXT[],
    "answers" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WallChallenge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WallAttempt" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "challengeId" TEXT NOT NULL,
    "studentId" UUID NOT NULL,
    "answer" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WallAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WallSolve" (
    "studentId" UUID NOT NULL,
    "challengeId" TEXT NOT NULL,
    "solvedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WallSolve_pkey" PRIMARY KEY ("studentId","challengeId")
);

CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE UNIQUE INDEX "Student_avantraId_key" ON "Student"("avantraId");

CREATE UNIQUE INDEX "Student_qrToken_key" ON "Student"("qrToken");

CREATE INDEX "Student_referralCode_idx" ON "Student"("referralCode");

CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");

CREATE UNIQUE INDEX "Registration_certificateCode_key" ON "Registration"("certificateCode");

CREATE INDEX "Registration_studentId_idx" ON "Registration"("studentId");

CREATE UNIQUE INDEX "Registration_eventId_studentId_key" ON "Registration"("eventId", "studentId");

CREATE UNIQUE INDEX "Team_inviteCode_key" ON "Team"("inviteCode");

CREATE INDEX "Team_eventId_idx" ON "Team"("eventId");

CREATE INDEX "TeamMember_teamId_idx" ON "TeamMember"("teamId");

CREATE INDEX "TeamJoinRequest_registrationId_idx" ON "TeamJoinRequest"("registrationId");

CREATE UNIQUE INDEX "Payment_razorpayOrderId_key" ON "Payment"("razorpayOrderId");

CREATE UNIQUE INDEX "Payment_razorpayPaymentId_key" ON "Payment"("razorpayPaymentId");

CREATE INDEX "Payment_studentId_idx" ON "Payment"("studentId");

CREATE INDEX "Payment_utr_idx" ON "Payment"("utr");

CREATE INDEX "CheckIn_studentId_eventId_idx" ON "CheckIn"("studentId", "eventId");

CREATE INDEX "CheckIn_eventId_idx" ON "CheckIn"("eventId");

CREATE UNIQUE INDEX "Score_teamId_judgeId_criterion_key" ON "Score"("teamId", "judgeId", "criterion");

CREATE UNIQUE INDEX "WallChallenge_code_key" ON "WallChallenge"("code");

CREATE UNIQUE INDEX "WallChallenge_number_key" ON "WallChallenge"("number");

CREATE INDEX "WallAttempt_challengeId_studentId_idx" ON "WallAttempt"("challengeId", "studentId");

CREATE INDEX "WallSolve_challengeId_idx" ON "WallSolve"("challengeId");

ALTER TABLE "User" ADD CONSTRAINT "User_assignedEventId_fkey" FOREIGN KEY ("assignedEventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Student" ADD CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Registration" ADD CONSTRAINT "Registration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Registration" ADD CONSTRAINT "Registration_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Team" ADD CONSTRAINT "Team_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeamJoinRequest" ADD CONSTRAINT "TeamJoinRequest_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeamJoinRequest" ADD CONSTRAINT "TeamJoinRequest_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_scannedById_fkey" FOREIGN KEY ("scannedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Score" ADD CONSTRAINT "Score_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Score" ADD CONSTRAINT "Score_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WallAttempt" ADD CONSTRAINT "WallAttempt_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "WallChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WallAttempt" ADD CONSTRAINT "WallAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WallSolve" ADD CONSTRAINT "WallSolve_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WallSolve" ADD CONSTRAINT "WallSolve_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "WallChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A UTR pays once (was migration 0017): partial, so a UTR marked Not paid (FAILED) can be sent again.
CREATE UNIQUE INDEX "Payment_utr_pays_once" ON "Payment"("utr") WHERE "status" IN ('CREATED', 'PAID');
