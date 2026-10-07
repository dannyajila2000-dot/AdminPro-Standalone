-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN     "appActivadoEn" TIMESTAMP(3),
ADD COLUMN     "appCodigoExpiraEn" TIMESTAMP(3),
ADD COLUMN     "appCodigoHash" TEXT,
ADD COLUMN     "appIntentosFallidos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "appInvitadoEn" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "IntegracionApp" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "apiKeyHash" TEXT NOT NULL,
    "codigoGimnasio" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegracionApp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IntegracionApp_empresaId_key" ON "IntegracionApp"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegracionApp_apiKeyHash_key" ON "IntegracionApp"("apiKeyHash");

-- AddForeignKey
ALTER TABLE "IntegracionApp" ADD CONSTRAINT "IntegracionApp_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
