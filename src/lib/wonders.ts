import * as THREE from 'three'
import {
  GLOBE_RADIUS,
  metersToGlobeUnits,
  latLngToVector3,
} from './scaling'
import { placeOnSurface } from './placement'

/**
 * WORLD WONDERS
 * -------------
 * The Seven Wonders of the World, in two sets:
 *   1. NEW (modern) 7 Wonders of the World
 *   2. ANCIENT (old) 7 Wonders of the World
 *
 * Each wonder is its own carefully modelled function, built from TRUE
 * real-world dimensions in meters via metersToGlobeUnits (scaling.ts).
 * Real meters ARE the relational scaling — no derived ratios, no guessing.
 * Each wonder has its own key only for the per-object visual multiplier.
 *
 * All builders model geometry with +Y = up and the base at y = 0, then place
 * it with `placeOnSurface` (from ./placement).
 */

// ==========================================================================
// SECTION 1 — NEW (MODERN) 7 WONDERS OF THE WORLD
// ==========================================================================

// --------------------------------------------------------------------------
// Christ the Redeemer - Corcovado, Rio de Janeiro, Brazil
// Statue 30 m tall, arm span 28 m, on an ~8 m pedestal/chapel.
// --------------------------------------------------------------------------
export function addChristTheRedeemer(globe: THREE.Object3D): void {
  const LAT = -22.9519
  const LNG = -43.2105

  const M = 'christRedeemer' as const
  const group = new THREE.Group()

  const stone = new THREE.MeshPhongMaterial({
    color: 0xdcdcd2, emissive: 0x1c1c1a, specular: 0x555555, shininess: 20,
  })
  const pedestalMat = new THREE.MeshPhongMaterial({
    color: 0x8a8a86, emissive: 0x141414, specular: 0x333333, shininess: 10,
  })

  const pedestalH = metersToGlobeUnits(8, M)
  const bodyH = metersToGlobeUnits(22, M)
  const bodyW = metersToGlobeUnits(6, M)
  const headR = metersToGlobeUnits(2.2, M)
  const armSpan = metersToGlobeUnits(28, M)
  const armThick = metersToGlobeUnits(2.0, M)

  const pedestal = new THREE.Mesh(
    new THREE.BoxGeometry(pedestalH * 1.1, pedestalH, pedestalH * 1.1),
    pedestalMat
  )
  pedestal.position.y = pedestalH / 2
  group.add(pedestal)

  // Robed body, slightly tapered.
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(bodyW * 0.32, bodyW * 0.55, bodyH, 16),
    stone
  )
  body.position.y = pedestalH + bodyH / 2
  group.add(body)

  const head = new THREE.Mesh(new THREE.SphereGeometry(headR, 16, 16), stone)
  head.position.y = pedestalH + bodyH + headR * 0.7
  group.add(head)

  // Outstretched arms: a horizontal bar plus rounded caps, set at chest height.
  const arms = new THREE.Mesh(
    new THREE.BoxGeometry(armSpan, armThick, armThick),
    stone
  )
  arms.position.y = pedestalH + bodyH * 0.78
  group.add(arms)

  placeOnSurface(globe, group, LAT, LNG)
}

// --------------------------------------------------------------------------
// Colosseum - Rome, Italy
// Elliptical amphitheatre, 189 m x 156 m, ~48 m tall.
// --------------------------------------------------------------------------
export function addColosseum(globe: THREE.Object3D): void {
  const LAT = 41.8902
  const LNG = 12.4922

  const M = 'colosseum' as const
  const group = new THREE.Group()
  const travertine = new THREE.MeshPhongMaterial({
    color: 0xc9b18a, emissive: 0x1e1810, specular: 0x333333, shininess: 10,
    flatShading: true,
  })
  const arenaMat = new THREE.MeshPhongMaterial({
    color: 0x9c8666, emissive: 0x120d08, specular: 0x222222, shininess: 6,
  })

  const outerA = metersToGlobeUnits(94, M)   // semi-major axis
  const ellipse = 0.83                        // minor/major ratio (156/189)
  const wallH = metersToGlobeUnits(48, M)
  const wallThickness = metersToGlobeUnits(16, M)

  // Solid outer wall ring built as a flat tube (annulus extruded up) so there
  // is no open-ended shell that clips or shows its back faces.
  const buildRing = (radius: number, height: number, thickness: number, mat: THREE.Material, y: number) => {
    const shape = new THREE.Shape()
    shape.absarc(0, 0, radius, 0, Math.PI * 2, false)
    const hole = new THREE.Path()
    hole.absarc(0, 0, radius - thickness, 0, Math.PI * 2, true)
    shape.holes.push(hole)
    const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 48 })
    geo.rotateX(-Math.PI / 2) // extrude along +Y
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.y = y
    mesh.scale.z = ellipse
    return mesh
  }

  // Two stacked tiers, the upper one stepped back, to read as arched storeys.
  group.add(buildRing(outerA, wallH * 0.6, wallThickness, travertine, 0))
  group.add(buildRing(outerA * 0.94, wallH * 0.45, wallThickness * 0.85, travertine, wallH * 0.6))

  // Arena floor slightly recessed inside the ring.
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(outerA - wallThickness, 48),
    arenaMat
  )
  floor.rotation.x = -Math.PI / 2
  floor.scale.y = ellipse
  floor.position.y = metersToGlobeUnits(2, M)
  group.add(floor)

  placeOnSurface(globe, group, LAT, LNG)
}

