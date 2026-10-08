import { expect, test } from 'claude-code/testing'

import { advance, charCost, DEFAULT_PACE, measuredWpm } from '../hooks/typist'

const half = () => 0.5
const TEXT = 'const answer = 42;\nconsole.log(answer);\n'.repeat(10)

const run = (text: string, ms: number, isStreamDone: boolean, wpm = 110) => {
  let p = { shown: 0, carry: 0 }
  for (let t = 0; t < ms; t += 50) {
    p = advance(text, p, 50, isStreamDone, { ...DEFAULT_PACE, wpm }, half)
  }
  return p.shown
}

test('types at roughly the given speed', async () => {
  // 110 WPM is about 9 keystrokes a second.
  const shown = run(TEXT, 1000, false)
  expect(shown).toBeGreaterThan(4)
  expect(shown).toBeLessThan(14)
})

test('never types past what has arrived', async () => {
  expect(run('abc', 10_000, false)).toBe(3)
})

test('finishes within the window once the stream is done', async () => {
  expect(run(TEXT, DEFAULT_PACE.finishWithinMs + 100, true)).toBe(TEXT.length)
})

test('speeds up when far behind the model', async () => {
  const long = 'x'.repeat(DEFAULT_PACE.maxLagChars * 4)
  expect(run(long, 1000, false)).toBeGreaterThan(run(TEXT, 1000, false) * 2)
})

test('indentation costs almost nothing, newlines cost more', async () => {
  expect(charCost(' ', '\n', 0.5)).toBeLessThan(0.1)
  expect(charCost('\n', 'x', 0.5)).toBeGreaterThan(charCost('a', 'x', 0.5))
})

test('measures words per minute', async () => {
  expect(measuredWpm(500, 60_000)).toBe(100)
  expect(measuredWpm(10, 0)).toBe(0)
})
