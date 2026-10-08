-- AlterTable
ALTER TABLE "MedicionCorporal" ADD COLUMN     "origenApp" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "MedicionCorporal_origenApp_key" ON "MedicionCorporal"("origenApp");
