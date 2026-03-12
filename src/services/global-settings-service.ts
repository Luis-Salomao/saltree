import { access, mkdir, readFile, writeFile } from "node:fs/promises"
import { GLOBAL_CONFIG_DIR } from "../constants/index"
import {
  DEFAULT_GLOBAL_SETTINGS,
  GlobalSettingsSchema,
  validateGlobalSettings,
  type GlobalSettings,
} from "../schemas/global-settings-schema.js"

const SETTINGS_FILE = `${GLOBAL_CONFIG_DIR}/settings.json`

export class GlobalSettingsService {
  private settings: GlobalSettings

  constructor() {
    this.settings = { ...DEFAULT_GLOBAL_SETTINGS }
  }

  async load(): Promise<GlobalSettings> {
    try {
      await access(SETTINGS_FILE)
      const content = await readFile(SETTINGS_FILE, "utf-8")
      const parsed = JSON.parse(content)
      const result = GlobalSettingsSchema.safeParse(parsed)
      if (result.success) {
        this.settings = result.data
      }
    } catch {
      // Arquivo não existe ainda, usar defaults
    }
    return this.settings
  }

  async save(): Promise<void> {
    await mkdir(GLOBAL_CONFIG_DIR, { recursive: true })
    await writeFile(SETTINGS_FILE, JSON.stringify(this.settings, null, 2), "utf-8")
  }

  getSettings(): GlobalSettings {
    return { ...this.settings }
  }

  update(updates: Partial<GlobalSettings>): GlobalSettings {
    this.settings = { ...this.settings, ...updates }
    return this.getSettings()
  }

  getUserName(): string | undefined {
    return this.settings.userName
  }

  setUserName(userName: string): void {
    this.settings.userName = userName
  }

  getDefaultBaseDir(): string | undefined {
    return this.settings.defaultBaseDir
  }

  needsOnboarding(): boolean {
    return !this.settings.userName
  }
}
