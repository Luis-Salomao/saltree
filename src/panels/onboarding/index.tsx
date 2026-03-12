import { Box, Text } from "ink"
import { useState } from "react"
import { InputPrompt } from "../../components/common/index.js"
import { COLORS } from "../../constants/index.js"

interface OnboardingProps {
  onComplete: (userName: string) => void
}

type Step = "welcome" | "name"

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState<Step>("welcome")

  if (step === "welcome") {
    setStep("name")
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column">
        <Text bold color={COLORS.PRIMARY}>
          Bem-vindo ao Saltree!
        </Text>
        <Text color={COLORS.MUTED}>
          Gerenciador de workspaces com Git bare repos.
        </Text>
      </Box>

      {step === "name" && (
        <InputPrompt
          label="Qual seu nome de usuário/prefixo de workspace?"
          placeholder="ex: luis"
          validate={(value) => {
            if (!value.trim()) return "Nome não pode ser vazio"
            if (/[<>:"|?*\\/]/.test(value)) return "Nome contém caracteres inválidos"
            if (value.length > 50) return "Nome muito longo"
            return undefined
          }}
          onSubmit={(value) => onComplete(value.trim())}
        />
      )}
    </Box>
  )
}
