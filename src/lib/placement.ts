import * as THREE from 'three'
import { GLOBE_RADIUS, latLngToVector3 } from './scaling'

/**
 * Place a structure group upright on the globe surface at lat/lng.
 *
 * Shared by both wonders and landmarks. Structures are modelled in the local
 * frame with +Y = up and the base at y = 0; this sets the group origin on the
 * surface and rotates local +Y to the surface normal so it stands upright.
 */
export function placeOnSurface(
  globe: THREE.Object3D,
  group: THREE.Group,
  lat: number,
  lng: number
): void {
  const surfacePos = latLngToVector3(lat, lng, GLOBE_RADIUS)
  group.position.copy(surfacePos)
  const surfaceNormal = surfacePos.clone().normalize()
  const up = new THREE.Vector3(0, 1, 0)
  group.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(up, surfaceNormal))
  globe.add(group)
}
