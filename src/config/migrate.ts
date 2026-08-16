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
