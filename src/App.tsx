import { useState, useEffect } from 'react'
import { Globe } from './components/Globe'
import { TextPrompt } from './components/TextPrompt'
import { getUser } from './lib/spark-shim'

function App() {
  const [isInteracted, setIsInteracted] = useState(false)
  const [isZoomedOut, setIsZoomedOut] = useState(false)
  const [isOwner, setIsOwner] = useState(false)
  const [cameraPosition, setCameraPosition] = useState({ lat: 0, lng: 0 })

  useEffect(() => {
    const checkUser = async () => {
      try {
        const user = await getUser()
        if (user) {
          setIsOwner(user.isOwner)
        }
      } catch (error) {
        console.error('Error checking user:', error)
      }
    }
    checkUser()
  }, [])

  const handleClick = () => {
    setIsInteracted(true)
  }

  return (
    <div 
      className="relative w-full h-screen overflow-hidden bg-background"
      onClick={handleClick}
    >
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `
            radial-gradient(circle at 20% 50%, oklch(0.25 0.08 250) 0%, transparent 50%),
            radial-gradient(circle at 80% 30%, oklch(0.25 0.08 200) 0%, transparent 50%),
            radial-gradient(circle at 40% 80%, oklch(0.20 0.06 160) 0%, transparent 50%)
          `
        }}
      />

      <Globe 
        autoRotate={true} 
        autoRotateSpeed={0.0005}
        onInteraction={() => setIsInteracted(true)}
        onZoomChange={(zoomLevel) => setIsZoomedOut(zoomLevel >= 4.9)}
        onCameraChange={setCameraPosition}
      />

      <div 
        className={`fixed bottom-8 left-1/2 -translate-x-1/2 pointer-events-none z-10 transition-opacity duration-500 ${
          isInteracted ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <div className="text-center">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground mb-2">
            Footstool
          </h1>
          <p className="text-sm md:text-base text-muted-foreground tracking-wide">
            by Ghost Face Developer
          </p>
        </div>
      </div>

      {isZoomedOut && (
        <TextPrompt isOwner={isOwner} cameraPosition={cameraPosition} />
      )}
    </div>
  )
}

export default App