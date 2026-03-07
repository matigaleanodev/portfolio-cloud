export function logInfo(message: string, context?: Record<string, unknown>): void {
  if (context) {
    console.info(message, context);
    return;
  }

  console.info(message);
}

export function logError(message: string, error?: unknown): void {
  if (error) {
    console.error(message, error);
    return;
  }

  console.error(message);
}
