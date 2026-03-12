import { z } from "zod"

export const GlobalSettingsSchema = z
  .object({
    userName: z
      .string()
      .optional()
      .describe("Nome do usuário/prefixo de workspace"),
    defaultBaseDir: z
      .string()
      .optional()
      .describe("Diretório base padrão para novos workspaces"),
    workspaceRegistryFile: z
      .string()
      .default("~/.saltree/workspaces.json")
      .describe("Caminho do arquivo de registro de workspaces"),
    bareRepo: z
      .object({
        fetchParallel: z
          .number()
          .default(8)
          .describe("Número de threads para fetch paralelo"),
        writeCommitGraph: z
          .boolean()
          .default(true)
          .describe("Escrever commit-graph no fetch para performance"),
        worktreeRelativePaths: z
          .boolean()
          .default(true)
          .describe("Usar caminhos relativos nos worktrees"),
        gcWorktreePruneExpire: z
          .string()
          .default("30.days.ago")
          .describe("Tempo para expirar worktrees órfãs no GC"),
        enableMaintenance: z
          .boolean()
          .default(true)
          .describe("Habilitar manutenção incremental automática"),
      })
      .default({
        fetchParallel: 8,
        writeCommitGraph: true,
        worktreeRelativePaths: true,
        gcWorktreePruneExpire: "30.days.ago",
        enableMaintenance: true,
      })
      .describe("Configurações profissionais para bare repos"),
  })
  .describe("Configurações globais do Saltree")

export type GlobalSettings = z.infer<typeof GlobalSettingsSchema>

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = GlobalSettingsSchema.parse({})

export function validateGlobalSettings(data: unknown): {
  success: boolean
  data?: GlobalSettings
  error?: string
} {
  try {
    const result = GlobalSettingsSchema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.issues
        .map((err: z.ZodIssue) => `${err.path.join(".")}: ${err.message}`)
        .join("; ")
      return { success: false, error: errorMessages }
    }
    return { success: false, error: String(error) }
  }
}
