import { toNextJsHandler } from "better-auth/next-js"

import { auth, assertAuthConfigured } from "@/lib/auth/server"

const { GET: getHandler, POST: postHandler } = toNextJsHandler(auth)

function guard(
  inner: (request: Request) => Promise<Response>,
): (request: Request) => Promise<Response> {
  return async (request) => {
    assertAuthConfigured()
    return inner(request)
  }
}

export const GET = guard(getHandler)
export const POST = guard(postHandler)
