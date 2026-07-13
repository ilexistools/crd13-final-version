import type { CollectedTemplateElements, TemplateEditorState, TemplateItem, TemplateToken } from './types'

type ParseResult = {
  next: number
  tokens: TemplateToken[]
}

export function parseTemplate(structuralTemplate: string): TemplateToken[] {
  const counters = { choice: 0, optional: 0 }
  return parseSegment(structuralTemplate || '', 0, null, counters).tokens
}

function parseSegment(
  source: string,
  startIndex: number,
  end: string | null,
  counters: { choice: number; optional: number },
): ParseResult {
  const tokens: TemplateToken[] = []
  let index = startIndex

  const pushText = (value: string) => {
    if (!value) {
      return
    }

    const previous = tokens[tokens.length - 1]
    if (previous?.type === 'text') {
      previous.value += value
      return
    }

    tokens.push({ type: 'text', value })
  }

  while (index < source.length) {
    const character = source[index]

    if (end && character === end) {
      return { tokens, next: index + 1 }
    }

    if (character === '{') {
      counters.optional += 1
      const optionalId = `opt_${counters.optional}`
      const inner = parseSegment(source, index + 1, '}', counters)
      tokens.push({ type: 'optional', id: optionalId, children: inner.tokens })
      index = inner.next
      continue
    }

    if (character === '<') {
      const closeIndex = source.indexOf('>', index + 1)
      if (closeIndex === -1) {
        pushText(character)
        index += 1
        continue
      }

      const required = index > 0 && source[index - 1] === '*'
      if (required) {
        stripRequiredMarker(tokens)
      }

      tokens.push({
        type: 'component',
        name: source.slice(index + 1, closeIndex).trim(),
        required,
      })
      index = closeIndex + 1
      continue
    }

    if (character === '[') {
      const closeIndex = source.indexOf(']', index + 1)
      if (closeIndex === -1) {
        pushText(character)
        index += 1
        continue
      }

      const required = index > 0 && source[index - 1] === '*'
      if (required) {
        stripRequiredMarker(tokens)
      }

      counters.choice += 1
      tokens.push({
        type: 'choice',
        id: `choice_${counters.choice}`,
        options: source
          .slice(index + 1, closeIndex)
          .split('/')
          .map((option) => option.trim())
          .filter(Boolean),
        required,
      })
      index = closeIndex + 1
      continue
    }

    pushText(character)
    index += 1
  }

  return { tokens, next: index }
}

function stripRequiredMarker(tokens: TemplateToken[]) {
  const previous = tokens[tokens.length - 1]
  if (previous?.type === 'text') {
    previous.value = previous.value.replace(/\*$/, '')
  }
}

export function collectTemplateElements(tokens: TemplateToken[]): CollectedTemplateElements {
  const components = new Map<string, boolean>()
  const choices: CollectedTemplateElements['choices'] = []
  const optionals: CollectedTemplateElements['optionals'] = []

  const walk = (items: TemplateToken[]) => {
    items.forEach((token) => {
      if (token.type === 'component') {
        components.set(token.name, Boolean(components.get(token.name) || token.required))
      }

      if (token.type === 'choice') {
        choices.push({ id: token.id, options: token.options, required: token.required })
      }

      if (token.type === 'optional') {
        optionals.push({ id: token.id, children: token.children })
        walk(token.children)
      }
    })
  }

  walk(tokens)

  return {
    components: [...components.entries()].map(([name, required]) => ({ name, required })),
    choices,
    optionals,
  }
}

export function createInitialTemplateState(template: TemplateItem): TemplateEditorState {
  const tokens = parseTemplate(template.structural_template)
  const collected = collectTemplateElements(tokens)
  const state: TemplateEditorState = { values: {}, choices: {}, optionals: {} }

  collected.optionals.forEach((optional) => {
    state.optionals[optional.id] = false
  })

  collected.choices.forEach((choice) => {
    state.choices[choice.id] = choice.options[0] || ''
  })

  collected.components.forEach((component) => {
    const metadata = Object.values(template.components).find((item) => item.label === component.name)
    state.values[component.name] = metadata?.text || metadata?.examples?.[0] || ''
  })

  return state
}

export function renderTemplate(tokens: TemplateToken[], state: TemplateEditorState) {
  const parts: string[] = []

  const walk = (items: TemplateToken[]) => {
    items.forEach((token) => {
      if (token.type === 'text') {
        parts.push(token.value)
      }

      if (token.type === 'component') {
        const value = state.values[token.name]?.trim()
        if (value) {
          parts.push(value)
        }
      }

      if (token.type === 'choice') {
        const value = state.choices[token.id]?.trim()
        if (value) {
          parts.push(value)
        }
      }

      if (token.type === 'optional' && state.optionals[token.id]) {
        walk(token.children)
      }
    })
  }

  walk(tokens)
  return parts.join('').replace(/\s+/g, ' ').trim()
}

export function renderTemplateItem(template: TemplateItem, state: TemplateEditorState) {
  return renderTemplate(parseTemplate(template.structural_template), state)
}
