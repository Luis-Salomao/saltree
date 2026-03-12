import { Box, Text } from "ink"
import { useEffect, useRef, useState } from "react"
import { COLORS } from "../constants/index.js"

interface IntroSplashProps {
  gitRoot?: string | undefined
  onComplete: () => void
}

type GlitchPhase = "glitch" | "reveal" | "done"

type CharState = {
  character: string
  color: string
  bold?: boolean
}

const ART = [
  "███████╗ █████╗ ██╗  ████████╗██████╗ ███████╗███████╗",
  "██╔════╝██╔══██╗██║  ╚══██╔══╝██╔══██╗██╔════╝██╔════╝",
  "███████╗███████║██║     ██║   ██████╔╝█████╗  █████╗  ",
  "╚════██║██╔══██║██║     ██║   ██╔══██╗██╔══╝  ██╔══╝  ",
  "███████║██║  ██║███████╗██║   ██║  ██║███████╗███████╗",
  "╚══════╝╚═╝  ╚═╝╚══════╝╚═╝   ╚═╝  ╚═╝╚══════╝╚══════╝",
] as const

const GLITCH_CHARS = "▓▒░█▄▀■□▪▫"
const HIDDEN_COLOR = "#111111"
const REVEAL_COLOR = "#737b86"
const FINAL_COLOR = "#c4c9d4"
const GLITCH_COLOR = "#f43f5e"
const GLITCH_TICKS = 11
const GLITCH_INTERVAL_MS = 70
const REVEAL_INTERVAL_MS = 30
const REVEAL_STEP = 14

function randomGlitchChar(): string {
  return GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)] || "█"
}

export function IntroSplash({ gitRoot, onComplete }: IntroSplashProps) {
  const [phase, setPhase] = useState<GlitchPhase>("glitch")
  const [tick, setTick] = useState(0)
  const [revealCount, setRevealCount] = useState(0)
  const completionSent = useRef(false)

  useEffect(() => {
    if (phase === "glitch") {
      if (tick >= GLITCH_TICKS) {
        setPhase("reveal")
        return
      }

      const timer = setTimeout(() => {
        setTick(current => current + 1)
      }, GLITCH_INTERVAL_MS)

      return () => clearTimeout(timer)
    }

    if (phase === "reveal") {
      const totalVisibleChars = ART.join("").replaceAll(" ", "").length

      if (revealCount >= totalVisibleChars) {
        setPhase("done")
        return
      }

      const timer = setTimeout(() => {
        setRevealCount(current => current + REVEAL_STEP)
      }, REVEAL_INTERVAL_MS)

      return () => clearTimeout(timer)
    }

    if (!completionSent.current) {
      completionSent.current = true
      const timer = setTimeout(() => {
        onComplete()
      }, 220)

      return () => clearTimeout(timer)
    }
  }, [onComplete, phase, revealCount, tick])

  let revealedSoFar = 0

  const logoLines = ART.map((line, lineIndex) => {
    const characters = [...line].map((character, charIndex) => {
      if (character === " ") {
        return {
          key: `intro-${lineIndex}-${charIndex}`,
          value: { character: " ", color: HIDDEN_COLOR } satisfies CharState,
        }
      }

      revealedSoFar += 1

      let charState: CharState

      if (phase === "glitch") {
        const shouldGlitch = Math.random() < 0.42 || tick > lineIndex + charIndex / 8
        charState = shouldGlitch
          ? { character: randomGlitchChar(), color: GLITCH_COLOR, bold: true }
          : { character, color: HIDDEN_COLOR }
      } else if (phase === "reveal") {
        if (revealedSoFar <= revealCount) {
          const nearHead = revealCount - revealedSoFar < REVEAL_STEP * 2
          charState = {
            character,
            color: nearHead ? REVEAL_COLOR : FINAL_COLOR,
            bold: nearHead,
          }
        } else {
          charState = { character, color: HIDDEN_COLOR }
        }
      } else {
        charState = { character, color: FINAL_COLOR, bold: lineIndex % 2 === 0 }
      }

      return {
        key: `intro-${lineIndex}-${charIndex}`,
        value: charState,
      }
    })

    return (
      <Text key={`intro-line-${lineIndex}`}>
        {characters.map(({ key, value }) => (
          <Text key={key} color={value.color} bold={value.bold ?? false}>
            {value.character}
          </Text>
        ))}
      </Text>
    )
  })

  return (
    <Box borderStyle="round" paddingX={1} paddingY={0}>
      <Box flexDirection="column">
        <Text>
          <Text color={COLORS.MUTED}>[::] Welcome to </Text>
          <Text color={COLORS.PRIMARY} bold>
            SalTree
          </Text>
          <Text color={COLORS.MUTED}> [::]</Text>
        </Text>
        <Box flexDirection="column" marginTop={1} marginBottom={1}>
          {logoLines}
        </Box>
        <Text>
          <Text color={COLORS.MUTED}>S|A|L|T|R|</Text>
          <Text color={COLORS.PRIMARY}>E</Text>
        </Text>
        <Text color={COLORS.MUTED}>cwd: {gitRoot || process.cwd()}</Text>
      </Box>
    </Box>
  )
}