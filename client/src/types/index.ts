export const DEFAULT_MODEL = 'mimo-v2.5-pro'

export type ThemeMode = 'auto' | 'light' | 'dark'

export type AppCategory = 'all' | 'ai' | 'tool' | 'social' | 'dev' | 'media' | 'other'

export interface AppInfo {
  id: number
  name: string
  description: string
  icon: string
  url: string
  category: Exclude<AppCategory, 'all'>
  created_at?: string
  updated_at?: string
}

export const APP_CATEGORIES: { value: AppCategory; label: string; icon: string }[] = [
  { value: 'all', label: '全部', icon: 'Sparkles' },
  { value: 'ai', label: 'AI', icon: 'Bot' },
  { value: 'tool', label: '工具', icon: 'Wrench' },
  { value: 'social', label: '社交', icon: 'MessageCircle' },
  { value: 'dev', label: '开发', icon: 'Laptop' },
  { value: 'media', label: '媒体', icon: 'Clapperboard' },
  { value: 'other', label: '其他', icon: 'Package' },
]

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  model?: string
  loading?: boolean
  error?: string
}

export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  modelId?: string
  dbId?: number
  pinned?: boolean
  systemPrompt?: string
  createdAt: number
  updatedAt: number
}

export interface ModelInfo {
  id: string
  name: string
  provider: string
  provider_id?: number
  provider_type?: ProviderType
  description?: string
}

export interface AppSettings {
  apiBaseUrl: string
  theme: ThemeMode
  defaultModel: string
  fontSize: number
}

export type TerminalAuthType = 'password' | 'key'
export type TerminalStatus = 'disconnected' | 'reachable' | 'testing' | 'error'

export interface TerminalConnectionInfo {
  id: number
  name: string
  host: string
  port: number
  username: string
  auth_type: TerminalAuthType
  password?: string
  has_password?: boolean
  key_path?: string
  default_path?: string
  status: TerminalStatus
  last_error?: string
  created_at?: string
  updated_at?: string
}

export type ConnectionType = 'hermes' | 'openclaw'
export type ConnectionStatus = 'connected' | 'disconnected' | 'testing' | 'error'

export interface ConnectionInfo {
  id: number
  name: string
  type: ConnectionType
  endpoint: string
  api_key?: string
  apiKey?: string
  status: ConnectionStatus
  config?: string
  error?: string
  lastTested?: string
  created_at?: string
  updated_at?: string
}

export const CONNECTION_TYPES: { value: ConnectionType; label: string; icon: string }[] = [
  { value: 'hermes', label: 'Hermes Agent', icon: 'Zap' },
  { value: 'openclaw', label: 'OpenClaw', icon: 'Workflow' },
]

export type ProviderType = 'openai' | 'anthropic' | 'custom'
export type ProviderStatus = 'connected' | 'disconnected' | 'unchecked' | 'error'

export interface ProviderModel {
  id?: number
  provider_id?: number
  model_id: string
  name: string
  enabled?: number | boolean
  is_image_model?: number | boolean
}

export interface GeneratedImage {
  id: number
  model: string
  prompt: string
  size: string
  url: string
  created_at?: string
}

export interface ProviderInfo {
  id: number
  name: string
  base_url: string
  api_key?: string
  type: ProviderType
  enabled?: number | boolean
  status?: ProviderStatus
  last_tested?: string
  created_at?: string
  updated_at?: string
  models: ProviderModel[]
}

export const PROVIDER_TYPES: { value: ProviderType; label: string; icon: string }[] = [
  { value: 'openai', label: 'OpenAI 兼容', icon: 'Bot' },
  { value: 'anthropic', label: 'Anthropic', icon: 'Sparkles' },
  { value: 'custom', label: '自定义', icon: 'Settings2' },
]

export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
  error?: string
}
