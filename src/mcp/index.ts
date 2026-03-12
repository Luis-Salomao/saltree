#!/usr/bin/env node
/**
 * MCP Server para Saltree — gerenciador de workspaces com bare repos.
 *
 * Permite que LLMs operem workspaces Git: listar, criar, deletar worktrees,
 * e gerenciar repositórios bare de forma profissional.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import { BareRepoService } from "../services/bare-repo-service.js"
import { GlobalSettingsService } from "../services/global-settings-service.js"
import { WorkspaceRegistryService } from "../services/workspace-registry-service.js"
import { executeGitCommand } from "../utils/git-commands.js"
import { sanitizeBranchForFs } from "../utils/path-utils.js"
import { join, resolve } from "node:path"

// ─── Server ──────────────────────────────────────────────────

const server = new McpServer({
  name: "saltree-mcp-server",
  version: "1.0.0",
})

// ─── Helpers ─────────────────────────────────────────────────

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] }
}

function jsonResult(data: unknown) {
  return textResult(JSON.stringify(data, null, 2))
}

function errorResult(msg: string) {
  return textResult(`Error: ${msg}`)
}

// ─── Tools ───────────────────────────────────────────────────

// 1. Listar workspaces registrados
server.registerTool(
  "saltree_list_workspaces",
  {
    title: "Listar workspaces saltree",
    description: `Lista todos os workspaces registrados no saltree, com contagem de worktrees.

Returns JSON:
  { workspaces: [{ id, projectName, barePath, basePath, owner, repoType, worktreeCount, active, createdAt }] }

Use quando: precisar ver quais projetos estão configurados com bare repo no saltree.`,
    inputSchema: z.object({
      active_only: z.boolean().default(true).describe("Filtrar apenas workspaces ativos"),
    }).strict(),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async (params) => {
    try {
      const registry = new WorkspaceRegistryService()
      await registry.load()
      const workspaces = await registry.getWorkspacesWithInfo()
      const filtered = params.active_only ? workspaces.filter((w) => w.active) : workspaces
      return jsonResult({ total: filtered.length, workspaces: filtered })
    } catch (error) {
      return errorResult(error instanceof Error ? error.message : String(error))
    }
  }
)

// 2. Criar workspace
server.registerTool(
  "saltree_create_workspace",
  {
    title: "Criar workspace saltree",
    description: `Cria um novo workspace com bare repo. Dois modos:
- "new-local": git init --bare + worktree principal com commit inicial
- "clone-https": git clone --bare + configura fetch refspec + worktree principal

Args:
  - project_name: Nome do projeto (ex: "api-core")
  - mode: "new-local" ou "clone-https"
  - repo_url: URL HTTPS (obrigatório para clone-https)
  - base_dir: Diretório base (opcional, usa padrão global)
  - default_branch: Branch padrão (default: "main")

Returns JSON:
  { success: true, workspace: { id, barePath, basePath, worktreePath } }

Use quando: precisar criar um novo projeto com padrão bare repo.`,
    inputSchema: z.object({
      project_name: z.string().min(1).max(100).describe("Nome do projeto"),
      mode: z.enum(["new-local", "clone-https"]).describe("Modo de criação"),
      repo_url: z.string().optional().describe("URL HTTPS do repositório (obrigatório para clone-https)"),
      base_dir: z.string().optional().describe("Diretório base (usa padrão global se omitido)"),
      default_branch: z.string().default("main").describe("Branch padrão"),
    }).strict(),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  async (params) => {
    try {
      if (params.mode === "clone-https" && !params.repo_url) {
        return errorResult("repo_url é obrigatório para modo clone-https")
      }

      const settings = new GlobalSettingsService()
      await settings.load()
      const userName = settings.getUserName() || "user"
      const configuredBaseDir = params.base_dir || settings.getDefaultBaseDir() || process.cwd()
      const baseDir = resolve(configuredBaseDir)

      const basePath = join(baseDir, userName, params.project_name)
      const barePath = `${basePath}.git`
      const worktreePath = basePath

      const bareService = new BareRepoService()

      if (params.mode === "clone-https") {
        await bareService.cloneBare({
          barePath,
          repoUrl: params.repo_url!,
          defaultBranch: params.default_branch,
        })
        await bareService.addWorktree(barePath, worktreePath, params.default_branch)
      } else {
        await bareService.initBare({ barePath, defaultBranch: params.default_branch })
        await bareService.createInitialWorktree(barePath, worktreePath, params.default_branch)
      }

      const registry = new WorkspaceRegistryService()
      await registry.load()
      const workspace = await registry.addWorkspace({
        owner: userName,
        projectName: params.project_name,
        repoType: params.mode,
        repoUrl: params.mode === "clone-https" ? params.repo_url : undefined,
        barePath,
        basePath,
        defaultBranch: params.default_branch,
        active: true,
      })

      return jsonResult({
        success: true,
        workspace: { id: workspace.id, barePath, basePath, worktreePath },
      })
    } catch (error) {
      return errorResult(error instanceof Error ? error.message : String(error))
    }
  }
)

// 3. Listar worktrees de um workspace
server.registerTool(
  "saltree_list_worktrees",
  {
    title: "Listar worktrees de um workspace",
    description: `Lista todos os worktrees de um bare repo registrado no saltree.

Args:
  - workspace_id: ID do workspace (ex: "ws_20260312_001")

Returns JSON:
  { worktrees: [path1, path2, ...] }

Use quando: precisar ver quais worktrees existem em um workspace.`,
    inputSchema: z.object({
      workspace_id: z.string().describe("ID do workspace"),
    }).strict(),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async (params) => {
    try {
      const registry = new WorkspaceRegistryService()
      await registry.load()
      const workspace = registry.getWorkspaceById(params.workspace_id)
      if (!workspace) return errorResult(`Workspace ${params.workspace_id} não encontrado`)

      const bareService = new BareRepoService()
      const worktrees = await bareService.listWorktrees(workspace.barePath)
      return jsonResult({ workspace_id: params.workspace_id, worktrees })
    } catch (error) {
      return errorResult(error instanceof Error ? error.message : String(error))
    }
  }
)

// 4. Criar worktree em um workspace
server.registerTool(
  "saltree_create_worktree",
  {
    title: "Criar worktree em um workspace",
    description: `Cria um novo worktree a partir do bare repo de um workspace.

Args:
  - workspace_id: ID do workspace
  - branch: Nome da branch (ex: "feat/auth")
  - create_branch: Se true, cria nova branch (default: true)
  - source_branch: Branch de origem para nova branch (default: "main")

O nome da pasta é automaticamente sanitizado (feat/auth → feat-auth).

Returns JSON:
  { success: true, worktree_path: "...", branch: "feat/auth" }

Use quando: precisar criar uma worktree para trabalhar em uma feature/fix.`,
    inputSchema: z.object({
      workspace_id: z.string().describe("ID do workspace"),
      branch: z.string().min(1).describe("Nome da branch (ex: feat/auth)"),
      create_branch: z.boolean().default(true).describe("Criar nova branch"),
      source_branch: z.string().default("main").describe("Branch de origem"),
    }).strict(),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  async (params) => {
    try {
      const registry = new WorkspaceRegistryService()
      await registry.load()
      const workspace = registry.getWorkspaceById(params.workspace_id)
      if (!workspace) return errorResult(`Workspace ${params.workspace_id} não encontrado`)

      const dirName = sanitizeBranchForFs(params.branch)
      const worktreePath = join(workspace.basePath + "-wt", dirName)

      const bareService = new BareRepoService()
      await bareService.addWorktree(workspace.barePath, worktreePath, params.branch, {
        createBranch: params.create_branch,
        sourceBranch: params.source_branch,
      })

      return jsonResult({ success: true, worktree_path: worktreePath, branch: params.branch })
    } catch (error) {
      return errorResult(error instanceof Error ? error.message : String(error))
    }
  }
)

// 5. Deletar worktree
server.registerTool(
  "saltree_delete_worktree",
  {
    title: "Deletar worktree",
    description: `Remove um worktree de um workspace bare repo.

Args:
  - workspace_id: ID do workspace
  - worktree_path: Caminho completo do worktree a remover
  - force: Forçar remoção mesmo com alterações não commitadas (default: false)

Returns JSON:
  { success: true, removed: "..." }

Use quando: precisar limpar um worktree que não é mais necessário.`,
    inputSchema: z.object({
      workspace_id: z.string().describe("ID do workspace"),
      worktree_path: z.string().describe("Caminho completo do worktree"),
      force: z.boolean().default(false).describe("Forçar remoção"),
    }).strict(),
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  async (params) => {
    try {
      const registry = new WorkspaceRegistryService()
      await registry.load()
      const workspace = registry.getWorkspaceById(params.workspace_id)
      if (!workspace) return errorResult(`Workspace ${params.workspace_id} não encontrado`)

      const bareService = new BareRepoService()
      await bareService.removeWorktree(workspace.barePath, params.worktree_path, params.force)

      return jsonResult({ success: true, removed: params.worktree_path })
    } catch (error) {
      return errorResult(error instanceof Error ? error.message : String(error))
    }
  }
)

// 6. Status do workspace (fetch + status)
server.registerTool(
  "saltree_workspace_status",
  {
    title: "Status do workspace",
    description: `Retorna informações sobre um workspace: se o bare repo existe, quantos worktrees tem, e branches disponíveis.

Args:
  - workspace_id: ID do workspace

Returns JSON:
  { id, projectName, barePath, isBareRepo, worktrees, branches }

Use quando: precisar verificar o estado de um workspace antes de operar nele.`,
    inputSchema: z.object({
      workspace_id: z.string().describe("ID do workspace"),
    }).strict(),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async (params) => {
    try {
      const registry = new WorkspaceRegistryService()
      await registry.load()
      const workspace = registry.getWorkspaceById(params.workspace_id)
      if (!workspace) return errorResult(`Workspace ${params.workspace_id} não encontrado`)

      const bareService = new BareRepoService()
      const isBare = await bareService.isBareRepo(workspace.barePath)
      const worktrees = isBare ? await bareService.listWorktrees(workspace.barePath) : []

      let branches: string[] = []
      if (isBare) {
        const result = await executeGitCommand(["branch", "--list"], workspace.barePath)
        if (result.success) {
          branches = result.stdout
            .split("\n")
            .map((l) => l.replace("*", "").trim())
            .filter(Boolean)
        }
      }

      return jsonResult({
        id: workspace.id,
        projectName: workspace.projectName,
        barePath: workspace.barePath,
        isBareRepo: isBare,
        worktrees,
        branches,
      })
    } catch (error) {
      return errorResult(error instanceof Error ? error.message : String(error))
    }
  }
)

// 7. Fetch updates
server.registerTool(
  "saltree_fetch",
  {
    title: "Fetch updates do workspace",
    description: `Roda git fetch --all --prune no bare repo de um workspace.

Args:
  - workspace_id: ID do workspace

Returns JSON:
  { success: true, message: "Fetch concluído" }

Use quando: precisar atualizar o bare repo com as últimas mudanças do remote.`,
    inputSchema: z.object({
      workspace_id: z.string().describe("ID do workspace"),
    }).strict(),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async (params) => {
    try {
      const registry = new WorkspaceRegistryService()
      await registry.load()
      const workspace = registry.getWorkspaceById(params.workspace_id)
      if (!workspace) return errorResult(`Workspace ${params.workspace_id} não encontrado`)

      const bareService = new BareRepoService()
      await bareService.fetchAll(workspace.barePath)

      return jsonResult({ success: true, message: "Fetch concluído" })
    } catch (error) {
      return errorResult(error instanceof Error ? error.message : String(error))
    }
  }
)

// ─── Main ────────────────────────────────────────────────────

async function main(): Promise<void> {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error("Saltree MCP server running via stdio")
}

main().catch((error) => {
  console.error("Server error:", error)
  process.exit(1)
})
