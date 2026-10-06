-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('MATCHED', 'ONLY_A', 'ONLY_B', 'REVIEW');

-- CreateEnum
CREATE TYPE "FileSide" AS ENUM ('A', 'B');

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerPeriod" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comparison" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "periodId" TEXT NOT NULL,
    "fileAName" TEXT NOT NULL,
    "fileBName" TEXT NOT NULL,
    "totalA" INTEGER NOT NULL DEFAULT 0,
    "totalB" INTEGER NOT NULL DEFAULT 0,
    "matchedCount" INTEGER NOT NULL DEFAULT 0,
    "onlyACount" INTEGER NOT NULL DEFAULT 0,
    "onlyBCount" INTEGER NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "declaredA" INTEGER,
    "declaredB" INTEGER,
    "incompleteA" BOOLEAN NOT NULL DEFAULT false,
    "incompleteB" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comparison_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceFile" (
    "id" TEXT NOT NULL,
    "comparisonId" TEXT NOT NULL,
    "side" "FileSide" NOT NULL,
    "originalName" TEXT NOT NULL,
    "storageKey" TEXT,
    "storageUrl" TEXT,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "declaredRecords" INTEGER,
    "extractedRecords" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComparisonClient" (
    "id" TEXT NOT NULL,
    "comparisonId" TEXT NOT NULL,
    "side" "FileSide" NOT NULL,
    "originalName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComparisonClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComparisonEntry" (
    "id" TEXT NOT NULL,
    "comparisonId" TEXT NOT NULL,
    "originalA" TEXT,
    "normalizedA" TEXT,
    "originalB" TEXT,
    "normalizedB" TEXT,
    "occurrencesA" INTEGER,
    "occurrencesB" INTEGER,
    "similarity" DOUBLE PRECISION,
    "status" "MatchStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComparisonEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NameEquivalence" (
    "id" TEXT NOT NULL,
    "originalA" TEXT,
    "normalizedA" TEXT NOT NULL,
    "originalB" TEXT,
    "normalizedB" TEXT NOT NULL,
    "isSame" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NameEquivalence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Partner_slug_key" ON "Partner"("slug");

-- CreateIndex
CREATE INDEX "Partner_name_idx" ON "Partner"("name");

-- CreateIndex
CREATE INDEX "Partner_active_idx" ON "Partner"("active");

-- CreateIndex
CREATE INDEX "PartnerPeriod_partnerId_idx" ON "PartnerPeriod"("partnerId");

-- CreateIndex
CREATE INDEX "PartnerPeriod_year_month_idx" ON "PartnerPeriod"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerPeriod_partnerId_year_month_key" ON "PartnerPeriod"("partnerId", "year", "month");

-- CreateIndex
CREATE INDEX "Comparison_periodId_idx" ON "Comparison"("periodId");

-- CreateIndex
CREATE INDEX "Comparison_createdAt_idx" ON "Comparison"("createdAt");

-- CreateIndex
CREATE INDEX "SourceFile_comparisonId_idx" ON "SourceFile"("comparisonId");

-- CreateIndex
CREATE INDEX "ComparisonClient_comparisonId_idx" ON "ComparisonClient"("comparisonId");

-- CreateIndex
CREATE INDEX "ComparisonClient_normalizedName_idx" ON "ComparisonClient"("normalizedName");

-- CreateIndex
CREATE INDEX "ComparisonClient_side_idx" ON "ComparisonClient"("side");

-- CreateIndex
CREATE INDEX "ComparisonEntry_comparisonId_idx" ON "ComparisonEntry"("comparisonId");

-- CreateIndex
CREATE INDEX "ComparisonEntry_status_idx" ON "ComparisonEntry"("status");

-- CreateIndex
CREATE INDEX "NameEquivalence_normalizedA_idx" ON "NameEquivalence"("normalizedA");

-- CreateIndex
CREATE INDEX "NameEquivalence_normalizedB_idx" ON "NameEquivalence"("normalizedB");

-- AddForeignKey
ALTER TABLE "PartnerPeriod" ADD CONSTRAINT "PartnerPeriod_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comparison" ADD CONSTRAINT "Comparison_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PartnerPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceFile" ADD CONSTRAINT "SourceFile_comparisonId_fkey" FOREIGN KEY ("comparisonId") REFERENCES "Comparison"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparisonClient" ADD CONSTRAINT "ComparisonClient_comparisonId_fkey" FOREIGN KEY ("comparisonId") REFERENCES "Comparison"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparisonEntry" ADD CONSTRAINT "ComparisonEntry_comparisonId_fkey" FOREIGN KEY ("comparisonId") REFERENCES "Comparison"("id") ON DELETE CASCADE ON UPDATE CASCADE;