// --------------------------------------------------------------------------
// Taj Mahal - Agra, India
// 95 m marble plinth, central dome ~73 m total, four 40 m minarets.
// --------------------------------------------------------------------------
export function addTajMahal(globe: THREE.Object3D): void {
  const LAT = 27.1751
  const LNG = 78.0421

  const M = 'tajMahal' as const
  const group = new THREE.Group()
  const marble = new THREE.MeshPhongMaterial({
    color: 0xf2efe9, emissive: 0x1e1e1c, specular: 0x666666, shininess: 30,
  })

  const base = metersToGlobeUnits(56, M)     // main building footprint
  const plinth = metersToGlobeUnits(95, M)   // marble platform
  const plinthH = metersToGlobeUnits(7, M)
  const bodyH = metersToGlobeUnits(30, M)
  const domeR = metersToGlobeUnits(14, M)

  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(plinth, plinthH, plinth),
    marble
  )
  platform.position.y = plinthH / 2
  group.add(platform)

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(base, bodyH, base),
    marble
  )
  body.position.y = plinthH + bodyH / 2
  group.add(body)

  // Drum + onion dome.
  const drum = new THREE.Mesh(
    new THREE.CylinderGeometry(domeR * 1.1, domeR * 1.1, metersToGlobeUnits(8, M), 24),
    marble
  )
  drum.position.y = plinthH + bodyH + metersToGlobeUnits(4, M)
  group.add(drum)

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(domeR, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.62),
    marble
  )
  dome.position.y = plinthH + bodyH + metersToGlobeUnits(8, M)
  group.add(dome)

  const finial = new THREE.Mesh(
    new THREE.ConeGeometry(domeR * 0.12, metersToGlobeUnits(9, M), 12),
    marble
  )
  finial.position.y = plinthH + bodyH + domeR + metersToGlobeUnits(8, M)
  group.add(finial)

  // Four corner minarets on the platform edge.
  const minaretH = metersToGlobeUnits(40, M)
  const minaretR = metersToGlobeUnits(2.2, M)
  const off = plinth * 0.42
  const corners: Array<[number, number]> = [
    [off, off], [off, -off], [-off, off], [-off, -off],
  ]
  corners.forEach(([x, z]) => {
    const minaret = new THREE.Mesh(
      new THREE.CylinderGeometry(minaretR, minaretR * 1.15, minaretH, 12),
      marble
    )
    minaret.position.set(x, plinthH + minaretH / 2, z)
    group.add(minaret)
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(minaretR * 1.4, 12, 12, 0, Math.PI * 2, 0, Math.PI * 0.6),
      marble
    )
    cap.position.set(x, plinthH + minaretH, z)
    group.add(cap)
  })

  placeOnSurface(globe, group, LAT, LNG)
}

