'use client'

import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Loader2,
  Camera,
  Box,
  Circle,
  Layers,
  Waves,
} from 'lucide-react'

interface ViewerToolbarProps {
  currentStyle: 'cartoon' | 'stick' | 'sphere' | 'surface'
  spinning: boolean
  onStyleChange: (style: 'cartoon' | 'stick' | 'sphere' | 'surface') => void
  onZoom: (direction: 'in' | 'out') => void
  onReset: () => void
  onSpin: () => void
  onScreenshot: () => void
}

export function ViewerToolbar({
  currentStyle,
  spinning,
  onStyleChange,
  onZoom,
  onReset,
  onSpin,
  onScreenshot,
}: ViewerToolbarProps) {
  const styles = [
    { id: 'cartoon' as const, icon: Waves, label: 'Cartoon' },
    { id: 'stick' as const, icon: Layers, label: 'Stick' },
    { id: 'sphere' as const, icon: Circle, label: 'Sphere' },
    { id: 'surface' as const, icon: Box, label: 'Surface' },
  ]

  return (
    <div className="flex items-center gap-2 p-2 bg-white border-b">
      {/* Style buttons */}
      <div className="flex items-center gap-1">
        {styles.map((style) => {
          const Icon = style.icon
          return (
            <Button
              key={style.id}
              variant={currentStyle === style.id ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onStyleChange(style.id)}
              title={style.label}
              className="h-8 w-8 p-0"
            >
              <Icon className="h-4 w-4" />
            </Button>
          )
        })}
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Zoom controls */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onZoom('in')}
          title="Zoom in"
          className="h-8 w-8 p-0"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onZoom('out')}
          title="Zoom out"
          className="h-8 w-8 p-0"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          title="Reset view"
          className="h-8 w-8 p-0"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Animation and screenshot */}
      <div className="flex items-center gap-1">
        <Button
          variant={spinning ? 'default' : 'ghost'}
          size="sm"
          onClick={onSpin}
          title={spinning ? 'Stop spinning' : 'Start spinning'}
          className="h-8 w-8 p-0"
        >
          <Loader2 className={`h-4 w-4 ${spinning ? 'animate-spin' : ''}`} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onScreenshot}
          title="Take screenshot"
          className="h-8 w-8 p-0"
        >
          <Camera className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
