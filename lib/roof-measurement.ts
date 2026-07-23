export type RoofMeasurementSource =
  | "county-appraiser"
  | "county-gis"
  | "usa-structures"
  | "osm"
  | "solar"
  | "solar-hybrid"
  | "manual"

export interface RoofMeasurement {
  /** Total roof surface area in square feet, including measured or modeled pitch. */
  roofAreaSqFt: number
  /** Building footprint in square feet. */
  footprintSqFt: number
  /** Number of distinct roof facets detected or estimated. */
  segments: number
  /** Estimated roof pitch, for example 5/12. */
  pitch: string
  stories?: number
  /** Confidence from 0 to 1. */
  confidence: number
  source: RoofMeasurementSource
  matchedAddress?: string
}

export function roofMeasurementSourceLabel(source: RoofMeasurementSource) {
  switch (source) {
    case "county-appraiser": return "county property-appraiser records"
    case "county-gis": return "county GIS building records"
    case "usa-structures": return "national building-footprint records"
    case "osm": return "mapped building footprints"
    case "solar": return "aerial roof imagery"
    case "solar-hybrid": return "property records cross-checked with aerial imagery"
    case "manual": return "your manual adjustment"
  }
}
