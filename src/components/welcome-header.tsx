import { Box, Text } from "ink"
import { COLORS } from "../constants/index.js"
import type { AppMode } from "../types/index.js"

interface WelcomeHeaderProps {
  mode: AppMode
  gitRoot?: string | undefined
}

const SALT_SHAKER = "[::]"
const SALTREE_LOGO = [
  "███████╗ █████╗ ██╗  ████████╗██████╗ ███████╗███████╗",
  "██╔════╝██╔══██╗██║  ╚══██╔══╝██╔══██╗██╔════╝██╔════╝",
  "███████╗███████║██║     ██║   ██████╔╝█████╗  █████╗  ",
  "╚════██║██╔══██║██║     ██║   ██╔══██╗██╔══╝  ██╔══╝  ",
  "███████║██║  ██║███████╗██║   ██║  ██║███████╗███████╗",
  "╚══════╝╚═╝  ╚═╝╚══════╝╚═╝   ╚═╝  ╚═╝╚══════╝╚══════╝",
]

export function WelcomeHeader({ mode, gitRoot }: WelcomeHeaderProps) {
  const cwd = gitRoot || process.cwd()

  const formatPath = (path: string): string => {
    const home = process.env.HOME || ""
    return path.replace(home, "~")
  }

  const renderLogo = () => (
    <Box flexDirection="column" marginTop={1} marginBottom={1}>
      {SALTREE_LOGO.map((line, lineIndex) => (
        <Text key={`final-logo-${lineIndex}`} color={lineIndex % 2 === 0 ? COLORS.PRIMARY : COLORS.MUTED} bold={lineIndex % 2 === 0}>
          {line}
        </Text>
      ))}
    </Box>
  )

  const getHeaderText = () => {
    if (mode === "menu") {
      return (
        <Box flexDirection="column">
          <Text>
            {SALT_SHAKER} Welcome to{" "}
            <Text bold color={COLORS.PRIMARY}>
              SalTree
            </Text>{" "}
            {SALT_SHAKER}
          </Text>
          {renderLogo()}
          <Text>
            <Text color={COLORS.MUTED}>S|A|L|T|R|</Text>
            <Text color={COLORS.PRIMARY}>E</Text>
          </Text>
        </Box>
      )
    }

    const modeLabels = {
      create: "Create",
      list: "List",
      delete: "Delete",
      settings: "Settings",
      setup: "Setup",
    }

    return (
      <Box flexDirection="column">
        <Text>
          {SALT_SHAKER} SalTree -{" "}
          <Text bold color={COLORS.PRIMARY}>
            {modeLabels[mode] || mode}
          </Text>{" "}
          {SALT_SHAKER}
        </Text>
        {renderLogo()}
        <Text>
          <Text color={COLORS.MUTED}>S|A|L|T|R|</Text>
          <Text color={COLORS.PRIMARY}>E</Text>
        </Text>
      </Box>
    )
  }

  return (
    <Box borderStyle="round" paddingX={1} paddingY={0}>
      <Box flexDirection="column">
        {getHeaderText()}
        <Text color={COLORS.MUTED}>cwd: {formatPath(cwd)}</Text>
      </Box>
    </Box>
  )
}
