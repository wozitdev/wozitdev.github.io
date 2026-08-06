import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { feature } from 'topojson-client'
import { calculateISSPosition, updateISSCalibration } from '@/lib/issOrbit'
import planeFlightPath from '@/lib/planeFlightPath'
import { getShipPosition } from '@/lib/shipRoute'
import { syncServerTime, serverNow } from '@/lib/serverTime'
import { addWorldWonders } from '@/lib/wonders'
import { addLandmarks } from '@/lib/landmarks'
import { addCrudeOilLayer, updateCrudeOilLayer } from '@/lib/crudeOil'
import {
  GLOBE_RADIUS,
  metersToGlobeUnits,
  kmToGlobeUnits,
  latLngToVector3,
  orientAlongPath,
} from '@/lib/scaling'

interface GlobeProps {
  autoRotate?: boolean
  autoRotateSpeed?: number
  onInteraction?: () => void
  onZoomChange?: (zoomLevel: number) => void
  onCameraChange?: (position: { lat: number; lng: number }) => void
}

export function Globe({ autoRotate = true, autoRotateSpeed = 0.0005, onInteraction, onZoomChange, onCameraChange }: GlobeProps) {
  const FLICK_MAX_DURATION_MS = 220
  const FLICK_MIN_SPEED = 0.012
  const FLICK_MIN_DISTANCE_PX = 90

  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const globeRef = useRef<THREE.Mesh | null>(null)
  const outlineRef = useRef<THREE.Mesh | null>(null)
  const stateOutlinesRef = useRef<THREE.Group | null>(null)
  const animationFrameRef = useRef<number | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  
  const isDragging = useRef(false)
  const previousMousePosition = useRef({ x: 0, y: 0 })
  const velocity = useRef({ x: 0, y: 0 })
  const lastInteractionTime = useRef(Date.now())
  const hasInteracted = useRef(false)
  const shouldAutoRotate = useRef(true)
  const dragStartTime = useRef(0)
  const dragDistance = useRef(0)
  const issRef = useRef<THREE.Group | null>(null)
  const planeRef = useRef<THREE.Group | null>(null)
  const shipRef = useRef<THREE.Group | null>(null)

  const updateBoardingPlank = (
    shipGroup: THREE.Group,
    state: ReturnType<typeof getShipPosition>
  ) => {
    const boardingPlank = shipGroup.getObjectByName('boardingPlank') as THREE.Mesh | null
    const dims = shipGroup.userData.shipDims as
      | { lengthU: number; beamU: number; heightU: number }
      | undefined

    if (!boardingPlank || !dims) return

    const { lengthU, beamU, heightU } = dims

    if (state.isDocked && state.portLatitude !== undefined && state.portLongitude !== undefined) {
      const pos = shipGroup.position
      const portPos = latLngToVector3(state.portLatitude, state.portLongitude, GLOBE_RADIUS)
      const up = pos.clone().normalize()
      const toPort = portPos.clone().sub(pos)

      // Keep the gangplank tangent to the sea surface at the hull.
      toPort.sub(up.clone().multiplyScalar(toPort.dot(up)))

      if (toPort.lengthSq() > 1e-12) {
        boardingPlank.visible = true

        const localToPort = toPort
          .normalize()
          .applyQuaternion(shipGroup.quaternion.clone().invert())
        localToPort.y = 0

        if (localToPort.lengthSq() > 1e-12) {
          localToPort.normalize()
          const sideSign = localToPort.z >= 0 ? 1 : -1

          boardingPlank.position.set(
            lengthU * 0.06,
            heightU * 0.48,
            sideSign * beamU * 0.54
          )

          const aim = localToPort.clone()
          aim.z += sideSign * 0.05
          aim.normalize()
          boardingPlank.quaternion.setFromUnitVectors(
            new THREE.Vector3(1, 0, 0),
            aim
          )
        } else {
          boardingPlank.visible = false
        }
      } else {
        boardingPlank.visible = false
      }
    } else {
      boardingPlank.visible = false
    }
  }

  useEffect(() => {
    if (!containerRef.current) return

    // Sync to server time so every viewer sees moving models in the same
    // place and the animation never restarts on reload.
    syncServerTime()

    const scene = new THREE.Scene()
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    )
    camera.position.z = 2.1
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      powerPreference: 'high-performance'
    })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    containerRef.current.appendChild(renderer.domElement)
    rendererRef.current = renderer

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2)
    scene.add(ambientLight)

    const fillLight1 = new THREE.DirectionalLight(0x6699ff, 0.3)
    fillLight1.position.set(-3, 2, 4)
    scene.add(fillLight1)

    const fillLight2 = new THREE.DirectionalLight(0x4488ff, 0.25)
    fillLight2.position.set(3, -2, -4)
    scene.add(fillLight2)

    const geometry = new THREE.SphereGeometry(1, 64, 64)
    
    const material = new THREE.MeshPhongMaterial({
      color: 0x2233ff,
      emissive: 0x112244,
      specular: 0x222222,
      shininess: 5,
      transparent: true,
      opacity: 0,
    })

    const globe = new THREE.Mesh(geometry, material)
    scene.add(globe)
    globeRef.current = globe

    const outlineGeometry = new THREE.SphereGeometry(1.005, 64, 64)
    const outlineMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0,
      side: THREE.BackSide,
    })
    const outline = new THREE.Mesh(outlineGeometry, outlineMaterial)
    scene.add(outline)
    outlineRef.current = outline

    const textureLoader = new THREE.TextureLoader()
    textureLoader.load(
      'https://unpkg.com/three-globe@2.31.1/example/img/earth-blue-marble.jpg',
      (texture) => {
        material.map = texture
        material.needsUpdate = true
        
        let fadeInProgress = 0
        const fadeInDuration = 600
        const startTime = Date.now()
        
        const fadeIn = () => {
          const elapsed = Date.now() - startTime
          fadeInProgress = Math.min(elapsed / fadeInDuration, 1)
          material.opacity = fadeInProgress
          
          if (fadeInProgress < 1) {
            requestAnimationFrame(fadeIn)
          } else {
            material.transparent = false
            material.opacity = 1
            material.needsUpdate = true
          }
        }
        fadeIn()
        
        setLoading(false)
      },
      undefined,
      () => {
        setLoading(false)
      }
    )

    const atmosphereGeometry = new THREE.SphereGeometry(1.01, 64, 64)
    const atmosphereMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.6 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
          gl_FragColor = vec4(0.3, 0.6, 1.0, 1.0) * intensity;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
    })
    const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial)
    scene.add(atmosphere)

    const stateOutlinesGroup = new THREE.Group()
    scene.add(stateOutlinesGroup)
    stateOutlinesRef.current = stateOutlinesGroup

    // Giza — the reference object the entire scaling system is derived from.
    const addGiza = () => {
      const gizaGroup = new THREE.Group()
      
      const pyramids = [
        { name: 'Khufu', lat: 29.9792, lon: 31.1342, baseSize: 230.4, height: 146.6 },
        { name: 'Khafre', lat: 29.9753, lon: 31.1308, baseSize: 215.5, height: 136.4 },
        { name: 'Menkaure', lat: 29.9722, lon: 31.1281, baseSize: 108.5, height: 65.5 }
      ]
      
      pyramids.forEach(pyramid => {
        const baseSizeInGlobeUnits = metersToGlobeUnits(pyramid.baseSize, 'giza')
        const heightInGlobeUnits = metersToGlobeUnits(pyramid.height, 'giza')
        
        const pyramidGeometry = new THREE.ConeGeometry(
          baseSizeInGlobeUnits / Math.sqrt(2),
          heightInGlobeUnits,
          4,
          1
        )
        
        const pyramidMaterial = new THREE.MeshPhongMaterial({
          color: 0xd4a574,
          emissive: 0x332200,
          specular: 0x444444,
          shininess: 30,
          flatShading: true
        })
        
        const pyramidMesh = new THREE.Mesh(pyramidGeometry, pyramidMaterial)
        pyramidMesh.rotation.y = Math.PI / 4
        
        const surfaceRadius = GLOBE_RADIUS + heightInGlobeUnits / 2
        const surfacePos = latLngToVector3(pyramid.lat, pyramid.lon, surfaceRadius)
        pyramidMesh.position.copy(surfacePos)
        
        const surfaceNormal = surfacePos.clone().normalize()
        const up = new THREE.Vector3(0, 1, 0)
        const quaternion = new THREE.Quaternion().setFromUnitVectors(up, surfaceNormal)
        pyramidMesh.quaternion.copy(quaternion)
        
        gizaGroup.add(pyramidMesh)
      })
      
      globe.add(gizaGroup)
    }
    
    addGiza()

    const addCrucifixionCross = () => {
      // Traditional location associated with the crucifixion site (Golgotha),
      // near the Church of the Holy Sepulchre in Jerusalem.
      const GOLGOTHA_LAT = 31.7780
      const GOLGOTHA_LNG = 35.2297

      // Approximate wooden cross dimensions in meters.
      const POST_HEIGHT_M = 4.0
      const POST_WIDTH_M = 0.28
      const BEAM_WIDTH_M = 2.0
      const BEAM_HEIGHT_M = 0.24

      const crossGroup = new THREE.Group()

      const postHeight = metersToGlobeUnits(POST_HEIGHT_M, 'cross')
      const postWidth = metersToGlobeUnits(POST_WIDTH_M, 'cross')
      const beamWidth = metersToGlobeUnits(BEAM_WIDTH_M, 'cross')
      const beamHeight = metersToGlobeUnits(BEAM_HEIGHT_M, 'cross')

      const woodMaterial = new THREE.MeshPhongMaterial({
        color: 0x6f4a2d,
        emissive: 0x1f140d,
        specular: 0x444444,
        shininess: 12,
      })

      const postGeometry = new THREE.BoxGeometry(postWidth, postHeight, postWidth)
      const postMesh = new THREE.Mesh(postGeometry, woodMaterial)
      postMesh.position.y = postHeight / 2
      crossGroup.add(postMesh)

      const beamGeometry = new THREE.BoxGeometry(beamWidth, beamHeight, postWidth * 0.9)
      const beamMesh = new THREE.Mesh(beamGeometry, woodMaterial)
      beamMesh.position.y = postHeight * 0.66
      crossGroup.add(beamMesh)

      const surfacePos = latLngToVector3(GOLGOTHA_LAT, GOLGOTHA_LNG, GLOBE_RADIUS)
      crossGroup.position.copy(surfacePos)

      const surfaceNormal = surfacePos.clone().normalize()
      const up = new THREE.Vector3(0, 1, 0)
      const alignToSurface = new THREE.Quaternion().setFromUnitVectors(up, surfaceNormal)
      crossGroup.quaternion.copy(alignToSurface)

      globe.add(crossGroup)
    }

    addCrucifixionCross()

    addWorldWonders(globe)

    addLandmarks(globe)

    addCrudeOilLayer(globe)

    const addISS = () => {
      const ISS_ORBITAL_HEIGHT_KM = 408
      const ISS_LENGTH_M = 73
      const ISS_WIDTH_M = 109
      const ISS_HEIGHT_M = 20

      const issGroup = new THREE.Group()
      issRef.current = issGroup

      const lengthInGlobeUnits = metersToGlobeUnits(ISS_LENGTH_M, 'iss')
      const widthInGlobeUnits = metersToGlobeUnits(ISS_WIDTH_M, 'iss')
      const heightInGlobeUnits = metersToGlobeUnits(ISS_HEIGHT_M, 'iss')

      const metalMaterial = new THREE.MeshPhongMaterial({
        color: 0xe8e8e8,
        emissive: 0x1a1a1a,
        specular: 0x999999,
        shininess: 90,
      })

      const goldMaterial = new THREE.MeshPhongMaterial({
        color: 0xd4af37,
        emissive: 0x2a1f0a,
        specular: 0x888888,
        shininess: 70,
      })

      const solarPanelMaterial = new THREE.MeshPhongMaterial({
        color: 0x1a3a6b,
        emissive: 0x0a1530,
        specular: 0x333333,
        shininess: 50,
      })

      const mainTrussGeometry = new THREE.CylinderGeometry(
        lengthInGlobeUnits * 0.015,
        lengthInGlobeUnits * 0.015,
        lengthInGlobeUnits,
        8
      )
      const mainTruss = new THREE.Mesh(mainTrussGeometry, metalMaterial)
      mainTruss.rotation.z = Math.PI / 2
      issGroup.add(mainTruss)

      const modulePositions = [
        { x: -lengthInGlobeUnits * 0.25, scale: 0.7 },
        { x: -lengthInGlobeUnits * 0.1, scale: 0.9 },
        { x: lengthInGlobeUnits * 0.05, scale: 0.8 },
        { x: lengthInGlobeUnits * 0.2, scale: 0.75 },
      ]

      modulePositions.forEach(({ x, scale }) => {
        const moduleGeometry = new THREE.CylinderGeometry(
          heightInGlobeUnits * 0.25 * scale,
          heightInGlobeUnits * 0.25 * scale,
          widthInGlobeUnits * 0.15 * scale,
          12
        )
        const module = new THREE.Mesh(moduleGeometry, metalMaterial)
        module.position.set(x, 0, 0)
        module.rotation.z = Math.PI / 2
        issGroup.add(module)
      })

      const coneGeometry = new THREE.ConeGeometry(heightInGlobeUnits * 0.15, widthInGlobeUnits * 0.1, 8)
      const cone = new THREE.Mesh(coneGeometry, goldMaterial)
      cone.position.set(lengthInGlobeUnits * 0.35, 0, 0)
      cone.rotation.z = -Math.PI / 2
      issGroup.add(cone)

      const solarArrayPositions = [
        { x: -lengthInGlobeUnits * 0.35, z: 0 },
        { x: lengthInGlobeUnits * 0.15, z: 0 },
      ]

      solarArrayPositions.forEach(({ x, z }) => {
        const panelWidth = widthInGlobeUnits * 0.12
        const panelLength = widthInGlobeUnits * 0.45
        const panelThickness = heightInGlobeUnits * 0.01
        const armLength = widthInGlobeUnits * 0.08

        const createSolarArray = (side: number) => {
          const armGeometry = new THREE.BoxGeometry(
            panelWidth * 0.08,
            armLength,
            panelWidth * 0.08
          )
          const arm = new THREE.Mesh(armGeometry, metalMaterial)
          arm.position.set(x, side * armLength / 2, z)
          issGroup.add(arm)

          const panelGeometry = new THREE.BoxGeometry(panelWidth, panelThickness, panelLength)
          const panel = new THREE.Mesh(panelGeometry, solarPanelMaterial)
          panel.position.set(x, side * (armLength + panelLength / 2), z)
          panel.rotation.x = Math.PI / 2
          issGroup.add(panel)
        }

        createSolarArray(1)
        createSolarArray(-1)
      })

      const radiatorPositions = [
        { x: -lengthInGlobeUnits * 0.05, angle: 0.3 },
        { x: lengthInGlobeUnits * 0.1, angle: -0.3 },
      ]

      radiatorPositions.forEach(({ x, angle }) => {
        const radiatorGeometry = new THREE.BoxGeometry(
          widthInGlobeUnits * 0.08,
          heightInGlobeUnits * 0.01,
          widthInGlobeUnits * 0.2
        )
        const radiatorMaterial = new THREE.MeshPhongMaterial({
          color: 0xcccccc,
          emissive: 0x0a0a0a,
          specular: 0x666666,
          shininess: 60,
        })
        const radiator = new THREE.Mesh(radiatorGeometry, radiatorMaterial)
        radiator.position.set(x, 0, 0)
        radiator.rotation.y = angle
        issGroup.add(radiator)
      })

      globe.add(issGroup)

      const orbitalRadius = GLOBE_RADIUS + kmToGlobeUnits(ISS_ORBITAL_HEIGHT_KM)

      const updateISSPosition = () => {
        const here = calculateISSPosition()
        const ahead = calculateISSPosition(new Date(serverNow() + 4000))

        const pos = latLngToVector3(here.latitude, here.longitude, orbitalRadius)
        const lookAhead = latLngToVector3(ahead.latitude, ahead.longitude, orbitalRadius)

        issGroup.position.copy(pos)
        orientAlongPath(issGroup, pos, lookAhead)
      }

      updateISSPosition()
    }

    addISS()

    const addPlane = () => {
      const A350_LENGTH_M = 73.8
      const A350_WINGSPAN_M = 64.8
      const A350_HEIGHT_M = 17.1

      const planeGroup = new THREE.Group()
      planeRef.current = planeGroup

      // Inner group holds the aircraft geometry, which is modelled with the
      // wingspan along local Y. orientAlongPath makes +Y point up (away from
      // Earth), so rotate -90deg about X to lay the wings flat (along Z) and
      // keep the vertical stabilizer pointing up. This makes the plane fly level.
      const planeBody = new THREE.Group()
      planeBody.rotation.x = -Math.PI / 2
      planeGroup.add(planeBody)

      const lengthInGlobeUnits = metersToGlobeUnits(A350_LENGTH_M, 'aircraft')
      const wingspanInGlobeUnits = metersToGlobeUnits(A350_WINGSPAN_M, 'aircraft')
      const heightInGlobeUnits = metersToGlobeUnits(A350_HEIGHT_M, 'aircraft')

      const tanColor = 0xD2B48C

      const fuselageMaterial = new THREE.MeshPhongMaterial({
        color: tanColor,
        emissive: 0x2a2418,
        specular: 0x888888,
        shininess: 60,
      })

      const fuselageGeometry = new THREE.CylinderGeometry(
        heightInGlobeUnits * 0.25,
        heightInGlobeUnits * 0.2,
        lengthInGlobeUnits,
        16
      )
      const fuselage = new THREE.Mesh(fuselageGeometry, fuselageMaterial)
      fuselage.rotation.z = Math.PI / 2
      planeBody.add(fuselage)

      const noseGeometry = new THREE.ConeGeometry(
        heightInGlobeUnits * 0.25,
        lengthInGlobeUnits * 0.15,
        16
      )
      const nose = new THREE.Mesh(noseGeometry, fuselageMaterial)
      nose.position.set(lengthInGlobeUnits * 0.575, 0, 0)
      nose.rotation.z = -Math.PI / 2
      planeBody.add(nose)

      const tailGeometry = new THREE.ConeGeometry(
        heightInGlobeUnits * 0.2,
        lengthInGlobeUnits * 0.12,
        12
      )
      const tail = new THREE.Mesh(tailGeometry, fuselageMaterial)
      tail.position.set(-lengthInGlobeUnits * 0.56, 0, 0)
      tail.rotation.z = Math.PI / 2
      planeBody.add(tail)

      const wingGeometry = new THREE.BoxGeometry(
        lengthInGlobeUnits * 0.08,
        wingspanInGlobeUnits,
        lengthInGlobeUnits * 0.3
      )
      const wing = new THREE.Mesh(wingGeometry, fuselageMaterial)
      wing.position.set(lengthInGlobeUnits * 0.1, 0, -heightInGlobeUnits * 0.15)
      planeBody.add(wing)

      const engineGeometry = new THREE.CylinderGeometry(
        heightInGlobeUnits * 0.12,
        heightInGlobeUnits * 0.14,
        lengthInGlobeUnits * 0.2,
        12
      )
      const engineMaterial = new THREE.MeshPhongMaterial({
        color: 0x333333,
        emissive: 0x111111,
        specular: 0x666666,
        shininess: 80,
      })
      
      const enginePositions = [
        { y: wingspanInGlobeUnits * 0.25 },
        { y: -wingspanInGlobeUnits * 0.25 },
      ]
      
      enginePositions.forEach(({ y }) => {
        const engine = new THREE.Mesh(engineGeometry, engineMaterial)
        engine.position.set(lengthInGlobeUnits * 0.05, y, -heightInGlobeUnits * 0.25)
        engine.rotation.z = Math.PI / 2
        planeBody.add(engine)
      })

      const tailWingGeometry = new THREE.BoxGeometry(
        lengthInGlobeUnits * 0.05,
        wingspanInGlobeUnits * 0.35,
        lengthInGlobeUnits * 0.15
      )
      const tailWing = new THREE.Mesh(tailWingGeometry, fuselageMaterial)
      tailWing.position.set(-lengthInGlobeUnits * 0.4, 0, 0)
      planeBody.add(tailWing)

      const verticalStabilizerGeometry = new THREE.BoxGeometry(
        lengthInGlobeUnits * 0.04,
        lengthInGlobeUnits * 0.12,
        heightInGlobeUnits * 0.35
      )
      const verticalStabilizer = new THREE.Mesh(verticalStabilizerGeometry, fuselageMaterial)
      verticalStabilizer.position.set(-lengthInGlobeUnits * 0.42, 0, heightInGlobeUnits * 0.25)
      planeBody.add(verticalStabilizer)

      globe.add(planeGroup)

      const updatePlanePosition = () => {
        const state = planeFlightPath.getPlanePosition()
        const pos = latLngToVector3(
          state.latitude,
          state.longitude,
          GLOBE_RADIUS + state.altitude
        )
        const lookAhead = latLngToVector3(
          state.aheadLatitude,
          state.aheadLongitude,
          GLOBE_RADIUS + state.aheadAltitude
        )
        planeGroup.position.copy(pos)
        orientAlongPath(planeGroup, pos, lookAhead)
      }

      updatePlanePosition()
    }

    addPlane()

    const addShip = () => {
      // A typical 18th-century slave ship ("Guineaman") was ~30 m long.
      const SHIP_LENGTH_M = 30
      const SHIP_BEAM_M = 8
      const SHIP_HEIGHT_M = 6

      const shipGroup = new THREE.Group()
      shipRef.current = shipGroup

      const lengthU = metersToGlobeUnits(SHIP_LENGTH_M, 'ship')
      const beamU = metersToGlobeUnits(SHIP_BEAM_M, 'ship')
      const heightU = metersToGlobeUnits(SHIP_HEIGHT_M, 'ship')
      shipGroup.userData.shipDims = { lengthU, beamU, heightU }

      const hullMaterial = new THREE.MeshPhongMaterial({
        color: 0x5a3a22,
        emissive: 0x1a1008,
        specular: 0x444444,
        shininess: 20,
        flatShading: true,
      })
      const deckMaterial = new THREE.MeshPhongMaterial({
        color: 0x8a6a44,
        emissive: 0x201810,
        specular: 0x333333,
        shininess: 15,
      })
      const mastMaterial = new THREE.MeshPhongMaterial({
        color: 0x3a2818,
        shininess: 10,
      })
      const sailMaterial = new THREE.MeshPhongMaterial({
        color: 0xf0ead6,
        emissive: 0x2a2820,
        specular: 0x222222,
        shininess: 8,
        side: THREE.DoubleSide,
      })
      const plankMaterial = new THREE.MeshPhongMaterial({
        color: 0x7d5a38,
        emissive: 0x1f150d,
        specular: 0x333333,
        shininess: 10,
      })

      // Hull: a stretched, tapered box along +X (bow at +X).
      const hullGeometry = new THREE.BoxGeometry(lengthU, heightU * 0.6, beamU)
      // Taper the bow by scaling the +X vertices inward.
      const hullPos = hullGeometry.attributes.position
      for (let i = 0; i < hullPos.count; i++) {
        const x = hullPos.getX(i)
        if (x > 0) {
          hullPos.setZ(i, hullPos.getZ(i) * (1 - (x / (lengthU / 2)) * 0.7))
          hullPos.setY(i, hullPos.getY(i) + (x / (lengthU / 2)) * heightU * 0.1)
        }
      }
      hullPos.needsUpdate = true
      hullGeometry.computeVertexNormals()
      const hull = new THREE.Mesh(hullGeometry, hullMaterial)
      hull.position.y = heightU * 0.2
      shipGroup.add(hull)

      // Deck
      const deckGeometry = new THREE.BoxGeometry(lengthU * 0.9, heightU * 0.08, beamU * 0.8)
      const deck = new THREE.Mesh(deckGeometry, deckMaterial)
      deck.position.y = heightU * 0.5
      shipGroup.add(deck)

      // Masts with square sails (fore, main, mizzen).
      const mastX = [lengthU * 0.28, 0, -lengthU * 0.3]
      const mastScale = [0.8, 1, 0.7]
      mastX.forEach((mx, idx) => {
        const mastHeight = heightU * 2.6 * mastScale[idx]
        const mastGeometry = new THREE.CylinderGeometry(
          beamU * 0.04,
          beamU * 0.05,
          mastHeight,
          8
        )
        const mast = new THREE.Mesh(mastGeometry, mastMaterial)
        mast.position.set(mx, heightU * 0.5 + mastHeight / 2, 0)
        shipGroup.add(mast)

        const sailGeometry = new THREE.PlaneGeometry(
          lengthU * 0.22 * mastScale[idx],
          mastHeight * 0.6
        )
        const sail = new THREE.Mesh(sailGeometry, sailMaterial)
        sail.position.set(mx, heightU * 0.5 + mastHeight * 0.6, 0)
        sail.rotation.y = Math.PI / 2
        shipGroup.add(sail)
      })

      const plankLength = lengthU * 0.38
      const plankThickness = heightU * 0.08
      const plankWidth = beamU * 0.19
      const boardingPlank = new THREE.Mesh(
        new THREE.BoxGeometry(plankLength, plankThickness, plankWidth),
        plankMaterial
      )
      boardingPlank.name = 'boardingPlank'
      boardingPlank.visible = false
      shipGroup.add(boardingPlank)

      globe.add(shipGroup)

      const updateShipPosition = () => {
        const state = getShipPosition()
        const pos = latLngToVector3(state.latitude, state.longitude, GLOBE_RADIUS)
        const lookAhead = latLngToVector3(state.aheadLatitude, state.aheadLongitude, GLOBE_RADIUS)
        shipGroup.position.copy(pos)
        orientAlongPath(shipGroup, pos, lookAhead)

        updateBoardingPlank(shipGroup, state)
      }

      updateShipPosition()
    }

    addShip()

    fetch('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json')
      .then(response => response.json())
      .then(topology => {
        const geojson: any = feature(topology, topology.objects.states)
        
        const allowedStates = [
          '01', '02', '04', '05', '06', '08', '09', '10', '11', '12',
          '13', '15', '16', '17', '18', '19', '20', '21', '22', '23',
          '24', '25', '26', '27', '28', '29', '30', '31', '32', '33',
          '34', '35', '36', '37', '38', '39', '40', '41', '42', '44',
          '45', '46', '47', '48', '49', '50', '51', '53', '54', '55', '56'
        ]
        
        geojson.features.forEach((feat: any) => {
          const stateId = String(feat.id).padStart(2, '0')
          if (!allowedStates.includes(stateId)) return

          const processRing = (ring: number[][]) => {
            const points: THREE.Vector3[] = []
            
            ring.forEach((coord: number[]) => {
              const [lon, lat] = coord
              const phi = (90 - lat) * (Math.PI / 180)
              const theta = (lon + 180) * (Math.PI / 180)
              
              const x = -(1.002 * Math.sin(phi) * Math.cos(theta))
              const z = 1.002 * Math.sin(phi) * Math.sin(theta)
              const y = 1.002 * Math.cos(phi)
              
              points.push(new THREE.Vector3(x, y, z))
            })
            
            if (points.length > 1) {
              const outlinePoints: THREE.Vector3[] = [...points, points[0]]
              const lineGeometry = new THREE.BufferGeometry().setFromPoints(outlinePoints)
              const lineMaterial = new THREE.LineBasicMaterial({
                color: 0x00ffff,
                transparent: true,
                opacity: 0.5,
                linewidth: 1
              })
              const line = new THREE.Line(lineGeometry, lineMaterial)
              line.userData.stateId = stateId
              stateOutlinesGroup.add(line)
            }
          }

          if (feat.geometry.type === 'Polygon') {
            feat.geometry.coordinates.forEach(processRing)
          } else if (feat.geometry.type === 'MultiPolygon') {
            feat.geometry.coordinates.forEach((polygon: number[][][]) => {
              polygon.forEach(processRing)
            })
          }
        })
      })
      .catch(err => console.error('Error loading state boundaries:', err))

    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate)

      if (globeRef.current) {
        if (!isDragging.current) {
          if (autoRotate && shouldAutoRotate.current) {
            globeRef.current.rotation.y += autoRotateSpeed
          }
        }

        globeRef.current.rotation.x = Math.max(
          Math.min(globeRef.current.rotation.x, Math.PI / 2),
          -Math.PI / 2
        )
      }

      if (outlineRef.current && globeRef.current) {
        outlineRef.current.rotation.copy(globeRef.current.rotation)
      }

      if (stateOutlinesRef.current && globeRef.current) {
        stateOutlinesRef.current.rotation.copy(globeRef.current.rotation)
      }

      atmosphere.rotation.copy(globe.rotation)

      if (issRef.current) {
        updateISSCalibration()
        const nowMs = serverNow()
        const here = calculateISSPosition(new Date(nowMs))
        const ahead = calculateISSPosition(new Date(nowMs + 4000))
        const orbitalRadius = GLOBE_RADIUS + kmToGlobeUnits(408)
        const pos = latLngToVector3(here.latitude, here.longitude, orbitalRadius)
        const lookAhead = latLngToVector3(ahead.latitude, ahead.longitude, orbitalRadius)
        issRef.current.position.copy(pos)
        orientAlongPath(issRef.current, pos, lookAhead)
      }

      if (planeRef.current) {
        const state = planeFlightPath.getPlanePosition()
        const pos = latLngToVector3(
          state.latitude,
          state.longitude,
          GLOBE_RADIUS + state.altitude
        )
        const lookAhead = latLngToVector3(
          state.aheadLatitude,
          state.aheadLongitude,
          GLOBE_RADIUS + state.aheadAltitude
        )
        planeRef.current.position.copy(pos)
        orientAlongPath(planeRef.current, pos, lookAhead)
      }

      if (shipRef.current) {
        const state = getShipPosition()
        const pos = latLngToVector3(state.latitude, state.longitude, GLOBE_RADIUS)
        const lookAhead = latLngToVector3(state.aheadLatitude, state.aheadLongitude, GLOBE_RADIUS)
        shipRef.current.position.copy(pos)
        orientAlongPath(shipRef.current, pos, lookAhead)
        updateBoardingPlank(shipRef.current, state)
      }

      updateCrudeOilLayer(serverNow(), camera)

      if (globeRef.current && onCameraChange) {
        const lat = -(globeRef.current.rotation.x * (180 / Math.PI))
        const lng = (globeRef.current.rotation.y * (180 / Math.PI)) % 360
        onCameraChange({ lat, lng })
      }

      renderer.render(scene, camera)
    }
    animate()

    const handleMouseDown = (e: MouseEvent | TouchEvent) => {
      isDragging.current = true
      lastInteractionTime.current = Date.now()
      shouldAutoRotate.current = false
      velocity.current = { x: 0, y: 0 }
      dragStartTime.current = Date.now()
      dragDistance.current = 0
      
      if (!hasInteracted.current) {
        hasInteracted.current = true
        onInteraction?.()
      }
      
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
      
      previousMousePosition.current = { x: clientX, y: clientY }
    }

    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging.current || !globeRef.current) return

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

      const deltaX = clientX - previousMousePosition.current.x
      const deltaY = clientY - previousMousePosition.current.y

      dragDistance.current += Math.sqrt(deltaX * deltaX + deltaY * deltaY)

      velocity.current.x = deltaX * 0.002
      velocity.current.y = deltaY * 0.002

      globeRef.current.rotation.y += velocity.current.x
      globeRef.current.rotation.x += velocity.current.y

      previousMousePosition.current = { x: clientX, y: clientY }
      lastInteractionTime.current = Date.now()
    }

    const handleMouseUp = () => {
      if (isDragging.current) {
        const dragDuration = Date.now() - dragStartTime.current
        const speed = Math.sqrt(
          velocity.current.x * velocity.current.x + 
          velocity.current.y * velocity.current.y
        )
        
        const isFlick =
          dragDuration < FLICK_MAX_DURATION_MS &&
          speed > FLICK_MIN_SPEED &&
          dragDistance.current > FLICK_MIN_DISTANCE_PX
        
        if (isFlick) {
          shouldAutoRotate.current = true
        }
      }
      
      isDragging.current = false
      velocity.current = { x: 0, y: 0 }
    }

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      lastInteractionTime.current = Date.now()
      
      if (!hasInteracted.current) {
        hasInteracted.current = true
        onInteraction?.()
      }
      
      const zoomSpeed = 0.001
      const newZ = cameraRef.current!.position.z + e.deltaY * zoomSpeed
      cameraRef.current!.position.z = Math.max(1.3, Math.min(5, newZ))
      
      onZoomChange?.(cameraRef.current!.position.z)
    }

    const handleResize = () => {
      if (!cameraRef.current || !rendererRef.current) return

      cameraRef.current.aspect = window.innerWidth / window.innerHeight
      cameraRef.current.updateProjectionMatrix()
      rendererRef.current.setSize(window.innerWidth, window.innerHeight)
    }

    renderer.domElement.addEventListener('mousedown', handleMouseDown)
    renderer.domElement.addEventListener('mousemove', handleMouseMove)
    renderer.domElement.addEventListener('mouseup', handleMouseUp)
    renderer.domElement.addEventListener('mouseleave', handleMouseUp)
    renderer.domElement.addEventListener('touchstart', handleMouseDown)
    renderer.domElement.addEventListener('touchmove', handleMouseMove)
    renderer.domElement.addEventListener('touchend', handleMouseUp)
    renderer.domElement.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('resize', handleResize)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      
      renderer.domElement.removeEventListener('mousedown', handleMouseDown)
      renderer.domElement.removeEventListener('mousemove', handleMouseMove)
      renderer.domElement.removeEventListener('mouseup', handleMouseUp)
      renderer.domElement.removeEventListener('mouseleave', handleMouseUp)
      renderer.domElement.removeEventListener('touchstart', handleMouseDown)
      renderer.domElement.removeEventListener('touchmove', handleMouseMove)
      renderer.domElement.removeEventListener('touchend', handleMouseUp)
      renderer.domElement.removeEventListener('wheel', handleWheel)
      window.removeEventListener('resize', handleResize)

      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement)
      }
      renderer.dispose()
      geometry.dispose()
      material.dispose()
      atmosphereGeometry.dispose()
      atmosphereMaterial.dispose()
      if (outlineRef.current) {
        const outlineGeometry = outlineRef.current.geometry
        const outlineMaterial = outlineRef.current.material as THREE.Material
        outlineGeometry.dispose()
        outlineMaterial.dispose()
      }
      if (stateOutlinesRef.current) {
        stateOutlinesRef.current.children.forEach(child => {
          if (child instanceof THREE.Line) {
            child.geometry.dispose()
            const lineMaterial = child.material as THREE.Material
            lineMaterial.dispose()
          }
        })
      }
    }
  }, [autoRotate, autoRotateSpeed])

  return (
    <>
      <div ref={containerRef} className="fixed inset-0 cursor-grab active:cursor-grabbing" />
      {loading && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-foreground/60 text-sm tracking-wide">Loading Globe...</p>
          </div>
        </div>
      )}
    </>
  )
}