// --------------------------------------------------------------------------
// Chichen Itza - El Castillo (Temple of Kukulcan), Yucatan, Mexico
// 55.3 m square base, 30 m tall, nine stepped tiers + temple.
// --------------------------------------------------------------------------
export function addChichenItza(globe: THREE.Object3D): void {
  const LAT = 20.6829
  const LNG = -88.5686

  const M = 'chichenItza' as const
  const group = new THREE.Group()
  const stone = new THREE.MeshPhongMaterial({
    color: 0x9aa08c, emissive: 0x14160f, specular: 0x333333, shininess: 8,
    flatShading: true,
  })

  const base = metersToGlobeUnits(55.3, M)
  const bodyH = metersToGlobeUnits(24, M)
  const tiers = 9
  const tierH = bodyH / tiers

  for (let i = 0; i < tiers; i++) {
    const frac = 1 - (i / tiers) * 0.72
    const size = base * frac
    const tier = new THREE.Mesh(new THREE.BoxGeometry(size, tierH, size), stone)
    tier.position.y = tierH / 2 + i * tierH
    group.add(tier)
  }

  // Temple on the summit.
  const templeH = metersToGlobeUnits(6, M)
  const temple = new THREE.Mesh(
    new THREE.BoxGeometry(base * 0.26, templeH, base * 0.26),
    stone
  )
  temple.position.y = bodyH + templeH / 2
  group.add(temple)

  placeOnSurface(globe, group, LAT, LNG)
}

// --------------------------------------------------------------------------
// Machu Picchu - Andes, Peru
// Terraced citadel (~120 m span) with the Huayna Picchu peak behind it.
// --------------------------------------------------------------------------
export function addMachuPicchu(globe: THREE.Object3D): void {
  const LAT = -13.1631
  const LNG = -72.5450

  const M = 'machuPicchu' as const
  const group = new THREE.Group()
  const stone = new THREE.MeshPhongMaterial({
    color: 0x8f8a7a, emissive: 0x12110c, specular: 0x2a2a2a, shininess: 6,
    flatShading: true,
  })
  const grass = new THREE.MeshPhongMaterial({
    color: 0x5f7d4a, emissive: 0x101509, specular: 0x222222, shininess: 4,
    flatShading: true,
  })

  const width = metersToGlobeUnits(120, M)
  const terraceH = metersToGlobeUnits(5, M)
  const terraces = 5
  for (let i = 0; i < terraces; i++) {
    const frac = 1 - i / (terraces + 1)
    const t = new THREE.Mesh(
      new THREE.BoxGeometry(width * frac, terraceH, width * 0.5 * frac),
      i % 2 === 0 ? stone : grass
    )
    t.position.set(0, terraceH / 2 + i * terraceH, (width * 0.25) * (i / terraces))
    group.add(t)
  }

  // A few little stone structures on the top terrace.
  const topY = terraceH * terraces
  for (let j = -1; j <= 1; j++) {
    const hut = new THREE.Mesh(
      new THREE.BoxGeometry(metersToGlobeUnits(8, M), metersToGlobeUnits(6, M), metersToGlobeUnits(6, M)),
      stone
    )
    hut.position.set(j * metersToGlobeUnits(16, M), topY + metersToGlobeUnits(3, M), -width * 0.05)
    group.add(hut)
  }

  // Huayna Picchu peak rising behind the citadel.
  const peakH = metersToGlobeUnits(90, M)
  const peak = new THREE.Mesh(
    new THREE.ConeGeometry(width * 0.42, peakH, 7),
    stone
  )
  peak.position.set(0, peakH / 2, -width * 0.55)
  group.add(peak)

  placeOnSurface(globe, group, LAT, LNG)
}

// --------------------------------------------------------------------------
// Petra - Al-Khazneh (The Treasury), Jordan
// Rock-cut facade ~25 m wide, ~40 m tall, set into a cliff face.
// --------------------------------------------------------------------------
export function addPetra(globe: THREE.Object3D): void {
  const LAT = 30.3285
  const LNG = 35.4444

  const M = 'petra' as const
  const group = new THREE.Group()
  const rock = new THREE.MeshPhongMaterial({
    color: 0xb2694a, emissive: 0x1e0f0a, specular: 0x333333, shininess: 8,
    flatShading: true,
  })

  const w = metersToGlobeUnits(25, M)
  const h = metersToGlobeUnits(40, M)
  const depth = metersToGlobeUnits(8, M)

  // Cliff the facade is carved into (wider/taller backdrop).
  const cliff = new THREE.Mesh(
    new THREE.BoxGeometry(w * 1.8, h * 1.25, depth),
    rock
  )
  cliff.position.set(0, h * 1.25 / 2, -depth * 0.4)
  group.add(cliff)

  // Lower colonnade (six columns).
  const colH = h * 0.45
  const colR = metersToGlobeUnits(1.4, M)
  for (let i = 0; i < 6; i++) {
    const x = (i / 5 - 0.5) * w * 0.9
    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(colR, colR, colH, 12),
      rock
    )
    col.position.set(x, colH / 2, depth * 0.2)
    group.add(col)
  }

  // Entablature over the lower columns.
  const entab = new THREE.Mesh(
    new THREE.BoxGeometry(w, metersToGlobeUnits(4, M), metersToGlobeUnits(3, M)),
    rock
  )
  entab.position.set(0, colH + metersToGlobeUnits(2, M), depth * 0.2)
  group.add(entab)

  // Upper level with the signature central tholos (round kiosk).
  const tholos = new THREE.Mesh(
    new THREE.CylinderGeometry(w * 0.13, w * 0.13, h * 0.28, 14),
    rock
  )
  tholos.position.set(0, h * 0.72, depth * 0.2)
  group.add(tholos)
  const tholosRoof = new THREE.Mesh(
    new THREE.ConeGeometry(w * 0.16, h * 0.12, 14),
    rock
  )
  tholosRoof.position.set(0, h * 0.72 + h * 0.2, depth * 0.2)
  group.add(tholosRoof)

  placeOnSurface(globe, group, LAT, LNG)
}

