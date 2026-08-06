# Planning Guide

Footstool is an interactive 3D globe visualization landing page that serves as a spatial interface for exploring global data, locations, or connections mapped with precision and intent.

"A MMOSPA (Massively Multiplayer Online Single-Page Application) featuring an interactive 3D globe visualization as the centerpiece, perfectly mapped with world geography as envisioned by the developer. Built to be a combinatorically calculated resource to pain index mapper inspired by previous data-table work that mapped cobalt to the US GDP turned MMO."

**Experience Qualities**:
1. **Immersive** - Users should feel transported into a spatial experience where the globe becomes the primary navigation and exploration interface
2. **Precise** - Every point, connection, and interaction should feel accurately mapped and intentional, reflecting real-world geography with technical accuracy
3. **Fluid** - The globe should respond smoothly to user interactions with natural physics and seamless transitions

**Complexity Level**: Light Application (multiple features with basic state)
This is a landing page centered around an interactive 3D globe with navigation controls and potential data visualization overlays. While visually sophisticated, the interaction model remains focused on exploration and display.

## Essential Features

### Interactive 3D Globe
- **Functionality**: Renders a photorealistic 3D Earth that users can rotate, zoom, and explore
- **Purpose**: Serves as the primary visual element and navigation interface for the application
- **Trigger**: Loads immediately on page load
- **Progression**: Page loads → Globe renders with initial view → User drags to rotate → Globe smoothly responds with physics-based momentum → User scrolls to zoom → Camera adjusts with smooth easing
- **Success criteria**: Globe renders within 2 seconds, responds to mouse/touch input with <50ms latency, maintains 60fps during interaction

### Camera Controls
- **Functionality**: Mouse drag to rotate, scroll to zoom, smooth auto-rotation when idle
- **Purpose**: Provides intuitive exploration of the globe surface
- **Trigger**: Mouse down/touch start, scroll events
- **Progression**: User interacts → Globe responds immediately → User releases → Momentum continues naturally → After 3s idle → Gentle auto-rotation begins
- **Success criteria**: Controls feel natural and responsive, momentum physics feel realistic

### Real-Time Flight Tracking
- **Functionality**: 3D animated Airbus A350 following the Qantas Melbourne-Toulouse test flight route continuously
- **Purpose**: Demonstrates real-world scale aviation paths and provides synchronized global visualization
- **Trigger**: Loads with globe, updates every frame
- **Progression**: Globe loads → Plane appears at current position in flight path → Plane continuously travels Melbourne ↔ Toulouse → Position synchronized across all users via server time
- **Success criteria**: Plane maintains smooth flight path, orientation matches heading, all users see plane at same position, completes round trip in scaled time (24h24m at 1000x speed for testing)

### ISS Orbital Tracking
- **Functionality**: 3D model of International Space Station in real-time orbital position
- **Purpose**: Shows real-time space position with accurate orbital mechanics
- **Trigger**: Loads with globe, updates continuously
- **Progression**: Globe loads → ISS appears at calculated orbital position → Position updates smoothly every frame → Orbital path matches real-world ISS trajectory
- **Success criteria**: ISS position matches real-time data, movement is smooth and continuous, orbital altitude is accurate

### Landmark Visualization
- **Functionality**: 3D models of pyramids of Giza at scaled real-world location
- **Purpose**: Provides geographic reference points and demonstrates 3D object placement on globe
- **Trigger**: Loads with globe
- **Progression**: Globe loads → Pyramids render at correct coordinates → Pyramids maintain orientation relative to Earth surface
- **Success criteria**: Pyramids appear at correct lat/lng, scaling is consistent and visible

### US State Boundaries
- **Functionality**: Vector outlines of all 50 US states, Alaska, and Hawaii
- **Purpose**: Provides geographic reference and administrative boundary visualization
- **Trigger**: Loads after initial globe render
- **Progression**: Globe renders → State boundary data fetches → Outlines draw on globe surface → Outlines rotate with globe
- **Success criteria**: All 50 states visible with clean outlines, no fragmented artifacts

### Text Entry System
- **Functionality**: Users can submit text entries when fully zoomed out
- **Purpose**: Enables user-generated content and spatial data persistence
- **Trigger**: User zooms out past threshold
- **Progression**: User zooms fully out → Text prompt appears → User enters text → Data saves to persistent storage
- **Success criteria**: Prompt appears at correct zoom level, data persists between sessions

