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

test('types out a Write call streamed by the model', async ($, on) => {
  const clock = mock.clock(on)
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

  const stream = $.turn.step({ turnId: 't', index: 0, model: 'm', messageCount: 1 })
  const seen: string[] = []
  for await (const chunk of stream) seen.push(chunk.kind)
  // Every chunk is passed on untouched.
  expect(seen[0]).toBe('tool')
  expect(seen.at(-1)).toBe('stop')

  await clock.advance(5000)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: '/src/hello.ts' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /done · \d+ WPM · 100%/ })).toBeDefined()
    await ui.unmount()
  }
})
