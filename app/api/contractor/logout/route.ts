import { NextResponse } from "next/server"
import { CONTRACTOR_COOKIE } from "@/lib/contractor-auth"

export async function POST(request: Request) {
  const requestedReturn = new URL(request.url).searchParams.get("return")
  const returnPath = requestedReturn === "/signup" ? "/signup" : "/contractor"
  const response = NextResponse.redirect(new URL(returnPath, request.url))
  response.cookies.set(CONTRACTOR_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 })
  return response
}
