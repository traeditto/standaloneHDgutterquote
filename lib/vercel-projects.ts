import "server-only"

function withTeam(path: string) {
  const url = new URL(path, "https://api.vercel.com")
  if (process.env.VERCEL_TEAM_ID) url.searchParams.set("teamId", process.env.VERCEL_TEAM_ID)
  return url
}

export async function setVercelProjectPaused(projectId: string, paused: boolean) {
  if (!process.env.VERCEL_TOKEN) return { changed: false, reason: "VERCEL_TOKEN is not configured." }
  const action = paused ? "pause" : "unpause"
  const response = await fetch(withTeam(`/v1/projects/${encodeURIComponent(projectId)}/${action}`), {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}`, "Content-Type": "application/json" },
    cache: "no-store",
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(payload.error?.message || `Vercel could not ${action} project ${projectId}.`)
  }
  return { changed: true }
}

