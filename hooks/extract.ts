// Reads string fields out of a tool call's arguments while they are still
// streaming, so the JSON is usually incomplete: `{"file_path":"a.ts","content":"imp`.

export type Field = { value: string; isComplete: boolean }

const ESCAPES: Record<string, string> = {
  '"': '"',
  '\\': '\\',
  '/': '/',
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
}

// Decodes the JSON string whose opening quote is at `start`. Stops cleanly
// at the end of the input, dropping an escape that is cut in half.
const readString = (raw: string, start: number): Field & { end: number } => {
  let value = ''
  let i = start + 1
  while (i < raw.length) {
    const ch = raw[i]!
    if (ch === '"') return { value, isComplete: true, end: i + 1 }
    if (ch !== '\\') {
      value += ch
      i += 1
      continue
    }
    const esc = raw[i + 1]
    if (esc === undefined) break
    if (esc === 'u') {
      const hex = raw.slice(i + 2, i + 6)
      if (hex.length < 4) break
      value += String.fromCharCode(parseInt(hex, 16))
      i += 6
      continue
    }
    value += ESCAPES[esc] ?? esc
    i += 2
  }

  return { value, isComplete: false, end: raw.length }
}

// Every string value of `key`, at any depth, in order (MultiEdit's
// `edits[].new_string` gives several). The last may be incomplete.
export const extractFields = (raw: string, key: string): Field[] => {
  const found: Field[] = []
  const stack: Array<'{' | '['> = []
  let isKeyNext = false
  let lastKey: string | undefined
  let i = 0
  while (i < raw.length) {
    const ch = raw[i]!
    if (ch === '"') {
      const str = readString(raw, i)
      if (isKeyNext && stack.at(-1) === '{') {
        lastKey = str.value
        isKeyNext = false
      } else if (lastKey === key) {
        found.push({ value: str.value, isComplete: str.isComplete })
      }
      i = str.end
      continue
    }
    if (ch === '{' || ch === '[') {
      stack.push(ch)
      isKeyNext = ch === '{'
    } else if (ch === '}' || ch === ']') {
      stack.pop()
      isKeyNext = false
    } else if (ch === ',') {
      isKeyNext = stack.at(-1) === '{'
    } else if (ch === ':') {
      isKeyNext = false
    }
    i += 1
  }

  return found
}

export const extractField = (raw: string, key: string): Field | undefined =>
  extractFields(raw, key)[0]

// What each tool types, and where its target path lives.
export const TOOL_FIELDS: Record<string, { text: string; path?: string }> = {
  Write: { text: 'content', path: 'file_path' },
  Edit: { text: 'new_string', path: 'file_path' },
  MultiEdit: { text: 'new_string', path: 'file_path' },
  NotebookEdit: { text: 'new_source', path: 'notebook_path' },
  Bash: { text: 'command' },
}

export const EDIT_SEPARATOR = '\n\n⋯\n\n'

// The text a tool call has typed so far, and whether its arguments are done.
export const readToolText = (
  tool: string,
  raw: string,
): { text: string; path?: string } => {
  const spec = TOOL_FIELDS[tool]
  if (spec === undefined) return { text: '' }
  const parts = extractFields(raw, spec.text).map(f => f.value)
  const path = spec.path === undefined ? undefined : extractField(raw, spec.path)

  return {
    text: parts.join(EDIT_SEPARATOR),
    path: path?.isComplete ? path.value : undefined,
  }
}
