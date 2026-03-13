#!/usr/bin/env node
/**
 * MCP Server para Saltree — gerenciador de workspaces Git normais.
 *
 * Permite que LLMs operem workspaces Git: criar workspaces, criar/deletar worktrees,
 * e gerenciar repositórios normais de forma profissional.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import { NormalRepoService } from "../services/normal-repo-service.js"
import { WorkspaceService } from "../services/workspace-service.js"
import { WorktreeService } from "../services/worktree-service.js"
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
    description: `Cria um novo workspace com repo Git normal. Dois modos:
- "new-local": git init + .saltree/ auto-criado + worktree initial + pós-create commands
- "clone-https": git clone + .saltree/ auto-criado + worktree initial + pós-create commands

Args:
  - project_name: Nome do projeto (ex: "api-core")
  - mode: "new-local" ou "clone-https"
  - repo_url: URL HTTPS (obrigatório para clone-https)
  - base_dir: Diretório base (opcional, usa padrão global)
  - default_branch: Branch padrão (default: "main")

Returns JSON:
  { success: true, workspace: { workspaceRoot, projectName, repoType, createdAt } }

Use quando: precisar criar um novo projeto com padrão repo normal.`,
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

      const baseDir = params.base_dir || process.cwd()
      const normalService = new NormalRepoService()

      let workspace
      if (params.mode === "clone-https") {
        workspace = await normalService.cloneNormalRepo({
          projectName: params.project_name,
          mode: "clone-https",
          repoUrl: params.repo_url!,
          baseDir,
          defaultBranch: params.default_branch,
        })
      } else {
        workspace = await normalService.initNormalRepo({
          projectName: params.project_name,
          mode: "new-local",
          baseDir,
          defaultBranch: params.default_branch,
        })
      }

      return jsonResult({
        success: true,
        workspace: {
          workspaceRoot: workspace.workspaceRoot,
          projectName: workspace.projectName,
          repoType: workspace.repoType,
          createdAt: workspace.createdAt,
        },
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
    description: `Lista todos os worktrees de um workspace.

⚠️ IMPORTANTE: Este comando só funciona DENTRO de um workspace (dir com .git/).

Args:
  - workspace_root: Caminho do workspace root (opcional, auto-detecta se omitido)

Returns JSON:
  { worktrees: [path1, path2, ...] }

Use quando: precisar ver quais worktrees existem em um workspace.`,
    inputSchema: z.object({
      workspace_root: z.string().optional().describe("Workspace root (auto-detecta se omitido)"),
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
      // Detect workspace
      const cwd = params.workspace_root || process.cwd()
      const workspaceRoot = await WorkspaceService.getWorkspaceRootOrThrow(cwd)

      const result = await executeGitCommand(["worktree", "list"], workspaceRoot)
      const worktrees: string[] = []
      if (result.success) {
        worktrees.push(...result.stdout.split("\n").filter(Boolean))
      }

      return jsonResult({ workspace_root: workspaceRoot, worktrees })
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
    description: `Cria um novo worktree dentro de um workspace. Permite trabalhar em branches diferentes simultaneamente.

⚠️ IMPORTANTE: Este comando só funciona DENTRO de um workspace (dir com .git/).

Args:
  - branch: Nome da branch (ex: "feat/auth", "bugfix/typo")
  - create_branch: Se true, cria nova branch (default: true)
  - source_branch: Branch de origem para nova branch (default: "main")
  - workspace_root: Caminho do workspace root (opcional, auto-detecta se omitido)

O nome da pasta é automaticamente sanitizado (feat/auth → feat-auth).

Returns JSON:
  { success: true, worktree_path: "...", branch: "feat/auth" }

Use quando: precisar criar uma worktree para trabalhar em uma feature/fix dentro de um workspace.`,
    inputSchema: z.object({
      branch: z.string().min(1).describe("Nome da branch (ex: feat/auth)"),
      create_branch: z.boolean().default(true).describe("Criar nova branch"),
      source_branch: z.string().default("main").describe("Branch de origem"),
      workspace_root: z.string().optional().describe("Workspace root (auto-detecta se omitido)"),
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
      // Detect workspace (auto or from param)
      const cwd = params.workspace_root || process.cwd()
      const workspaceRoot = await WorkspaceService.getWorkspaceRootOrThrow(cwd)

      // Create worktree using WorktreeService
      const worktreeService = new WorktreeService(workspaceRoot)
      await worktreeService.initialize()

      const dirName = sanitizeBranchForFs(params.branch)
      await worktreeService.createWorktree({
        name: dirName,
        newBranch: params.branch,
        sourceBranch: params.source_branch,
        basePath: workspaceRoot,
      })

      const worktreePath = join(workspaceRoot, dirName)
      return jsonResult({
        success: true,
        worktree_path: worktreePath,
        branch: params.branch,
      })
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
    description: `Remove um worktree de um workspace.

⚠️ IMPORTANTE: Este comando só funciona DENTRO de um workspace (dir com .git/).

Args:
  - worktree_name: Nome da pasta da worktree (ex: "feat-auth") ou caminho completo
  - force: Forçar remoção mesmo com alterações não commitadas (default: false)
  - workspace_root: Caminho do workspace root (opcional, auto-detecta se omitido)

Returns JSON:
  { success: true, removed: "worktre_name" }

Use quando: precisar limpar um worktree que não é mais necessário.`,
    inputSchema: z.object({
      worktree_name: z.string().describe("Nome da pasta da worktree ou caminho completo"),
      force: z.boolean().default(false).describe("Forçar remoção"),
      workspace_root: z.string().optional().describe("Workspace root (auto-detecta se omitido)"),
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
      // Detect workspace
      const cwd = params.workspace_root || process.cwd()
      const workspaceRoot = await WorkspaceService.getWorkspaceRootOrThrow(cwd)

      // Delete worktree using WorktreeService
      const worktreeService = new WorktreeService(workspaceRoot)
      await worktreeService.initialize()

      const worktreePath = join(workspaceRoot, params.worktree_name)
      await worktreeService.deleteWorktree(worktreePath, params.force)

      return jsonResult({ success: true, removed: params.worktree_name })
    } catch (error) {
      return errorResult(error instanceof Error ? error.message : String(error))
    }
  }
)

// 6. Status do workspace
server.registerTool(
  "saltree_workspace_status",
  {
    title: "Status do workspace",
    description: `Retorna informações sobre um workspace: se o repo existe, quantos worktrees tem, e branches disponíveis.

⚠️ IMPORTANTE: Este comando só funciona DENTRO de um workspace (dir com .git/).

Args:
  - workspace_root: Caminho do workspace root (opcional, auto-detecta se omitido)

Returns JSON:
  { projectName, workspaceRoot, worktrees, branches }

Use quando: precisar verificar o estado de um workspace antes de operar nele.`,
    inputSchema: z.object({
      workspace_root: z.string().optional().describe("Workspace root (auto-detecta se omitido)"),
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
      // Detect workspace
      const cwd = params.workspace_root || process.cwd()
      const workspaceRoot = await WorkspaceService.getWorkspaceRootOrThrow(cwd)

      // Get worktrees
      const result = await executeGitCommand(["worktree", "list"], workspaceRoot)
      const worktrees: string[] = []
      if (result.success) {
        worktrees.push(...result.stdout.split("\n").filter(Boolean))
      }

      // Get branches
      let branches: string[] = []
      const branchResult = await executeGitCommand(["branch", "--list"], workspaceRoot)
      if (branchResult.success) {
        branches = branchResult.stdout
          .split("\n")
          .map((l) => l.replace("*", "").trim())
          .filter(Boolean)
      }

      return jsonResult({
        projectName: workspaceRoot.split(/[\\/]/).pop() || "unknown",
        workspaceRoot,
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
    description: `Roda git fetch --all --prune no workspace.

⚠️ IMPORTANTE: Este comando só funciona DENTRO de um workspace (dir com .git/).

Args:
  - workspace_root: Caminho do workspace root (opcional, auto-detecta se omitido)

Returns JSON:
  { success: true, message: "Fetch concluído" }

Use quando: precisar atualizar o workspace com as últimas mudanças do remote.`,
    inputSchema: z.object({
      workspace_root: z.string().optional().describe("Workspace root (auto-detecta se omitido)"),
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
      // Detect workspace
      const cwd = params.workspace_root || process.cwd()
      const workspaceRoot = await WorkspaceService.getWorkspaceRootOrThrow(cwd)

      await executeGitCommand(["fetch", "--all", "--prune"], workspaceRoot)

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