// --------------------------------------------------------------------------
// Great Wall of China - representative surface-hugging segment near Beijing
// ~7 m tall, ~6 m wide, with periodic watchtowers.
// --------------------------------------------------------------------------
export function addGreatWall(globe: THREE.Object3D): void {
  const group = new THREE.Group()
  const brick = new THREE.MeshPhongMaterial({
    color: 0x9c9186, emissive: 0x14120f, specular: 0x333333, shininess: 8,
    flatShading: true,
  })

  // Waypoints along the Badaling/Jinshanling ridgeline.
  const waypoints: { lat: number; lng: number }[] = [
    { lat: 40.3587, lng: 116.0169 },
    { lat: 40.4319, lng: 117.2400 },
    { lat: 40.6810, lng: 117.9600 },
    { lat: 40.9200, lng: 118.7000 },
  ]

  const wallH = metersToGlobeUnits(7, 'greatWall')
  const wallThickness = metersToGlobeUnits(6, 'greatWall')

  const orientOnSurface = (mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3, mid: THREE.Vector3) => {
    const up = mid.clone().normalize()
    let forward = b.clone().sub(a)
    forward.sub(up.clone().multiplyScalar(forward.dot(up))).normalize()
    const right = new THREE.Vector3().crossVectors(forward, up).normalize()
    const m = new THREE.Matrix4().makeBasis(forward, up, right)
    mesh.quaternion.setFromRotationMatrix(m)
  }

  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = latLngToVector3(waypoints[i].lat, waypoints[i].lng, GLOBE_RADIUS)
    const b = latLngToVector3(waypoints[i + 1].lat, waypoints[i + 1].lng, GLOBE_RADIUS)
    const mid = a.clone().add(b).multiplyScalar(0.5)
    const segmentLength = a.distanceTo(b)

    const segment = new THREE.Mesh(
      new THREE.BoxGeometry(segmentLength, wallH, wallThickness),
      brick
    )
    orientOnSurface(segment, a, b, mid)
    segment.position.copy(mid.clone().add(mid.clone().normalize().multiplyScalar(wallH / 2)))
    group.add(segment)

    // Watchtower at each waypoint.
    const towerH = wallH * 2.2
    const tower = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness * 2.4, towerH, wallThickness * 2.4),
      brick
    )
    const towerUp = a.clone().normalize()
    tower.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), towerUp))
    tower.position.copy(a.clone().add(towerUp.multiplyScalar(towerH / 2)))
    group.add(tower)
  }

  globe.add(group)
}

// ==========================================================================
// SECTION 2 — ANCIENT (OLD) 7 WONDERS OF THE WORLD
// ==========================================================================
// The Great Pyramid of Giza is the FIRST ancient wonder and is already built
// as the scaling reference object (see addGiza in Globe.tsx / the `giza`
// key). The remaining six are modelled below. Most no longer exist; they are
// placed at their historic coordinates.

