export class SnowDevError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "SnowDevError";
  }
}

export function formatError(error: unknown): string {
  if (error instanceof SnowDevError) return `snowdev: error [${error.code}]: ${error.message}`;
  if (error instanceof Error) return `snowdev: error [E_UNEXPECTED]: ${error.message}`;
  return "snowdev: error [E_UNEXPECTED]: An unexpected error occurred.";
}
