'use client'

import { Button } from '@/components/ui/button'
import {
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize,
  Settings,
} from 'lucide-react'

interface ViewerControlsProps {
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
  onFullscreen: () => void
  onSettings: () => void
}

export function ViewerControls({
  onZoomIn,
  onZoomOut,
  onReset,
  onFullscreen,
  onSettings,
}: ViewerControlsProps) {
  return (
    <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-10">
      <Button
        variant="secondary"
        size="icon"
        onClick={onZoomIn}
        title="Zoom in"
        className="h-9 w-9 bg-white shadow-md hover:bg-gray-100"
      >
        <ZoomIn className="h-4 w-4" />
      </Button>
      <Button
        variant="secondary"
        size="icon"
        onClick={onZoomOut}
        title="Zoom out"
        className="h-9 w-9 bg-white shadow-md hover:bg-gray-100"
      >
        <ZoomOut className="h-4 w-4" />
      </Button>
      <Button
        variant="secondary"
        size="icon"
        onClick={onReset}
        title="Reset view"
        className="h-9 w-9 bg-white shadow-md hover:bg-gray-100"
      >
        <RotateCcw className="h-4 w-4" />
      </Button>
      <Button
        variant="secondary"
        size="icon"
        onClick={onFullscreen}
        title="Fullscreen"
        className="h-9 w-9 bg-white shadow-md hover:bg-gray-100"
      >
        <Maximize className="h-4 w-4" />
      </Button>
      <Button
        variant="secondary"
        size="icon"
        onClick={onSettings}
        title="Settings"
        className="h-9 w-9 bg-white shadow-md hover:bg-gray-100"
      >
        <Settings className="h-4 w-4" />
      </Button>
    </div>
  )
}