// --------------------------------------------------------------------------
// Hanging Gardens of Babylon - near Hillah, Iraq
// Terraced ziggurat-like structure with planted tiers.
// --------------------------------------------------------------------------
export function addHangingGardens(globe: THREE.Object3D): void {
  const M = 'hangingGardens' as const
  const LAT = 32.5355
  const LNG = 44.4275

  const group = new THREE.Group()
  const brick = new THREE.MeshPhongMaterial({
    color: 0xbf8f5a, emissive: 0x1a120a, specular: 0x222222, shininess: 8,
    flatShading: true,
  })
  const foliage = new THREE.MeshPhongMaterial({
    color: 0x4f7a3a, emissive: 0x0e1608, specular: 0x111111, shininess: 6,
    flatShading: true,
  })

  const base = metersToGlobeUnits(120, M)
  const tierH = metersToGlobeUnits(8, M)
  const tiers = 5
  for (let i = 0; i < tiers; i++) {
    const frac = 1 - i / (tiers + 1)
    const tier = new THREE.Mesh(
      new THREE.BoxGeometry(base * frac, tierH, base * 0.7 * frac),
      brick
    )
    tier.position.y = tierH / 2 + i * tierH
    group.add(tier)

    // Planted greenery spilling over each terrace edge.
    const green = new THREE.Mesh(
      new THREE.BoxGeometry(base * frac * 1.02, tierH * 0.35, base * 0.7 * frac * 1.02),
      foliage
    )
    green.position.y = (i + 1) * tierH
    group.add(green)
  }

  placeOnSurface(globe, group, LAT, LNG)
}

// --------------------------------------------------------------------------
// Temple of Artemis - Ephesus, near Selcuk, Turkey
// Greek temple ~115 m x 46 m ringed by ~18 m Ionic columns.
// --------------------------------------------------------------------------
export function addTempleArtemis(globe: THREE.Object3D): void {
  const M = 'templeArtemis' as const
  const LAT = 37.9497
  const LNG = 27.3639

  const group = new THREE.Group()
  const marble = new THREE.MeshPhongMaterial({
    color: 0xeae6da, emissive: 0x1c1b17, specular: 0x555555, shininess: 22,
  })

  const length = metersToGlobeUnits(115, M)
  const width = metersToGlobeUnits(46, M)
  const colH = metersToGlobeUnits(18, M)
  const colR = metersToGlobeUnits(1.2, M)
  const platH = metersToGlobeUnits(3, M)

  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(length, platH, width),
    marble
  )
  platform.position.y = platH / 2
  group.add(platform)

  // Peristyle of columns around the perimeter.
  const cols = 8
  const rows = 3
  for (let i = 0; i < cols; i++) {
    const x = (i / (cols - 1) - 0.5) * length * 0.9
    ;[-1, 1].forEach((side) => {
      const col = new THREE.Mesh(
        new THREE.CylinderGeometry(colR, colR, colH, 12),
        marble
      )
      col.position.set(x, platH + colH / 2, side * width * 0.42)
      group.add(col)
    })
  }
  for (let j = 1; j < rows - 1; j++) {
    ;[-1, 1].forEach((endSide) => {
      const z = (j / (rows - 1) - 0.5) * width * 0.9
      const col = new THREE.Mesh(
        new THREE.CylinderGeometry(colR, colR, colH, 12),
        marble
      )
      col.position.set(endSide * length * 0.45, platH + colH / 2, z)
      group.add(col)
    })
  }

  // Pitched roof over the colonnade.
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(length, metersToGlobeUnits(6, M), width),
    marble
  )
  roof.position.y = platH + colH + metersToGlobeUnits(3, M)
  group.add(roof)

  placeOnSurface(globe, group, LAT, LNG)
}

