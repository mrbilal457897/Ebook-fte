import { betterAuth } from "better-auth"
import { nextCookies } from "better-auth/next-js"

import { getPool, requireDatabaseUrl } from "@/lib/db"

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? ""
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? ""
const SECRET = process.env.BETTER_AUTH_SECRET ?? ""

/**
 * Fail with a precise message at request time (not at import time, so
 * `next build` stays green without a local `.env`). Every auth-facing
 * handler must call this before serving.
 */
export function assertAuthConfigured(): void {
  requireDatabaseUrl()
  if (GOOGLE_CLIENT_ID && !GOOGLE_CLIENT_SECRET)
    throw new Error("GOOGLE_CLIENT_ID set without GOOGLE_CLIENT_SECRET (see .env.example)")
  if (SECRET.length < 32)
    throw new Error("BETTER_AUTH_SECRET must be at least 32 chars (see .env.example)")
}

export const auth = betterAuth({
  secret: SECRET,
  database: getPool(),
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
