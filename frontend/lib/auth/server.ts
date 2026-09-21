import { betterAuth } from "better-auth"
import { nextCookies } from "better-auth/next-js"
import { Pool } from "pg"

const DATABASE_URL = process.env.DATABASE_URL ?? ""
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? ""
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? ""

/**
 * Fail with a precise message at request time (not at import time, so
 * `next build` stays green without a local `.env`). Every auth-facing
 * handler must call this before serving.
 */
export function assertAuthConfigured(): void {
  if (!DATABASE_URL) throw new Error("DATABASE_URL is required (see .env.example)")
  if (GOOGLE_CLIENT_ID && !GOOGLE_CLIENT_SECRET)
    throw new Error("GOOGLE_CLIENT_ID set without GOOGLE_CLIENT_SECRET (see .env.example)")
}

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET ?? "",
  database: new Pool({ connectionString: DATABASE_URL }),
  emailAndPassword: { enabled: true },
  socialProviders: {
    google: { clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET },
  },
  advanced: {
    database: {
      generateId: "uuid",
    },
  },
  plugins: [nextCookies()],
})