// --------------------------------------------------------------------------
// Statue of Zeus at Olympia - Olympia, Greece
// ~12 m seated ivory-and-gold statue inside a columned temple.
// --------------------------------------------------------------------------
export function addStatueZeus(globe: THREE.Object3D): void {
  const M = 'statueZeus' as const
  const LAT = 37.6379
  const LNG = 21.6300

  const group = new THREE.Group()
  const gold = new THREE.MeshPhongMaterial({
    color: 0xd9b84a, emissive: 0x241a05, specular: 0x888844, shininess: 60,
  })
  const ivory = new THREE.MeshPhongMaterial({
    color: 0xf0e6cf, emissive: 0x1e1b14, specular: 0x555555, shininess: 25,
  })

  const throneH = metersToGlobeUnits(6, M)
  const throneW = metersToGlobeUnits(6, M)
  const seatH = metersToGlobeUnits(3, M)

  // Throne.
  const throne = new THREE.Mesh(
    new THREE.BoxGeometry(throneW, throneH, throneW * 0.8),
    gold
  )
  throne.position.y = throneH / 2
  group.add(throne)

  // Seated torso.
  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(metersToGlobeUnits(1.6, M), metersToGlobeUnits(2.0, M), metersToGlobeUnits(5, M), 14),
    ivory
  )
  torso.position.y = seatH + metersToGlobeUnits(2.5, M)
  group.add(torso)

  // Head.
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(metersToGlobeUnits(1.1, M), 16, 16),
    ivory
  )
  head.position.y = seatH + metersToGlobeUnits(5.6, M)
  group.add(head)

  // Legs resting forward off the throne.
  ;[-1, 1].forEach((side) => {
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(metersToGlobeUnits(0.7, M), metersToGlobeUnits(0.7, M), seatH, 10),
      ivory
    )
    leg.position.set(side * metersToGlobeUnits(1.2, M), seatH / 2, throneW * 0.35)
    group.add(leg)
  })

  placeOnSurface(globe, group, LAT, LNG)
}

// --------------------------------------------------------------------------
// Mausoleum at Halicarnassus - Bodrum, Turkey
// ~45 m tomb: podium, colonnade, stepped pyramid roof, quadriga on top.
// --------------------------------------------------------------------------
export function addMausoleum(globe: THREE.Object3D): void {
  const M = 'mausoleum' as const
  const LAT = 37.0380
  const LNG = 27.4241

  const group = new THREE.Group()
  const marble = new THREE.MeshPhongMaterial({
    color: 0xe6e0d2, emissive: 0x1b1a15, specular: 0x555555, shininess: 22,
  })

  const base = metersToGlobeUnits(38, M)
  const podiumH = metersToGlobeUnits(20, M)
  const colH = metersToGlobeUnits(12, M)
  const colR = metersToGlobeUnits(1.0, M)

  // Tall podium.
  const podium = new THREE.Mesh(new THREE.BoxGeometry(base, podiumH, base * 0.8), marble)
  podium.position.y = podiumH / 2
  group.add(podium)

  // Surrounding colonnade (36 columns historically; represent a subset).
  const perSide = 5
  for (let i = 0; i < perSide; i++) {
    const t = i / (perSide - 1) - 0.5
    ;[[t * base * 0.9, base * 0.42], [t * base * 0.9, -base * 0.42],
      [base * 0.45, t * base * 0.72], [-base * 0.45, t * base * 0.72]].forEach(([x, z]) => {
      const col = new THREE.Mesh(
        new THREE.CylinderGeometry(colR, colR, colH, 12),
        marble
      )
      col.position.set(x, podiumH + colH / 2, z)
      group.add(col)
    })
  }

  // Stepped pyramid roof (24 steps historically).
  const steps = 6
  const stepH = metersToGlobeUnits(1.5, M)
  for (let i = 0; i < steps; i++) {
    const frac = 1 - i / steps
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(base * 0.8 * frac, stepH, base * 0.64 * frac),
      marble
    )
    step.position.y = podiumH + colH + stepH / 2 + i * stepH
    group.add(step)
  }

  placeOnSurface(globe, group, LAT, LNG)
}

