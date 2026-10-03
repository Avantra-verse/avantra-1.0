-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "section" TEXT;

-- CreateTable
CREATE TABLE "WallChallenge" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "question" TEXT NOT NULL,
    "options" TEXT[],
    "answers" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WallChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WallAttempt" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WallAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WallSolve" (
    "studentId" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "solvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WallSolve_pkey" PRIMARY KEY ("studentId","challengeId")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "WallChallenge_code_key" ON "WallChallenge"("code");

-- CreateIndex
CREATE UNIQUE INDEX "WallChallenge_number_key" ON "WallChallenge"("number");

-- CreateIndex
CREATE INDEX "WallAttempt_challengeId_studentId_idx" ON "WallAttempt"("challengeId", "studentId");

-- CreateIndex
CREATE INDEX "WallSolve_challengeId_idx" ON "WallSolve"("challengeId");

-- AddForeignKey
ALTER TABLE "WallAttempt" ADD CONSTRAINT "WallAttempt_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "WallChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WallAttempt" ADD CONSTRAINT "WallAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WallSolve" ADD CONSTRAINT "WallSolve_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WallSolve" ADD CONSTRAINT "WallSolve_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "WallChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

