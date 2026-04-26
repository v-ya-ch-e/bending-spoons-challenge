type TextRevealerOptions = {
  onText: (text: string) => void
  delayMs?: number
}

export function createTextRevealer({
  onText,
  delayMs = 28,
}: TextRevealerOptions) {
  let text = ""
  const queue: string[] = []
  let worker: Promise<void> | null = null

  function enqueue(delta: string) {
    queue.push(...splitIntoReadableTokens(delta))
    worker ??= drainQueue()
  }

  async function drain() {
    while (worker) {
      await worker
    }
  }

  async function finish(finalText?: string) {
    await drain()
    if (finalText !== undefined && finalText !== text) {
      text = finalText
      onText(text)
    }
  }

  async function drainQueue() {
    while (queue.length > 0) {
      const nextToken = queue.shift()
      if (nextToken) {
        text += nextToken
        onText(text)
      }
      await wait(delayMs)
    }
    worker = null
    if (queue.length > 0) {
      worker = drainQueue()
    }
  }

  return {
    enqueue,
    drain,
    finish,
  }
}

function splitIntoReadableTokens(text: string) {
  const tokens = text.match(/\n+|[^\s]+(?:[ \t]+)?/g)
  return tokens && tokens.length > 0 ? tokens : [text]
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}
