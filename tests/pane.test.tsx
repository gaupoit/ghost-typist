import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

const PANE = {
  plugin: 'ghost-typist',
  component: 'Pane',
  requestId: 'ghost-typist',
  props: {
    title: 'Ghost Typist',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

const ARGS = JSON.stringify({ file_path: '/src/hello.ts', content: 'export const hi = () => "hi"\n' })

test('pane waits for code on every surface', async $ => {
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /Waiting for the agent/ })).toBeDefined()
    await ui.unmount()
  }
})

const fakeModel = (on: On) => {
  on('ui.open', async () => ({ value: { isPlaced: true } }))
  on('ui.status', async () => ({ value: undefined }))
  on('audio.play', async () => ({ value: undefined }))
  on('turn.step', async function* () {
    yield { kind: 'tool', index: 0, id: 'toolu_1', name: 'Write' }
    // The arguments arrive in small pieces, as the API streams them.
    for (let i = 0; i < ARGS.length; i += 7) yield { kind: 'input', index: 0, json: ARGS.slice(i, i + 7) }
    yield { kind: 'stop', stopReason: 'tool_use', usage: null }
    return { turnId: 't', index: 0, answer: '', toolUses: [], stopReason: 'tool_use', usage: null }
  })
}

test('types out a Write call streamed by the model', async ($, on) => {
  const clock = mock.clock(on)
  fakeModel(on)
  const stream = $.turn.step({ turnId: 't', index: 0, model: 'm', messageCount: 1 })
  const seen: string[] = []
  for await (const chunk of stream) seen.push(chunk.kind)
  // Every chunk is passed on untouched.
  expect(seen[0]).toBe('tool')
  expect(seen.at(-1)).toBe('stop')

  await clock.advance(10_000)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: '/src/hello.ts' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /done · \d+ WPM · 100%/ })).toBeDefined()
    await ui.unmount()
  }
})

test('hacker mode waits for keys, then types a few characters per key', { options: { mode: 'hacker' } }, async ($, on) => {
  const clock = mock.clock(on)
  fakeModel(on)
  for await (const _ of $.turn.step({ turnId: 't', index: 0, model: 'm', messageCount: 1 })) {
    // drain the stream
  }

  // Time alone types nothing in hacker mode.
  await clock.advance(10_000)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /hacker mode · \d+ WPM · 0%/ })).toBeDefined()

  const typeKey = async (kind: 'change' | 'submit') => {
    await ui.input({ key: 'keys', text: 'x', kind })
  }
  for (let i = 0; i < 3; i += 1) await typeKey('change')
  await clock.advance(100)
  const footer = await ui.find({ type: 'Text', text: /hacker mode · \d+ WPM · \d+%/ })
  const pct = Number(/(\d+)%/.exec(footer?.text ?? '')?.[1])
  // 3 keys at 3 to 5 characters each, of a 29-character file.
  expect(pct).toBeGreaterThanOrEqual(31)
  expect(pct).toBeLessThanOrEqual(52)

  // Enough keys finish the file.
  for (let i = 0; i < 20; i += 1) await typeKey('submit')
  await clock.advance(100)
  expect(await ui.find({ type: 'Text', text: /done · \d+ WPM · 100%/ })).toBeDefined()
  await ui.unmount()
})
