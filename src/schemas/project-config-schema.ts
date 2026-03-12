import { z } from "zod"

export const ProjectBootstrapSchema = z
  .object({
    createFolders: z
      .array(z.string())
      .default([])
      .describe("Pastas a criar no novo workspace (ex: env, scripts, docs)"),
    copyPatterns: z
      .array(z.string())
      .default([".env*", ".vscode/**"])
      .describe("Padrões glob de arquivos para copiar para novos worktrees"),
    copyIgnores: z
      .array(z.string())
      .default(["**/node_modules/**", "**/.git/**", "**/dist/**"])
      .describe("Padrões glob de arquivos para ignorar na cópia"),
    postCreateCmd: z
      .array(z.string())
      .default([])
      .describe("Comandos para rodar após criar worktree (ex: bun install)"),
  })
  .default({
    createFolders: [],
    copyPatterns: [".env*", ".vscode/**"],
    copyIgnores: ["**/node_modules/**", "**/.git/**", "**/dist/**"],
    postCreateCmd: [],
  })

export const BranchPathSchema = z
  .object({
    enabled: z
      .boolean()
      .default(true)
      .describe("Habilitar sanitização automática de branch para path"),
    prefix: z
      .string()
      .default("")
      .describe("Prefixo para nomes de diretório (ex: sal-)"),
    sanitizeForFs: z
      .boolean()
      .default(true)
      .describe("Sanitizar caracteres inválidos do Windows no path"),
    replacement: z
      .string()
      .default("-")
      .describe("Caractere para substituir / e \\ no nome da pasta"),
  })
  .default({
    enabled: true,
    prefix: "",
    sanitizeForFs: true,
    replacement: "-",
  })

export const ProjectConfigSchema = z
  .object({
    $schema: z.string().optional(),
    projectBootstrap: ProjectBootstrapSchema,
    branchPath: BranchPathSchema,
  })
  .describe("Configuração local por projeto (saltree.config.json)")

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>
export type ProjectBootstrap = z.infer<typeof ProjectBootstrapSchema>
export type BranchPathConfig = z.infer<typeof BranchPathSchema>

export const DEFAULT_PROJECT_CONFIG: ProjectConfig = ProjectConfigSchema.parse({})
