export type GhostJob = {
  id: string
  tool: string
  path?: string
  // The part typed out so far.
  text: string
  // Characters received from the model so far.
  total: number
  isStreamDone: boolean
  wpm: number
  // Keys lit on the on-screen keyboard (ids from ROWS).
  keys: string[]
}

export type GhostSettings = {
  isEnabled: boolean
  wpm?: number
  sound?: 'clicky' | 'thock' | 'off'
  mode?: 'watch' | 'hacker'
  keyboard?: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'ghost-typist': {
      job: GhostJob | null
      queued: number
      settings: GhostSettings
    }
  }
}
