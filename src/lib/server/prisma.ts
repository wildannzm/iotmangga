import PrismaPkg from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
const PrismaClientConstructor = PrismaPkg.PrismaClient;
import { PrismaPg } from '@prisma/adapter-pg';
import pkg from 'pg';
import { DATABASE_URL } from '$env/static/private';

const { Pool } = pkg;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: InstanceType<typeof Pool> | undefined;
};

// In dev, always recreate to pick up schema changes after prisma generate.
// In production, reuse across requests for connection efficiency.
if (process.env.NODE_ENV !== 'production') {
  // Destroy old pool/client so connections are not leaked during HMR
  if (globalForPrisma.pool) {
    globalForPrisma.pool.end().catch(() => {});
  }
  globalForPrisma.prisma = undefined;
  globalForPrisma.pool = undefined;
}

const pool = globalForPrisma.pool ?? new Pool({ connectionString: DATABASE_URL });
const adapter = new PrismaPg(pool);
export const prisma = globalForPrisma.prisma ?? new PrismaClientConstructor({ adapter });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pool = pool;
}
