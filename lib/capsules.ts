export type CapsuleRecord = {
  id: string
  authorId: string
  authorName: string
  content: string
  latitude: number
  longitude: number
  radius: number
  createdAt?: unknown
}

export type SafeZone = {
  lat: number
  lng: number
  radius: number
  active?: boolean
  isActive?: boolean
}

export const DEFAULT_CAPSULE_RADIUS_METERS = 20

export function calculateDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const earthRadiusMeters = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return Math.round(earthRadiusMeters * c)
}

export function isCapsuleUnlocked(
  distanceMeters: number,
  radiusMeters: number = DEFAULT_CAPSULE_RADIUS_METERS
): boolean {
  return distanceMeters <= radiusMeters
}

export function isPointInsideSafeZone(
  latitude: number,
  longitude: number,
  zones: SafeZone[]
): boolean {
  return zones.some((zone) => {
    const isActive = zone.active !== false && zone.isActive !== false
    return (
      isActive &&
      Number.isFinite(zone.lat) &&
      Number.isFinite(zone.lng) &&
      Number.isFinite(zone.radius) &&
      calculateDistanceMeters(latitude, longitude, zone.lat, zone.lng) <= zone.radius
    )
  })
}

export function formatDistance(distanceMeters: number): string {
  if (distanceMeters < 1000) {
    return `${distanceMeters} m`
  }

  return `${(distanceMeters / 1000).toFixed(1)} km`
}

export function buildCapsulePayload({
  authorId,
  authorName,
  content,
  latitude,
  longitude,
  radius = DEFAULT_CAPSULE_RADIUS_METERS,
}: {
  authorId: string
  authorName: string
  content: string
  latitude: number
  longitude: number
  radius?: number
}) {
  return {
    authorId,
    authorName,
    content,
    latitude,
    longitude,
    radius,
  }
}
