# Footstool — Design & Scaling Reference

This document is the single source of truth for how objects are scaled,
positioned, oriented, and timed on the globe. Follow it so the design stays
consistent as new objects are added.

---

## 1. Coordinate & globe conventions

- The globe is a sphere of **radius `1` globe unit** representing Earth's
  radius **6371 km**. So `1 globe unit = 6371 km`.
- All moving/placed objects are **parented to the globe mesh** so they rotate
  with it automatically.
- Lat/lng → 3D position is done **only** through `latLngToVector3(lat, lng, radius)`
  in [src/lib/scaling.ts](src/lib/scaling.ts). Never re-derive the phi/theta
  math inline — that is how orientation/position drift bugs crept in before.

Position formula (for reference):
```
phi   = (90 - lat) * π/180
theta = (lng + 180) * π/180
x = -(radius * sin(phi) * cos(theta))
z =   radius * sin(phi) * sin(theta)
y =   radius * cos(phi)
```

---

## 2. Scaling system (three stages)

Defined in [src/lib/scaling.ts](src/lib/scaling.ts). Final size of any model:

```
finalSize = metersToGlobeUnits(realMeters, objectType)
          = (realMeters / 1000 / 6371) * OBJECT_SCALE[objectType] * GLOBAL_SCALE
```

### Stage 1 — Base (real-world) scale
Each model is first built at its **true real-world size** relative to the
globe. A model's real dimensions in meters are converted to globe units.

### Stage 2 — Object scale multiplier
A true-to-life object on a 1-unit globe is a sub-pixel speck, so each object
type gets a multiplier. **These are meaningful relative to each other:**

| Object              | `OBJECT_SCALE` | Rationale                                             |
|---------------------|----------------|-------------------------------------------------------|
| Great Pyramid       | **100×**       | Reference landmark; first object placed.              |
| Airplane (A350)     | **2000×**      | ~2000 fit inside the Great Pyramid → comparable size. |
| Ship (Guineaman)    | **2000×**      | Same family as plane/ISS.                             |
| ISS                 | **2000×**      | Same family as plane/ship.                            |

> The 2000× family is deliberate: the plane, ship, and ISS each fit roughly
> 2000 times into the Great Pyramid, so at 2000× they read at a comparable
> on-screen scale.

### Stage 3 — Global scale multiplier
A single `globalScaleMultiplier` (default **1×**) multiplies **every** object
uniformly. A future UI interactable will raise/lower this like a zoom to grow
or shrink all models together. Use `setGlobalScaleMultiplier(value)` and
rebuild the models (or re-run their size math) when it changes.

### Adding a new object
1. Add its real dimensions in meters.
2. Add an `OBJECT_SCALE` entry (choose a multiplier consistent with the
   relative-size rule above).
3. Build geometry with `metersToGlobeUnits(m, 'yourType')`.
4. Place with `latLngToVector3(...)` and orient with `orientAlongPath(...)`.

---

## 3. Orientation & path following

Travelling models (plane, ship, ISS) are built along **local axes**:

- **+X = forward** (nose / bow / velocity direction)
- **+Y = up** (away from Earth's center)
- **+Z = right**

Orientation is handled **only** by `orientAlongPath(obj, position, lookAhead)`
in [src/lib/scaling.ts](src/lib/scaling.ts). It:

- takes the current position and a **look-ahead** point slightly further
  along the path,
- projects the forward vector onto the local tangent plane (so the model sits
  flat on the sphere), and
- builds a right-handed basis so the nose points along the true great-circle
  direction of travel.

This replaces the old flat `atan2` heading math, which broke near the
antimeridian and the poles (the previous "traveling along the globe /
orientation" bugs).

Great-circle paths themselves are produced by `buildGeoPath(waypoints)` in
[src/lib/geoPath.ts](src/lib/geoPath.ts), which slerps between waypoint unit
vectors and times segments by real angular distance (uniform speed).

---

## 4. Time synchronization (shared across all viewers)

Defined in [src/lib/serverTime.ts](src/lib/serverTime.ts).

- Every moving object's position is a **pure function of absolute time**, so:
  - all viewers see objects in the **same place**, and
  - the animation **never restarts** on page reload.
- On load, `syncServerTime()` fetches an authoritative `Date` header from
  GitHub's servers and stores the offset from the local clock. All position
  math calls **`serverNow()` / `serverDate()`**, never `Date.now()` directly.
  If the sync fails, it falls back to the local clock.

---

## 5. Object catalogue

### Great Pyramid of Giza — landmark
- Real size: Khufu 230.4 m base, 146.6 m height (+ Khafre, Menkaure).
- Scale: `pyramid` (100×). Static. Oriented normal to the surface.

### Airplane — Airbus A350, Sydney (YSSY) → Los Angeles (KLAX)
- Route: decoded from the filed ICAO flight plan (DMS fixes) in
  [src/lib/planeFlightPath.ts](src/lib/planeFlightPath.ts).
- Real block time ≈ 13.5 h. Flies out-and-back continuously.
- Scale: `aircraft` (2000×). Cruise altitude raised for visibility.
- **Speed: `PLANE_TEST_SPEED = 200` (testing). Set to `1` for real-time.**

### Ship — 18th-c. slave ship, Middle Passage: Bight of Benin → Jamaica
- Route in [src/lib/shipRoute.ts](src/lib/shipRoute.ts). Sails out-and-back.
- Real voyage ≈ 60 days.
- Scale: `ship` (2000×). Procedural hull + 3 masts with square sails.
- **Speed: `SHIP_TEST_SPEED = 200` (testing). Set to `1` for real-time.**

### ISS — real-time orbital tracking
- Live position from `api.wheretheiss.at`; analytic fallback in
  [src/lib/issOrbit.ts](src/lib/issOrbit.ts) (simplified Kepler + J2).
- Calibration eases (`OFFSET_EASE`) toward the live reading so the ISS is
  **smooth and continuous** — no 10-second snap.
- **Decommission-safe:** when the API is gone, the target offset stays `0`
  and the applied offset decays to `0`, leaving the pure analytic orbit
  (driven by `serverDate()`, so still synced across viewers). Orbit height
  408 km. Scale: `iss` (2000×). ISS speed is already correct — leave as is.

---

## 6. Rules of thumb (do this to stay consistent)

- **Never** inline lat/lng→xyz or heading math. Use `latLngToVector3` and
  `orientAlongPath`.
- **Never** hardcode a scale multiplier in a component. Use
  `metersToGlobeUnits(m, type)` and add the type to `OBJECT_SCALE`.
- **Never** use `Date.now()` for object motion. Use `serverNow()`.
- Model geometry must be built along **+X forward / +Y up**.
- Test speeds live in each route module as a single exported constant; flip
  them to `1` when going to production speeds.
