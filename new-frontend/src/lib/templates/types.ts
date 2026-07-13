export type TemplateComponent = {
  label: string
  text: string
  required: boolean
  description: string
  examples: string[]
  allow_custom: boolean
}

export type TemplateItem = {
  id: string
  type: string
  category: string
  commodities?: string[]
  modality: string
  communicative_function: string
  representative_example: string
  structural_template: string
  components: Record<string, TemplateComponent>
}

export type TemplatesRoot = {
  version: string
  items: TemplateItem[]
}

export type TemplateEditorState = {
  values: Record<string, string>
  choices: Record<string, string>
  optionals: Record<string, boolean>
}

export type TemplateToken =
  | { type: 'text'; value: string }
  | { type: 'component'; name: string; required: boolean }
  | { type: 'choice'; id: string; options: string[]; required: boolean }
  | { type: 'optional'; id: string; children: TemplateToken[] }

export type CollectedTemplateElements = {
  components: Array<{ name: string; required: boolean }>
  choices: Array<{ id: string; options: string[]; required: boolean }>
  optionals: Array<{ id: string; children: TemplateToken[] }>
}

export type TemplateAdaptation = {
  sentence: string
  template: TemplateItem
  created_new: boolean
}
