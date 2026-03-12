import { Box } from "ink"
import { MESSAGES } from "../constants/index.js"
import type { AppMode } from "../types/index.js"
import { StatusIndicator } from "./common/index.js"

interface LoadingStateProps {
  mode: AppMode
  gitRoot?: string | undefined
}

export function LoadingState({ mode: _mode, gitRoot: _gitRoot }: LoadingStateProps) {
  return (
    <Box flexDirection="column">
      <StatusIndicator status="loading" message={MESSAGES.LOADING_GIT_INFO} />
    </Box>
  )
}
