import * as THREE from 'three'
import { metersToGlobeUnits } from './scaling'
import { placeOnSurface } from './placement'

/**
 * LANDMARKS
 * ---------
 * Notable man-made structures that are NOT one of the Seven Wonders (those
 * live in ./wonders). Same rules apply: each landmark is modelled at TRUE
 * real-world size in meters (real meters ARE the relational scaling), has its
 * own key only for the per-object visual multiplier, is built with +Y = up /
 * base at y = 0, and is placed with `placeOnSurface` (from ./placement).
 */

// --------------------------------------------------------------------------
// The White House - 1600 Pennsylvania Ave, Washington, D.C.
// Neoclassical residence ~51 m x 26 m, ~21 m tall, with a columned north
// portico and a domed South Portico bay.
// --------------------------------------------------------------------------
export function addWhiteHouse(globe: THREE.Object3D): void {
  const M = 'whiteHouse' as const
  const LAT = 38.8977
  const LNG = -77.0365

  const group = new THREE.Group()
  const wallMat = new THREE.MeshPhongMaterial({
    color: 0xf4f4f0, emissive: 0x1e1e1c, specular: 0x555555, shininess: 25,
  })
  const roofMat = new THREE.MeshPhongMaterial({
    color: 0xbfc2c4, emissive: 0x121314, specular: 0x333333, shininess: 15,
    flatShading: true,
  })

  const width = metersToGlobeUnits(51, M)   // east-west
  const depth = metersToGlobeUnits(26, M)   // north-south
  const bodyH = metersToGlobeUnits(15, M)
  const roofH = metersToGlobeUnits(3, M)

  // Main residence block (three storeys).
  const body = new THREE.Mesh(new THREE.BoxGeometry(width, bodyH, depth), wallMat)
  body.position.y = bodyH / 2
  group.add(body)

  // Flat balustraded roof slab.
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(width * 1.02, roofH, depth * 1.02),
    roofMat
  )
  roof.position.y = bodyH + roofH / 2
  group.add(roof)

  // North Portico: four columns + pediment on the long (north) face.
  const colH = bodyH * 0.85
  const colR = metersToGlobeUnits(1.1, M)
  const porticoZ = depth / 2 + metersToGlobeUnits(3, M)
  for (let i = 0; i < 4; i++) {
    const x = (i / 3 - 0.5) * width * 0.4
    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(colR, colR, colH, 12),
      wallMat
    )
    col.position.set(x, colH / 2, porticoZ)
    group.add(col)
  }
  const pediment = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.5, metersToGlobeUnits(3, M), metersToGlobeUnits(4, M)),
    wallMat
  )
  pediment.position.set(0, colH + metersToGlobeUnits(1.5, M), porticoZ)
  group.add(pediment)

  // South Portico: semicircular columned bay on the opposite face.
  const bayR = metersToGlobeUnits(9, M)
  const bay = new THREE.Mesh(
    new THREE.CylinderGeometry(bayR, bayR, bodyH, 20, 1, false, -Math.PI / 2, Math.PI),
    wallMat
  )
  bay.position.set(0, bodyH / 2, -depth / 2)
  group.add(bay)

  placeOnSurface(globe, group, LAT, LNG)
}

// --------------------------------------------------------------------------
// The Kaaba - Masjid al-Haram, Mecca, Saudi Arabia.
// Granite cuboid ~12.86 m x 11.03 m, ~13.1 m tall, draped in the black
// kiswah with the gold-embroidered hizam band around the upper third.
// --------------------------------------------------------------------------
export function addKaaba(globe: THREE.Object3D): void {
  const M = 'kaaba' as const
  const LAT = 21.4225
  const LNG = 39.8262

  const group = new THREE.Group()

  const width = metersToGlobeUnits(12.86, M)  // long face
  const depth = metersToGlobeUnits(11.03, M)  // short face
  const height = metersToGlobeUnits(13.1, M)

  const kiswahMat = new THREE.MeshPhongMaterial({
    color: 0x0a0a0a, emissive: 0x050505, specular: 0x333333, shininess: 20,
  })
  const hizamMat = new THREE.MeshPhongMaterial({
    color: 0xc9a227, emissive: 0x3a2c08, specular: 0x777733, shininess: 60,
  })

  // Main cuboid draped in the kiswah.
  const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), kiswahMat)
  body.position.y = height / 2
  group.add(body)

  // Hizam: gold band around the upper third.
  const bandH = metersToGlobeUnits(0.95, M)
  const band = new THREE.Mesh(
    new THREE.BoxGeometry(width * 1.01, bandH, depth * 1.01),
    hizamMat
  )
  band.position.y = height * 0.72
  group.add(band)

  placeOnSurface(globe, group, LAT, LNG)
}

// ==========================================================================
// REGISTRATION
// ==========================================================================

/** Build and place all standalone landmarks. */
export function addLandmarks(globe: THREE.Object3D): void {
  addWhiteHouse(globe)
  addKaaba(globe)
}