### Responsive Layout
- **Functionality**: Globe adapts to different screen sizes and orientations
- **Purpose**: Ensures optimal viewing experience across devices
- **Trigger**: Window resize, orientation change
- **Progression**: Screen size changes → Canvas resizes → Camera adjusts FOV → Globe scales appropriately
- **Success criteria**: Globe remains centered and properly sized on mobile through desktop

## Edge Case Handling

- **Low Performance Devices**: Reduce globe detail/texture quality, simplify shaders, disable advanced effects
- **WebGL Unavailable**: Display fallback message with static globe image
- **Slow Network**: Show loading progress indicator, load low-res textures first
- **Touch Devices**: Adapt controls for pinch-zoom and two-finger rotation
- **Small Screens**: Adjust camera distance and UI element sizing

## Design Direction

The design should evoke a sense of technological sophistication and cosmic perspective - like viewing Earth from a command center or observatory. It should feel precise, intentional, and slightly futuristic while maintaining approachability.

## Color Selection

The color scheme draws from space observation and cartographic traditions with a modern technical twist.

- **Primary Color**: Deep Space Navy `oklch(0.15 0.02 250)` - Communicates depth, technical precision, and cosmic context
- **Secondary Colors**: 
  - Orbital Silver `oklch(0.85 0.01 240)` - For subtle UI elements and text
  - Ionosphere Teal `oklch(0.65 0.12 200)` - For interactive elements and highlights on the globe
- **Accent Color**: Aurora Green `oklch(0.75 0.15 160)` - For CTAs, active states, and data points that demand attention
- **Foreground/Background Pairings**: 
  - Primary Background (Deep Space Navy `oklch(0.15 0.02 250)`): Orbital Silver text `oklch(0.85 0.01 240)` - Ratio 5.2:1 ✓
  - Secondary Background (Orbital Silver `oklch(0.85 0.01 240)`): Deep Space Navy text `oklch(0.15 0.02 250)` - Ratio 5.2:1 ✓
  - Accent (Aurora Green `oklch(0.75 0.15 160)`): Deep Space Navy text `oklch(0.15 0.02 250)` - Ratio 5.8:1 ✓

## Font Selection

Typefaces should convey technical precision and modern sophistication - like something you'd see in a space agency control room or advanced mapping software.

- **Typographic Hierarchy**: 
  - H1 (App Title): Space Grotesk Bold / 48px / -0.02em letter spacing
  - H2 (Section Headers): Space Grotesk Medium / 32px / -0.01em letter spacing
  - Body (Interface Text): Space Grotesk Regular / 16px / normal letter spacing
  - Small (Labels/Captions): Space Grotesk Regular / 14px / 0.01em letter spacing

## Animations

Animations should feel like precision instruments - smooth, purposeful, and physics-based. The globe's rotation should have realistic momentum and easing. UI elements should slide in with subtle ease-out curves. Hover states should have quick (150ms) transitions. The overall effect should be technical and sophisticated without being distracting.

## Component Selection

- **Components**: 
  - Card (for any data overlays or info panels with backdrop blur)
  - Button (for controls with custom styling to match space theme)
  - Badge (for data points or labels)
  - Tooltip (for location/point information)
  - Scroll Area (if content panels are added)
- **Customizations**: 
  - Custom WebGL canvas component for globe rendering
  - Custom gradient backgrounds using mesh gradients and noise
  - Glassmorphism effects on floating UI panels
- **States**: 
  - Buttons: Subtle glow effect on hover, scale down slightly on active
  - Interactive globe points: Pulse animation, scale up on hover
  - Loading: Orbital spinner or progress ring
- **Icon Selection**: 
  - Globe for location markers
  - MagnifyingGlass for zoom controls
  - ArrowsClockwise for reset view
  - NavigationArrow for compass/orientation
- **Spacing**: 
  - Container padding: p-6 on mobile, p-12 on desktop
  - Element gaps: gap-4 for related items, gap-8 for sections
  - Globe margin: Minimal, allow full viewport presence
- **Mobile**: 
  - Globe scales to full width/height with minimal chrome
  - Controls positioned as floating action buttons in corners
  - Touch-optimized hit targets (min 44px)
  - Single column layout for any informational content
