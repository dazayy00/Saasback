import prisma from './db';

/**
 * Auto-migration: Adds missing columns to the database without needing
 * `prisma db push` or manual SQL. Runs safely on every server start.
 */
export const runMigrations = async () => {
  const migrations = [
    {
      name: 'Add phone to User',
      sql: `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT;`
    },
    {
      name: 'Add resetPasswordToken to User',
      sql: `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "resetPasswordToken" TEXT;`
    },
    {
      name: 'Add resetPasswordExpires to User',
      sql: `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "resetPasswordExpires" TIMESTAMP(3);`
    },
    {
      name: 'Create StockEntry table',
      sql: `
        CREATE TABLE IF NOT EXISTS "StockEntry" (
          "id" TEXT NOT NULL,
          "productId" TEXT NOT NULL,
          "quantity" INTEGER NOT NULL,
          "previousStock" INTEGER NOT NULL DEFAULT 0,
          "newStock" INTEGER NOT NULL DEFAULT 0,
          "type" TEXT NOT NULL DEFAULT 'ENTRY',
          "notes" TEXT,
          "userName" TEXT,
          "businessId" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "StockEntry_pkey" PRIMARY KEY ("id")
        );
      `
    },
  ];

  console.log('[Migration] Checking database schema...');

  for (const migration of migrations) {
    try {
      await prisma.$executeRawUnsafe(migration.sql);
      console.log(`[Migration] ✔ ${migration.name}`);
    } catch (err: any) {
      // If error is anything other than "already exists", log it but don't crash
      if (!err.message?.includes('already exists')) {
        console.error(`[Migration] ✘ ${migration.name}:`, err.message);
      }
    }
  }

  console.log('[Migration] Done.');
};
