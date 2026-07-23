import { NextResponse } from "next/server"
import { isPlatformStaff } from "@/lib/platform-staff-auth"
import { productionReadiness } from "@/lib/production-config"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  if (!await isPlatformStaff()) return NextResponse.json({ error: "Platform access required." }, { status: 401 })
  return NextResponse.json(productionReadiness(process.env))
}
