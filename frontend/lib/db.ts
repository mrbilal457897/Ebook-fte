import { Pool } from "pg"

const DATABASE_URL = process.env.DATABASE_URL ?? ""

let pool: Pool | null = null

/**
 * Lazy singleton pg pool (frontend boundary reads only; see lib/tenancy.ts).
 * Constructs without connecting; a missing DATABASE_URL surfaces as a clear
 * error at request time via lib/auth assertAuthConfigured, not at import
 * time (so `next build` stays green without a local `.env`).
 */
export function getPool(): Pool {
  if (!pool) pool = new Pool({ connectionString: DATABASE_URL })
  return pool
}

/** Explicit misconfiguration check for request-time guards. */
export function requireDatabaseUrl(): void {
  if (!DATABASE_URL) throw new Error("DATABASE_URL is required (see .env.example)")
}
