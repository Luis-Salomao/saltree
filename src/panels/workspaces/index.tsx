import { Box, Text, useInput } from "ink"
import { useCallback, useEffect, useState } from "react"
import { StatusIndicator } from "../../components/common/index.js"
import { COLORS, MESSAGES } from "../../constants/index.js"
import { WorkspaceRegistryService } from "../../services/workspace-registry-service.js"
import type { WorkspaceInfo } from "../../types/index.js"

interface WorkspacesPanelProps {
  onBack: () => void
}

export function WorkspacesPanel({ onBack }: WorkspacesPanelProps) {
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [error, setError] = useState<string>()

  const loadWorkspaces = useCallback(async () => {
    try {
      setLoading(true)
      setError(undefined)
      const registry = new WorkspaceRegistryService()
      await registry.load()
      const infos = await registry.getWorkspacesWithInfo()
      setWorkspaces(infos)
      if (selectedIndex >= infos.length) {
        setSelectedIndex(Math.max(0, infos.length - 1))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [selectedIndex])

  useEffect(() => {
    void loadWorkspaces()
  }, [loadWorkspaces])

  const removeMissingWorkspace = useCallback(async () => {
    const selected = workspaces[selectedIndex]
    if (!selected || selected.exists) return

    const registry = new WorkspaceRegistryService()
    await registry.load()
    await registry.removeWorkspace(selected.id)
    await loadWorkspaces()
  }, [loadWorkspaces, selectedIndex, workspaces])

  useInput((input, key) => {
    if (key.escape) {
      onBack()
      return
    }
    if (key.upArrow && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1)
    }
    if (key.downArrow && selectedIndex < workspaces.length - 1) {
      setSelectedIndex(selectedIndex + 1)
    }

    if (key.rightArrow) {
      void removeMissingWorkspace()
    }
  })

  if (loading) {
    return <StatusIndicator status="loading" message="Carregando workspaces..." spinner />
  }

  if (error) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text color={COLORS.ERROR}>Erro ao carregar workspaces: {error}</Text>
        <Text color={COLORS.MUTED} dimColor>
          Pressione Esc para voltar
        </Text>
      </Box>
    )
  }

  if (workspaces.length === 0) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text color={COLORS.MUTED}>{MESSAGES.WORKSPACE_NO_WORKSPACES}</Text>
        <Text color={COLORS.MUTED} dimColor>
          Pressione Esc para voltar
        </Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold color={COLORS.PRIMARY}>
        {MESSAGES.WORKSPACE_LIST_TITLE}
      </Text>

      {workspaces.map((ws, i) => (
        <Box key={ws.id} gap={1}>
          <Text color={i === selectedIndex ? COLORS.SUCCESS : COLORS.MUTED}>
            {i === selectedIndex ? "▸" : " "}
          </Text>
          <Text bold={i === selectedIndex} color={i === selectedIndex ? COLORS.PRIMARY : COLORS.MUTED}>
            {ws.projectName}
          </Text>
          <Text color={COLORS.MUTED} dimColor>
            ({ws.repoType === "clone-https" ? "clone" : "local"})
          </Text>
          <Text color={COLORS.INFO} dimColor>
            {ws.worktreeCount} worktree{ws.worktreeCount !== 1 ? "s" : ""}
          </Text>
          {!ws.exists && (
            <Text color={COLORS.ERROR}>
              [apagado]
            </Text>
          )}
          <Text color={COLORS.MUTED} dimColor>
            {ws.basePath}
          </Text>
        </Box>
      ))}

      <Box marginTop={1}>
        <Text color={COLORS.MUTED} dimColor>
          ↑↓ navegar · → remover apagado · Esc voltar
        </Text>
      </Box>
    </Box>
  )
}
