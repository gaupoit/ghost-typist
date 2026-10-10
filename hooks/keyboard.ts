// The on-screen keyboard: which key types a character, and which keys to
// light for the characters just typed. Pure, so tests drive it directly.

export type Key = { id: string; label: string }

const keys = (chars: string): Key[] => chars.split('').map(ch => ({ id: ch, label: ch }))

// US QWERTY, top row first. The last row is the space bar.
export const ROWS: Key[][] = [
  [...keys('`1234567890-='), { id: 'backspace', label: '⌫' }],
  [{ id: 'tab', label: '⇥' }, ...keys('qwertyuiop[]\\')],
  [{ id: 'caps', label: '⇪' }, ...keys("asdfghjkl;'"), { id: 'enter', label: '⏎' }],
  [{ id: 'shift', label: '⇧' }, ...keys('zxcvbnm,./'), { id: 'shift', label: '⇧' }],
  [{ id: 'space', label: 'space' }],
]

const PLAIN = new Set(ROWS.flat().map(k => k.id))
const SHIFTED: Record<string, string> = {
  '~': '`', '!': '1', '@': '2', '#': '3', '$': '4', '%': '5', '^': '6', '&': '7', '*': '8',
  '(': '9', ')': '0', '_': '-', '+': '=', '{': '[', '}': ']', '|': '\\', ':': ';', '"': "'",
  '<': ',', '>': '.', '?': '/',
}

// The key that types `ch`, and whether shift is held; undefined for
// characters the keyboard has no key for (emoji, accents).
export const keyFor = (ch: string): { key: string; isShifted: boolean } | undefined => {
  if (ch === '\n') return { key: 'enter', isShifted: false }
  if (ch === '\t') return { key: 'tab', isShifted: false }
  if (ch === ' ') return { key: 'space', isShifted: false }
  if (/^[A-Z]$/.test(ch)) return { key: ch.toLowerCase(), isShifted: true }
  if (ch in SHIFTED) return { key: SHIFTED[ch]!, isShifted: true }
  if (PLAIN.has(ch)) return { key: ch, isShifted: false }

  return undefined
}

// Keys to light for text[from, to): the last `max` characters typed, skipping
// indentation the editor would have put in (it costs no keystroke).
export const litKeys = (text: string, from: number, to: number, max = 2): string[] => {
  const lit = new Set<string>()
  let count = 0
  for (let i = to - 1; i >= Math.max(0, from) && count < max; i -= 1) {
    const ch = text[i]!
    const prev = text[i - 1]
    if ((ch === ' ' || ch === '\t') && (prev === '\n' || prev === ' ' || prev === '\t')) continue
    const hit = keyFor(ch)
    if (hit === undefined) continue
    lit.add(hit.key)
    if (hit.isShifted) lit.add('shift')
    count += 1
  }

  return [...lit]
}
