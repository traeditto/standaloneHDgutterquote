import { mkdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)
const source = "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_Gaz_counties_national.zip"
const work = join(tmpdir(), `gutterquote-counties-${process.pid}`)
const archive = join(work, "counties.zip")

await mkdir(work, { recursive: true })
await execFileAsync("curl", ["-fsSLo", archive, source])
const { stdout } = await execFileAsync("unzip", ["-p", archive], { maxBuffer: 4_000_000 })

const rows = stdout.trim().split(/\r?\n/).slice(1)
const counties = {}
for (const row of rows) {
  const [state, geoid, , , name] = row.split("|")
  if (!state || !geoid || !name || state === "PR") continue
  ;(counties[state] ??= []).push({ fips: geoid, name })
}

for (const values of Object.values(counties)) values.sort((a, b) => a.name.localeCompare(b.name))
await writeFile("lib/us-counties.json", `${JSON.stringify(counties, null, 2)}\n`)
console.log(`Wrote ${Object.values(counties).flat().length} county-equivalents across ${Object.keys(counties).length} states/D.C.`)
