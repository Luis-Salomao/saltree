import { z } from "zod"

export const WorkspaceItemSchema = z.object({
  id: z
    .string()
    .describe("Identificador único do workspace (ex: ws_20260312_001)"),
  owner: z
    .string()
    .describe("Nome do usuário dono do workspace"),
  projectName: z
    .string()
    .describe("Nome do projeto"),
  repoType: z
    .enum(["new-local", "clone-https"])
    .describe("Modo de criação: novo repo local ou clone HTTPS"),
  repoUrl: z
    .string()
    .optional()
    .describe("URL do repositório (apenas para clone-https)"),
  barePath: z
    .string()
    .describe("Caminho do bare repo (.git)"),
  basePath: z
    .string()
    .describe("Caminho base do workspace"),
  defaultBranch: z
    .string()
    .default("main")
    .describe("Branch padrão do workspace"),
  createdAt: z
    .string()
    .describe("Data de criação (ISO 8601)"),
  active: z
    .boolean()
    .default(true)
    .describe("Se o workspace está ativo"),
})

export type WorkspaceItem = z.infer<typeof WorkspaceItemSchema>

export const WorkspaceRegistrySchema = z.object({
  version: z
    .number()
    .default(1)
    .describe("Versão do schema do registro"),
  items: z
    .array(WorkspaceItemSchema)
    .default([])
    .describe("Lista de workspaces registrados"),
})

export type WorkspaceRegistry = z.infer<typeof WorkspaceRegistrySchema>

export const DEFAULT_WORKSPACE_REGISTRY: WorkspaceRegistry = WorkspaceRegistrySchema.parse({})
