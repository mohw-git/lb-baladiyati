import { PrismaService } from '../../prisma/prisma.service';

/**
 * Generates a unique, official complaint reference code in the format:
 *   {MUNICIPALITY_CODE}-CMP-{YEAR}-{6-digit-sequence}
 *   e.g. BEI-CMP-2026-000001
 *
 * The sequence resets each calendar year and is per-municipality. We use
 * a Postgres row-level lock (via Prisma `upsert` + `increment`) on
 * `ComplaintSequence` to make concurrent inserts safe — only one
 * transaction can hold the row at a time.
 *
 * Pass a Prisma transaction client when calling from inside a transaction.
 *
 * Older complaints created with the legacy random-suffix format
 * (`BEI-260520-XXXX`) are preserved unchanged on the column.
 */
export async function generateReferenceCode(
  prismaOrTx: PrismaService | any,
  municipalityId: string,
  municipalityCode: string,
): Promise<string> {
  const year = new Date().getFullYear();

  const seq = await prismaOrTx.complaintSequence.upsert({
    where: { municipalityId_year: { municipalityId, year } },
    create: { municipalityId, year, lastSequence: 1 },
    update: { lastSequence: { increment: 1 } },
    select: { lastSequence: true },
  });

  const padded = String(seq.lastSequence).padStart(6, '0');
  return `${municipalityCode}-CMP-${year}-${padded}`;
}
