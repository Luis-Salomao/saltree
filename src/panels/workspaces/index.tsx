import { Box, Text, useInput } from "ink"
import { useEffect, useState } from "react"
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

  useEffect(() => {
    const load = async () => {
      const registry = new WorkspaceRegistryService()
      await registry.load()
      const infos = await registry.getWorkspacesWithInfo()
      setWorkspaces(infos)
      setLoading(false)
    }
    load()
  }, [])

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
  })

  if (loading) {
    return <StatusIndicator status="loading" message="Carregando workspaces..." spinner />
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
          <Text color={COLORS.MUTED} dimColor>
            {ws.basePath}
          </Text>
        </Box>
      ))}

      <Box marginTop={1}>
        <Text color={COLORS.MUTED} dimColor>
          ↑↓ navegar · Esc voltar
        </Text>
      </Box>
    </Box>
  )
}
