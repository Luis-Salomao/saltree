import { Box, Text } from "ink"
import { useState } from "react"
import { InputPrompt, SelectPrompt, StatusIndicator } from "../../components/common/index.js"
import { COLORS, MESSAGES } from "../../constants/index.js"
import { BareRepoService } from "../../services/bare-repo-service.js"
import { GlobalSettingsService } from "../../services/global-settings-service.js"
import { WorkspaceRegistryService } from "../../services/workspace-registry-service.js"
import type { SelectOption, WorkspaceCreateMode } from "../../types/index.js"
import { join, resolve } from "node:path"

interface CreateWorkspacePanelProps {
  onBack: () => void
  onComplete: () => void
}

type Step = "mode" | "project-name" | "repo-url" | "base-dir" | "creating" | "success" | "error"

export function CreateWorkspacePanel({ onBack, onComplete }: CreateWorkspacePanelProps) {
  const [step, setStep] = useState<Step>("mode")
  const [mode, setMode] = useState<WorkspaceCreateMode>("new-local")
  const [projectName, setProjectName] = useState("")
  const [repoUrl, setRepoUrl] = useState("")
  const [baseDir, setBaseDir] = useState("")
  const [statusMsg, setStatusMsg] = useState("")
  const [error, setError] = useState("")

  const handleModeSelect = (value: WorkspaceCreateMode) => {
    setMode(value)
    if (value === "clone-https") {
      setStep("repo-url")
    } else {
      setStep("project-name")
    }
  }

  const handleRepoUrl = (url: string) => {
    setRepoUrl(url)
    // Derivar nome do projeto da URL
    const derived = url.split("/").pop()?.replace(".git", "") || ""
    setProjectName(derived)
    setStep("project-name")
  }

  const handleProjectName = (name: string) => {
    setProjectName(name)
    setStep("base-dir")
  }

  const handleBaseDir = async (dir: string) => {
    setBaseDir(dir)
    setStep("creating")
    await createWorkspace(dir)
  }

  const createWorkspace = async (dir: string) => {
    try {
      const settingsService = new GlobalSettingsService()
      await settingsService.load()
      const userName = settingsService.getUserName() || "user"
      const configuredBaseDir = dir || settingsService.getDefaultBaseDir() || process.cwd()
      const resolvedBaseDir = resolve(configuredBaseDir)

      const basePath = join(resolvedBaseDir, userName, projectName)
      const barePath = `${basePath}.git`
      const worktreePath = basePath

      const bareService = new BareRepoService()

      if (mode === "clone-https") {
        setStatusMsg(MESSAGES.WORKSPACE_CLONE_BARE)
        await bareService.cloneBare({ barePath, repoUrl })
      } else {
        setStatusMsg(MESSAGES.WORKSPACE_INIT_BARE)
        await bareService.initBare({ barePath })
      }

      setStatusMsg(MESSAGES.WORKSPACE_CREATE_WORKTREE)
      if (mode === "new-local") {
        await bareService.createInitialWorktree(barePath, worktreePath)
      } else {
        await bareService.addWorktree(barePath, worktreePath, "main")
      }

      setStatusMsg("Registrando workspace...")
      const registry = new WorkspaceRegistryService()
      await registry.load()
      await registry.addWorkspace({
        owner: userName,
        projectName,
        repoType: mode,
        repoUrl: mode === "clone-https" ? repoUrl : undefined,
        barePath,
        basePath,
        defaultBranch: "main",
        active: true,
      })

      setStep("success")
      setTimeout(onComplete, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setStep("error")
    }
  }

  const modeOptions: SelectOption<WorkspaceCreateMode>[] = [
    {
      label: MESSAGES.WORKSPACE_CREATE_MODE_NEW,
      value: "new-local",
      description: "git init --bare",
    },
    {
      label: MESSAGES.WORKSPACE_CREATE_MODE_CLONE,
      value: "clone-https",
      description: "git clone --bare",
    },
  ]

  if (step === "mode") {
    return (
      <SelectPrompt
        label={MESSAGES.WORKSPACE_CREATE_MODE_PROMPT}
        options={modeOptions}
        onSelect={handleModeSelect}
        onCancel={onBack}
      />
    )
  }

  if (step === "repo-url") {
    return (
      <InputPrompt
        label={MESSAGES.WORKSPACE_REPO_URL_PROMPT}
        placeholder="https://github.com/org/repo.git"
        validate={(value) => {
          if (!value.trim()) return "URL não pode ser vazia"
          if (!value.startsWith("https://")) return "URL deve começar com https://"
          return undefined
        }}
        onSubmit={handleRepoUrl}
        onCancel={onBack}
      />
    )
  }

  if (step === "project-name") {
    return (
      <InputPrompt
        label={MESSAGES.WORKSPACE_PROJECT_NAME_PROMPT}
        placeholder="meu-projeto"
        defaultValue={projectName}
        validate={(value) => {
          if (!value.trim()) return "Nome não pode ser vazio"
          if (/[<>:"|?*\\/]/.test(value)) return "Nome contém caracteres inválidos"
          return undefined
        }}
        onSubmit={handleProjectName}
        onCancel={onBack}
      />
    )
  }

  if (step === "base-dir") {
    return (
      <InputPrompt
        label={MESSAGES.WORKSPACE_BASE_DIR_PROMPT}
        placeholder={process.cwd()}
        onSubmit={handleBaseDir}
        onCancel={onBack}
      />
    )
  }

  if (step === "creating") {
    return <StatusIndicator status="loading" message={statusMsg || MESSAGES.WORKSPACE_CREATING} spinner />
  }

  if (step === "success") {
    return (
      <Box flexDirection="column" gap={1}>
        <StatusIndicator status="success" message={MESSAGES.WORKSPACE_SUCCESS} />
        <Box marginLeft={2} flexDirection="column">
          <Text color={COLORS.MUTED}>
            Projeto: <Text bold color={COLORS.PRIMARY}>{projectName}</Text>
          </Text>
          <Text color={COLORS.MUTED}>
            Tipo: <Text color={COLORS.INFO}>{mode === "clone-https" ? "clone HTTPS" : "novo repo local"}</Text>
          </Text>
        </Box>
      </Box>
    )
  }

  if (step === "error") {
    return (
      <Box flexDirection="column" gap={1}>
        <StatusIndicator status="error" message="Falha ao criar workspace" />
        <Text color={COLORS.ERROR}>{error}</Text>
        <Text color={COLORS.MUTED} dimColor>Pressione qualquer tecla para voltar</Text>
      </Box>
    )
  }

  return null
}
