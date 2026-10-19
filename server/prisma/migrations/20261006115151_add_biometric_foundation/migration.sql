-- CreateEnum
CREATE TYPE "BiometricDeviceStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'OFFLINE', 'DISABLED');

-- CreateEnum
CREATE TYPE "BiometricPunchType" AS ENUM ('IN', 'OUT', 'BREAK_IN', 'BREAK_OUT', 'UNKNOWN');

-- CreateTable
CREATE TABLE "BiometricDevice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "serialNumber" TEXT,
    "manufacturer" TEXT,
    "model" TEXT,
    "ipAddress" TEXT,
    "port" INTEGER,
    "timezone" TEXT,
    "status" "BiometricDeviceStatus" NOT NULL DEFAULT 'ACTIVE',
    "apiKeyHash" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BiometricDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BiometricEmployeeMap" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "biometricUserId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BiometricEmployeeMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BiometricPunch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "employeeId" TEXT,
    "biometricUserId" TEXT NOT NULL,
    "punchedAt" TIMESTAMP(3) NOT NULL,
    "punchType" "BiometricPunchType" NOT NULL DEFAULT 'UNKNOWN',
    "externalPunchId" TEXT,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BiometricPunch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BiometricDevice_tenantId_idx" ON "BiometricDevice"("tenantId");

-- CreateIndex
CREATE INDEX "BiometricDevice_tenantId_branchId_idx" ON "BiometricDevice"("tenantId", "branchId");

-- CreateIndex
CREATE INDEX "BiometricDevice_tenantId_status_idx" ON "BiometricDevice"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BiometricDevice_tenantId_code_key" ON "BiometricDevice"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "BiometricDevice_tenantId_serialNumber_key" ON "BiometricDevice"("tenantId", "serialNumber");

-- CreateIndex
CREATE INDEX "BiometricEmployeeMap_tenantId_employeeId_idx" ON "BiometricEmployeeMap"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "BiometricEmployeeMap_tenantId_deviceId_idx" ON "BiometricEmployeeMap"("tenantId", "deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "BiometricEmployeeMap_tenantId_deviceId_biometricUserId_key" ON "BiometricEmployeeMap"("tenantId", "deviceId", "biometricUserId");

-- CreateIndex
CREATE UNIQUE INDEX "BiometricEmployeeMap_tenantId_deviceId_employeeId_key" ON "BiometricEmployeeMap"("tenantId", "deviceId", "employeeId");

-- CreateIndex
CREATE INDEX "BiometricPunch_tenantId_deviceId_punchedAt_idx" ON "BiometricPunch"("tenantId", "deviceId", "punchedAt");

-- CreateIndex
CREATE INDEX "BiometricPunch_tenantId_employeeId_punchedAt_idx" ON "BiometricPunch"("tenantId", "employeeId", "punchedAt");

-- CreateIndex
CREATE INDEX "BiometricPunch_tenantId_processed_idx" ON "BiometricPunch"("tenantId", "processed");

-- CreateIndex
CREATE UNIQUE INDEX "BiometricPunch_tenantId_deviceId_biometricUserId_punchedAt_key" ON "BiometricPunch"("tenantId", "deviceId", "biometricUserId", "punchedAt");

-- AddForeignKey
ALTER TABLE "BiometricDevice" ADD CONSTRAINT "BiometricDevice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiometricDevice" ADD CONSTRAINT "BiometricDevice_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiometricEmployeeMap" ADD CONSTRAINT "BiometricEmployeeMap_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiometricEmployeeMap" ADD CONSTRAINT "BiometricEmployeeMap_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "BiometricDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiometricEmployeeMap" ADD CONSTRAINT "BiometricEmployeeMap_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiometricPunch" ADD CONSTRAINT "BiometricPunch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiometricPunch" ADD CONSTRAINT "BiometricPunch_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "BiometricDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiometricPunch" ADD CONSTRAINT "BiometricPunch_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
