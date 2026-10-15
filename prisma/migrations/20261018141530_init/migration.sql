-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('DIRETOR', 'DIRETOR_FOTOGRAFIA', 'SONOPLASTA', 'EDITOR', 'ROTEIRISTA', 'EFEITOS_VISUAIS');

-- CreateTable
CREATE TABLE "Profissional" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "especialidades" "Papel"[],
    "precoMedio" DOUBLE PRECISION NOT NULL,
    "disponivelDe" TIMESTAMP(3) NOT NULL,
    "disponivelAte" TIMESTAMP(3) NOT NULL,
    "localizacao" TEXT NOT NULL,
    "projetosAnteriores" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "Profissional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Competencia" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "nivel" INTEGER NOT NULL,
    "profissionalId" TEXT NOT NULL,

    CONSTRAINT "Competencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Avaliacao" (
    "id" SERIAL NOT NULL,
    "nota" DOUBLE PRECISION NOT NULL,
    "comentario" TEXT NOT NULL DEFAULT '',
    "data" TIMESTAMP(3) NOT NULL,
    "profissionalId" TEXT NOT NULL,

    CONSTRAINT "Avaliacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Competencia_profissionalId_nome_key" ON "Competencia"("profissionalId", "nome");

-- AddForeignKey
ALTER TABLE "Competencia" ADD CONSTRAINT "Competencia_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "Profissional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Avaliacao" ADD CONSTRAINT "Avaliacao_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "Profissional"("id") ON DELETE CASCADE ON UPDATE CASCADE;
