import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { GhostJob, GhostSettings } from '../types'
import { readToolText, TOOL_FIELDS } from './extract'
import { advance, DEFAULT_PACE, measuredWpm } from './typist'
import type { Progress } from './typist'

const PANE = 'ghost-typist'
const TICK_MS = 50
const SOUNDS = ['clicky', 'thock', 'off'] as const
type Sound = (typeof SOUNDS)[number]

const jobAtom = atom({ plugin: 'ghost-typist', key: 'job' } as const, null)
const queuedAtom = atom({ plugin: 'ghost-typist', key: 'queued' } as const, 0)
const settingsAtom = atom({ plugin: 'ghost-typist', key: 'settings' } as const, {
  isEnabled: true,
})

// A tool call being typed out. `raw` is its arguments' JSON as it streams in.
type Pending = {
  id: string
  tool: string
  raw: string
  parsedLength: number
  text: string
  path?: string
  isStreamDone: boolean
  progress: Progress
  typingMs: number
}

const basename = (path: string) => path.split('/').at(-1) ?? path

type Defaults = { wpm: number; sound: Sound; tools: Set<string>; autoOpen: boolean }

let defaults: Defaults = {
  wpm: DEFAULT_PACE.wpm,
  sound: 'clicky',
  tools: new Set(Object.keys(TOOL_FIELDS)),
  autoOpen: true,
}
const queue: Pending[] = []
let ticker: Timer | undefined
let isTicking = false
let sound: AbortController | undefined
let hasOpened = false

const settingsOf = (s: GhostSettings) => ({
  isEnabled: s.isEnabled,
  wpm: s.wpm ?? defaults.wpm,
  sound: s.sound ?? defaults.sound,
})

function setSound($: EngineInterface, isTyping: boolean, kind: Sound) {
  if (isTyping && sound === undefined && kind !== 'off') {
    sound = new AbortController()
    $.audio
      .play({ asset: `sounds/${kind}.wav` }, { shouldLoop: true, gain: 0.5, signal: sound.signal })
      .catch(() => undefined)
  } else if (!isTyping && sound !== undefined) {
    sound.abort()
    sound = undefined
  }
}

function stop($: EngineInterface) {
  ticker?.cancel()
  ticker = undefined
  setSound($, false, 'off')
  $.ui.status(undefined)
}

async function tick($: EngineInterface) {
  const job = queue[0]
  if (job === undefined) return stop($)

  if (job.raw.length !== job.parsedLength) {
    const read = readToolText(job.tool, job.raw)
    job.text = job.tool === 'Bash' ? `$ ${read.text}` : read.text
    job.path = read.path ?? job.path
    job.parsedLength = job.raw.length
  }

  const settings = settingsOf(await read($, settingsAtom))
  // A call waiting behind this one makes it finish sooner.
  const pace = {
    ...DEFAULT_PACE,
    wpm: settings.wpm,
    finishWithinMs: queue.length > 1 ? 500 : DEFAULT_PACE.finishWithinMs,
  }
  const before = job.progress.shown
  job.progress = advance(job.text, job.progress, TICK_MS, job.isStreamDone, pace, Math.random)
  if (job.progress.shown > before) job.typingMs += TICK_MS

  const isFinished = job.isStreamDone && job.progress.shown >= job.text.length
  setSound($, !isFinished && job.progress.shown < job.text.length, settings.sound)
  $.ui.status(isFinished ? undefined : `⌨ typing ${job.path ? basename(job.path) : job.tool}`)

  const snapshot: GhostJob = {
    id: job.id,
    tool: job.tool,
    path: job.path,
    text: job.text.slice(0, job.progress.shown),
    total: job.text.length,
    isStreamDone: job.isStreamDone,
    wpm: measuredWpm(job.progress.shown, job.typingMs),
  }
  await update($, jobAtom, () => snapshot)
  await update($, queuedAtom, () => Math.max(0, queue.length - 1))

  // The last finished job stays on screen until the next one starts.
  if (isFinished) {
    queue.shift()
    if (queue.length === 0) stop($)
  }
}

function ensureTicker($: EngineInterface) {
  if (ticker !== undefined) return
  ticker = $.clock.every(TICK_MS, () => {
    if (isTicking) return
    isTicking = true
    tick($)
      .catch(() => undefined)
      .finally(() => {
        isTicking = false
      })
  })
}


