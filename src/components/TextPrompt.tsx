import { useState, useEffect } from 'react'
import { useKV, getUser } from '@/lib/spark-shim'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { Card, CardContent } from './ui/card'
import { Lock, LockOpen, Check, MapPin } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { ScrollArea } from './ui/scroll-area'

export interface TextEntry {
  id: string
  text: string
  lat: number
  lng: number
  timestamp: number
  author?: string
}

interface TextPromptProps {
  isOwner: boolean
  cameraPosition?: { lat: number; lng: number }
}

export function TextPrompt({ isOwner, cameraPosition }: TextPromptProps) {
  const [entries, setEntries] = useKV<TextEntry[]>('footstool-entries', [])
  const [localText, setLocalText] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [showAllEntries, setShowAllEntries] = useState(false)

  const handleSave = async () => {
    if (!localText.trim()) {
      toast.error('Please enter some text')
      return
    }

    const user = await getUser()
    const newEntry: TextEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: localText.trim(),
      lat: cameraPosition?.lat || 0,
      lng: cameraPosition?.lng || 0,
      timestamp: Date.now(),
      author: user?.login
    }

    setEntries((currentEntries) => [...(currentEntries || []), newEntry])
    setLocalText('')
    setIsEditing(false)
    toast.success('Message placed on globe')
  }

  const handleEdit = () => {
    if (!isOwner) {
      toast.error('You need write access to leave a message')
      return
    }
    setIsEditing(true)
  }

  const handleDelete = (id: string) => {
    setEntries((currentEntries) => (currentEntries || []).filter(e => e.id !== id))
    toast.success('Message removed')
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-20 pointer-events-auto">
      <Card className="bg-card/90 backdrop-blur-md border-border shadow-xl">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {isOwner ? (
                <LockOpen size={20} className="text-accent" weight="bold" />
              ) : (
                <Lock size={20} className="text-muted-foreground" weight="bold" />
              )}
              <span className="text-sm font-medium text-foreground">
                {isOwner ? 'Write Access' : 'Read Only'}
              </span>
              <span className="text-xs text-muted-foreground ml-2">
                {(entries || []).length} {(entries || []).length === 1 ? 'message' : 'messages'}
              </span>
            </div>
            <div className="flex gap-2">
              {(entries || []).length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowAllEntries(!showAllEntries)}
                  className="text-xs"
                >
                  {showAllEntries ? 'Hide All' : 'View All'}
                </Button>
              )}
              {isOwner && !isEditing && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleEdit}
                  className="text-xs gap-1"
                >
                  <MapPin size={14} weight="bold" />
                  Leave Message
                </Button>
              )}
            </div>
          </div>

          {isEditing ? (
            <div className="space-y-4">
              <div className="text-xs text-muted-foreground mb-2">
                This message will be placed at the current camera position
              </div>
              <Textarea
                id="footstool-text-input"
                value={localText}
                onChange={(e) => setLocalText(e.target.value)}
                placeholder="Enter your message..."
                className="min-h-32 resize-none text-foreground bg-background/50 border-border"
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setLocalText('')
                    setIsEditing(false)
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  className="gap-2"
                >
                  <Check size={16} weight="bold" />
                  Place Message
                </Button>
              </div>
            </div>
          ) : showAllEntries ? (
            <div>
              <ScrollArea className="h-64">
                <div className="space-y-3 pr-4">
                  {(entries || []).length === 0 ? (
                    <p className="text-muted-foreground italic text-sm text-center py-8">
                      {isOwner 
                        ? 'No messages yet. Leave the first one!' 
                        : 'No messages have been placed yet.'}
                    </p>
                  ) : (
                    [...(entries || [])].reverse().map((entry) => (
                      <div 
                        key={entry.id} 
                        className="p-3 rounded-lg bg-background/50 border border-border"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <MapPin size={12} weight="bold" />
                            <span>{entry.lat.toFixed(2)}°, {entry.lng.toFixed(2)}°</span>
                            {entry.author && <span>• {entry.author}</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {formatDate(entry.timestamp)}
                            </span>
                            {isOwner && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(entry.id)}
                                className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                              >
                                ×
                              </Button>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-foreground whitespace-pre-wrap">
                          {entry.text}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          ) : (
            <div className="text-foreground min-h-20">
              {(entries || []).length > 0 && entries ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <MapPin size={12} weight="bold" />
                    <span>Latest message</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {entries[entries.length - 1].text}
                  </p>
                </div>
              ) : (
                <p className="text-muted-foreground italic text-sm">
                  {isOwner 
                    ? 'Leave messages on the globe...' 
                    : 'No messages available yet.'}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
