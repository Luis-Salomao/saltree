import { basename, dirname, join, resolve } from "node:path"
import type { TemplateVariables } from "../types/index"

export function resolveTemplate(template: string, variables: TemplateVariables): string {
  let result = template

  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `$${key}`
    result = result.replace(new RegExp(placeholder.replace(/\$/g, "\\$"), "g"), value)
  }

  return result
}

export function getRepositoryBaseName(gitRoot: string): string {
  return basename(gitRoot)
}

export function getRepositoryRoot(path?: string): string {
  return resolve(path || process.cwd())
}

export function getWorktreePath(
  gitRoot: string,
  directoryName: string,
  template: string,
  branchName?: string,
  sourceBranch?: string
): string {
  const baseName = getRepositoryBaseName(gitRoot)
  const parentDir = dirname(gitRoot)

  const variables: TemplateVariables = {
    BASE_PATH: baseName,
    WORKTREE_PATH: join(parentDir, directoryName),
    BRANCH_NAME: branchName || "",
    SOURCE_BRANCH: sourceBranch || "",
  }

  const resolvedTemplate = resolveTemplate(template, variables)
  const worktreeBase = join(parentDir, resolvedTemplate)

  return join(worktreeBase, directoryName)
}

export function validateDirectoryName(name: string): string | undefined {
  if (!name.trim()) {
    return "Directory name cannot be empty"
  }

  if (name.includes("/") || name.includes("\\")) {
    return "Directory name cannot contain path separators"
  }

  if (name.startsWith(".") || name.startsWith("-")) {
    return "Directory name cannot start with . or -"
  }

  const hasInvalidChars = /[<>:"|?*]/.test(name)
  const hasControlChars = name.split("").some((char) => {
    const code = char.charCodeAt(0)
    return code >= 0x00 && code <= 0x1f
  })

  if (hasInvalidChars || hasControlChars) {
    return "Directory name contains invalid characters"
  }

  if (name.length > 255) {
    return "Directory name too long"
  }

  return undefined
}

export function validateBranchName(name: string): string | undefined {
  if (!name.trim()) {
    return "Branch name cannot be empty"
  }

  if (name.includes("..") || name.includes("//")) {
    return "Branch name cannot contain .. or //"
  }

  if (name.startsWith("/") || name.endsWith("/")) {
    return "Branch name cannot start or end with /"
  }

  if (name.startsWith("-") || name.endsWith(".")) {
    return "Branch name cannot start with - or end with ."
  }

  if (/[\s~^:?*[\]\\@]/.test(name)) {
    return "Branch name contains invalid characters"
  }

  if (name === "HEAD") {
    return "Branch name cannot be HEAD"
  }

  return undefined
}

/**
 * Nomes reservados do Windows que não podem ser usados como nome de pasta.
 */
const WINDOWS_RESERVED_NAMES = new Set([
  "CON", "PRN", "AUX", "NUL",
  "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
  "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
])

/**
 * Sanitiza um nome de branch para uso como nome de pasta no filesystem.
 * Branch Git permanece original (ex: feat/auth).
 * Path fica seguro para Windows (ex: feat-auth).
 *
 * Regras:
 * - Substitui / e \ pelo replacement (default: -)
 * - Remove caracteres inválidos no Windows (<>:"|?*)
 * - Remove pontos e espaços finais
 * - Evita nomes reservados do Windows (CON, PRN, etc)
 * - Limita a 255 caracteres
 */
export function sanitizeBranchForFs(
  branchName: string,
  options?: { prefix?: string; replacement?: string }
): string {
  const { prefix = "", replacement = "-" } = options || {}

  let sanitized = branchName
    // Substituir separadores de path
    .replace(/[/\\]/g, replacement)
    // Remover caracteres inválidos no Windows
    .replace(/[<>:"|?*]/g, "")
    // Remover caracteres de controle
    .replace(/[\x00-\x1f]/g, "")
    // Colapsar replacements consecutivos
    .replace(new RegExp(`${escapeRegex(replacement)}{2,}`, "g"), replacement)
    // Trim de pontos e espaços finais
    .replace(/[.\s]+$/, "")
    // Trim de replacement no início e fim
    .replace(new RegExp(`^${escapeRegex(replacement)}+|${escapeRegex(replacement)}+$`, "g"), "")

  // Adicionar prefixo
  if (prefix) {
    sanitized = `${prefix}${sanitized}`
  }

  // Evitar nomes reservados do Windows
  const upperName = sanitized.toUpperCase().split(".")[0] || ""
  if (WINDOWS_RESERVED_NAMES.has(upperName)) {
    sanitized = `_${sanitized}`
  }

  // Limitar tamanho
  if (sanitized.length > 255) {
    sanitized = sanitized.slice(0, 255)
  }

  return sanitized
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
