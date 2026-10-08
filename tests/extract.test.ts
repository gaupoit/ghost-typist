import { expect, test } from 'claude-code/testing'

import { EDIT_SEPARATOR, extractField, extractFields, readToolText } from '../hooks/extract'

test('reads a complete field', async () => {
  const raw = '{"file_path":"/a/b.ts","content":"const x = 1;\\n"}'
  expect(extractField(raw, 'content')).toEqual({ value: 'const x = 1;\n', isComplete: true })
  expect(extractField(raw, 'file_path')?.value).toBe('/a/b.ts')
})

test('reads a field cut off mid-stream', async () => {
  expect(extractField('{"file_path":"a.ts","content":"imp', 'content')).toEqual({
    value: 'imp',
    isComplete: false,
  })
  expect(extractField('{"file_path":"a.t', 'file_path')?.isComplete).toBe(false)
  expect(extractField('{"file_path":"a.ts","con', 'content')).toBeUndefined()
})

test('drops an escape cut in half', async () => {
  expect(extractField('{"content":"a\\', 'content')?.value).toBe('a')
  expect(extractField('{"content":"a\\u00', 'content')?.value).toBe('a')
  expect(extractField('{"content":"a\\u00e9b"}', 'content')?.value).toBe('aéb')
})

test('decodes every escape and surrogate pair', async () => {
  const raw = '{"content":"\\"q\\" \\\\ \\/ \\t \\ud83d\\ude00"}'
  expect(extractField(raw, 'content')?.value).toBe('"q" \\ / \t 😀')
})

test('does not mistake a value for a key', async () => {
  const raw = '{"description":"content","content":"real"}'
  expect(extractFields(raw, 'content').map(f => f.value)).toEqual(['real'])
})

test('collects every MultiEdit new_string', async () => {
  const raw =
    '{"file_path":"x.ts","edits":[{"old_string":"a","new_string":"b"},{"old_string":"c","new_string":"d'
  expect(readToolText('MultiEdit', raw)).toEqual({
    text: `b${EDIT_SEPARATOR}d`,
    path: 'x.ts',
  })
})

test('Bash types the command, unknown tools type nothing', async () => {
  expect(readToolText('Bash', '{"command":"ls -la","description":"list"}').text).toBe('ls -la')
  expect(readToolText('Read', '{"file_path":"x"}').text).toBe('')
})

test('arrives the same in any number of chunks', async () => {
  const raw = '{"file_path":"/x.py","content":"def f():\\n    return \\"ok\\"\\n"}'
  for (let cut = 0; cut <= raw.length; cut += 1) {
    const partial = extractField(raw.slice(0, cut), 'content')?.value ?? ''
    expect('def f():\n    return "ok"\n'.startsWith(partial)).toBe(true)
  }
})