export const register: Register = (on, options) => {
  defaults = {
    wpm: Number(options.wpm ?? DEFAULT_PACE.wpm),
    sound: (SOUNDS.includes(options.sound as Sound) ? options.sound : 'clicky') as Sound,
    tools: new Set(
      String(options.tools ?? Object.keys(TOOL_FIELDS).join(','))
        .split(',')
        .map(t => t.trim())
        .filter(t => t in TOOL_FIELDS),
    ),
    autoOpen: options.autoOpen !== false,
  }

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'typist',
      description: 'Ghost Typist: open the pane, or on | off | speed <wpm> | sound clicky|thock|off',
    })

    return next(e)
  })

  on('command.run', { command: 'typist' }, async ($, e) => {
    const [word = '', value = ''] = e.args.trim().split(/\s+/)
    const current = settingsOf(await read($, settingsAtom))

    if (word === '' || word === 'open') {
      await $.ui.open({ id: PANE, title: 'Ghost Typist' })
      return { text: 'Ghost Typist pane opened.' }
    }
    if (word === 'on' || word === 'off') {
      await update($, settingsAtom, s => ({ ...s, isEnabled: word === 'on' }))
      if (word === 'off') stop($)
      return { text: `Ghost Typist is ${word}.` }
    }
    if (word === 'speed') {
      const wpm = Number(value)
      if (!Number.isFinite(wpm) || wpm < 10 || wpm > 2000) {
        return { text: `Speed must be a number of WPM from 10 to 2000 (now ${current.wpm}).` }
      }
      await update($, settingsAtom, s => ({ ...s, wpm }))
      return { text: `Ghost Typist types at ${wpm} WPM.` }
    }
    if (word === 'sound') {
      if (!SOUNDS.includes(value as Sound)) {
        return { text: `Sound is one of ${SOUNDS.join(', ')} (now ${current.sound}).` }
      }
      await update($, settingsAtom, s => ({ ...s, sound: value as Sound }))
      if (value === 'off') setSound($, false, 'off')
      return { text: `Ghost Typist sound: ${value}.` }
    }

    return {
      text: `Ghost Typist is ${current.isEnabled ? 'on' : 'off'} · ${current.wpm} WPM · sound ${current.sound}. Usage: /typist [open | on | off | speed <wpm> | sound clicky|thock|off]`,
    }
  })

  // Watches the model's stream and copies tool arguments into the queue.
  // Every chunk is passed on unchanged.
  on('turn.step', async function* ($, e, next) {
    const stream = next(e)
    const settings = await read($, settingsAtom)
    if (!settings.isEnabled || e.agentId !== undefined) return yield* stream

    const byIndex = new Map<number, Pending>()
    const finishAll = () => {
      for (const job of byIndex.values()) job.isStreamDone = true
    }
    try {
      for await (const chunk of stream) {
        if (chunk.kind === 'tool') {
          finishAll()
          if (defaults.tools.has(chunk.name)) {
            const job: Pending = {
              id: chunk.id,
              tool: chunk.name,
              raw: '',
              parsedLength: -1,
              text: '',
              isStreamDone: false,
              progress: { shown: 0, carry: 0 },
              typingMs: 0,
            }
            byIndex.set(chunk.index, job)
            queue.push(job)
            if (defaults.autoOpen && !hasOpened) {
              hasOpened = true
              void $.ui.open({ id: PANE, title: 'Ghost Typist' })
            }
            ensureTicker($)
          }
        } else if (chunk.kind === 'input') {
          const job = byIndex.get(chunk.index)
          if (job !== undefined) job.raw += chunk.json
        }
        yield chunk
      }
    } finally {
      finishAll()
    }

    return await stream.result
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Code } = $.ui.resolve(e)
    const job = await read($, jobAtom)
    const queued = await read($, queuedAtom)

    if (job === null) {
      return (
        <Box flexDirection="column">
          <Text bold>Ghost Typist</Text>
          <Text dimColor>Waiting for the agent to write some code…</Text>
        </Box>
      )
    }

    const columns = Math.max(20, e.props.bodyColumns - 6)
    const room = Math.max(3, e.props.scroll.bodyRows - 4)
    const isTyping = !job.isStreamDone || job.text.length < job.total
    // Keep the cursor in view: the tail of the text that fits, counting wrapped rows.
    const lines = job.text.split('\n')
    let used = 0
    let first = lines.length
    while (first > 0) {
      const rows = Math.max(1, Math.ceil(lines[first - 1]!.length / columns))
      if (used + rows > room) break
      used += rows
      first -= 1
    }
    const source = lines.slice(first).join('\n') + (isTyping ? '▌' : '')
    const pct = job.total === 0 ? 0 : Math.round((job.text.length / job.total) * 100)

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" gap={1}>
          <Text bold color="claude">
            {job.tool}
          </Text>
          <Text>{job.path ?? ''}</Text>
        </Box>
        <Code
          source={source}
          path={job.path}
          language={job.tool === 'Bash' ? 'bash' : undefined}
          startLine={job.path !== undefined && job.tool === 'Write' ? first + 1 : undefined}
        />
        <Text dimColor>
          {isTyping ? 'typing' : 'done'} · {job.wpm} WPM · {pct}%
          {queued > 0 ? ` · ${queued} queued` : ''}
        </Text>
      </Box>
    )
  })
}
