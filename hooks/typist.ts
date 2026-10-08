// Pacing: how many characters a human-ish typist gets through in `dtMs`.
// Pure, so tests drive it with a fixed random source.

export type Pace = {
  wpm: number
  // How far behind the model the typist may fall before speeding up.
  maxLagChars: number
  // Once the model has finished the call, the rest is typed within this.
  finishWithinMs: number
}

export const DEFAULT_PACE: Pace = { wpm: 110, maxLagChars: 600, finishWithinMs: 8000 }

// Cost of one character, in units of a plain keystroke.
export const charCost = (ch: string, prev: string | undefined, rand: number): number => {
  const jitter = 0.6 + rand * 0.8
  // Auto-indent: leading whitespace after a newline costs almost nothing.
  if ((ch === ' ' || ch === '\t') && (prev === '\n' || prev === ' ' || prev === '\t')) {
    return 0.08
  }
  if (ch === '\n') return 3.5 * jitter
  if (';{}()'.includes(ch)) return 1.8 * jitter
  if (ch === ' ') return 1.3 * jitter

  return jitter
}

export type Progress = {
  shown: number
  // Keystroke budget carried over between ticks.
  carry: number
  // Time spent typing since the model finished the call.
  sinceDoneMs?: number
}

export const advance = (
  text: string,
  progress: Progress,
  dtMs: number,
  isStreamDone: boolean,
  pace: Pace,
  random: () => number,
): Progress => {
  const left = text.length - progress.shown
  if (left <= 0) return { shown: text.length, carry: 0 }

  const keysPerMs = (pace.wpm * 5) / 60_000
  const speedUp = Math.max(1, left / pace.maxLagChars)
  let budget = progress.carry + dtMs * keysPerMs * speedUp
  let shown = progress.shown
  while (shown < text.length) {
    const cost = charCost(text[shown]!, text[shown - 1], random())
    if (cost > budget) break
    budget -= cost
    shown += 1
  }

  // Once the call is complete, spread what is left over the time remaining
  // in the window, so it ends on time whatever the speed.
  const sinceDoneMs = isStreamDone ? (progress.sinceDoneMs ?? 0) + dtMs : undefined
  if (sinceDoneMs !== undefined) {
    const remainingMs = Math.max(dtMs, pace.finishWithinMs - sinceDoneMs + dtMs)
    shown = Math.max(shown, progress.shown + Math.ceil((left * dtMs) / remainingMs))
  }
  shown = Math.min(shown, text.length)

  return { shown, carry: shown === text.length ? 0 : budget, sinceDoneMs }
}

// Words per minute actually reached, for the footer.
export const measuredWpm = (chars: number, ms: number): number =>
  ms <= 0 ? 0 : Math.round(chars / 5 / (ms / 60_000))

// Hacker Typer mode: each key the person presses reveals a few characters,
// and indentation after a newline comes along for free.
export const revealForKeys = (
  text: string,
  shown: number,
  presses: number,
  random: () => number,
): number => {
  let next = shown
  for (let i = 0; i < presses && next < text.length; i += 1) {
    next += 3 + Math.floor(random() * 3)
    if (text[next - 1] === '\n') {
      while (next < text.length && /[ \t]/.test(text[next]!)) next += 1
    }
  }

  return Math.min(next, text.length)
}