// --------------------------------------------------------------------------
// Colossus of Rhodes - harbour of Rhodes, Greece
// ~33 m bronze statue of Helios on a marble plinth at the harbour mouth.
// --------------------------------------------------------------------------
export function addColossusRhodes(globe: THREE.Object3D): void {
  const M = 'colossusRhodes' as const
  const LAT = 36.4510
  const LNG = 28.2278

  const group = new THREE.Group()
  const bronze = new THREE.MeshPhongMaterial({
    color: 0xb87333, emissive: 0x241206, specular: 0x8a5a2a, shininess: 55,
  })
  const stone = new THREE.MeshPhongMaterial({
    color: 0xd7cdb8, emissive: 0x1a170f, specular: 0x444444, shininess: 18,
  })

  const plinthH = metersToGlobeUnits(5, M)
  const legH = metersToGlobeUnits(13, M)
  const torsoH = metersToGlobeUnits(10, M)

  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(metersToGlobeUnits(5, M), metersToGlobeUnits(6, M), plinthH, 20),
    stone
  )
  plinth.position.y = plinthH / 2
  group.add(plinth)

  ;[-1, 1].forEach((side) => {
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(metersToGlobeUnits(1.2, M), metersToGlobeUnits(1.4, M), legH, 12),
      bronze
    )
    leg.position.set(side * metersToGlobeUnits(1.8, M), plinthH + legH / 2, 0)
    group.add(leg)
  })

  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(metersToGlobeUnits(2.0, M), metersToGlobeUnits(3.0, M), torsoH, 14),
    bronze
  )
  torso.position.y = plinthH + legH + torsoH / 2
  group.add(torso)

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(metersToGlobeUnits(1.6, M), 16, 16),
    bronze
  )
  head.position.y = plinthH + legH + torsoH + metersToGlobeUnits(1.6, M)
  group.add(head)

  // Raised arm holding a torch aloft.
  const arm = new THREE.Mesh(
    new THREE.CylinderGeometry(metersToGlobeUnits(0.9, M), metersToGlobeUnits(0.9, M), metersToGlobeUnits(9, M), 10),
    bronze
  )
  arm.position.set(metersToGlobeUnits(2.5, M), plinthH + legH + torsoH + metersToGlobeUnits(3, M), 0)
  arm.rotation.z = -Math.PI / 6
  group.add(arm)

  placeOnSurface(globe, group, LAT, LNG)
}

// --------------------------------------------------------------------------
// Lighthouse of Alexandria (Pharos) - Alexandria, Egypt
// ~100 m tower: square base, octagonal midsection, cylindrical top + flame.
// --------------------------------------------------------------------------
export function addLighthouseAlexandria(globe: THREE.Object3D): void {
  const M = 'lighthouseAlexandria' as const
  const LAT = 31.2139
  const LNG = 29.8856

  const group = new THREE.Group()
  const stone = new THREE.MeshPhongMaterial({
    color: 0xdac9a6, emissive: 0x1a160f, specular: 0x444444, shininess: 16,
    flatShading: true,
  })
  const flameMat = new THREE.MeshPhongMaterial({
    color: 0xff7a1a, emissive: 0x7a2e00, specular: 0x222222, shininess: 30,
  })

  const baseW = metersToGlobeUnits(30, M)
  const baseH = metersToGlobeUnits(55, M)   // square lower tier
  const midW = metersToGlobeUnits(18, M)
  const midH = metersToGlobeUnits(30, M)    // octagonal middle
  const topR = metersToGlobeUnits(7, M)
  const topH = metersToGlobeUnits(15, M)    // cylindrical top

  const lower = new THREE.Mesh(
    new THREE.BoxGeometry(baseW, baseH, baseW),
    stone
  )
  lower.position.y = baseH / 2
  group.add(lower)

  const mid = new THREE.Mesh(
    new THREE.CylinderGeometry(midW / 2, midW / 2, midH, 8),
    stone
  )
  mid.position.y = baseH + midH / 2
  group.add(mid)

  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(topR, topR, topH, 16),
    stone
  )
  top.position.y = baseH + midH + topH / 2
  group.add(top)

  // The signal fire at the summit.
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(topR * 0.6, metersToGlobeUnits(8, M), 12),
    flameMat
  )
  flame.position.y = baseH + midH + topH + metersToGlobeUnits(4, M)
  group.add(flame)

  placeOnSurface(globe, group, LAT, LNG)
}

// ==========================================================================
// REGISTRATION
// ==========================================================================

/** Build and place the NEW (modern) 7 Wonders of the World. */
export function addNewWorldWonders(globe: THREE.Object3D): void {
  addChristTheRedeemer(globe)
  addColosseum(globe)
  addTajMahal(globe)
  addChichenItza(globe)
  addMachuPicchu(globe)
  addPetra(globe)
  addGreatWall(globe)
}

/**
 * Build and place the ANCIENT (old) 7 Wonders of the World. The Great Pyramid
 * of Giza (the scaling reference) is built separately as `addGiza` in
 * Globe.tsx, so the other six are added here.
 */
export function addAncientWorldWonders(globe: THREE.Object3D): void {
  addHangingGardens(globe)
  addTempleArtemis(globe)
  addStatueZeus(globe)
  addMausoleum(globe)
  addColossusRhodes(globe)
  addLighthouseAlexandria(globe)
}

/** Build and place all Seven Wonders (both the new and ancient sets). */
export function addWorldWonders(globe: THREE.Object3D): void {
  addNewWorldWonders(globe)
  addAncientWorldWonders(globe)
}
