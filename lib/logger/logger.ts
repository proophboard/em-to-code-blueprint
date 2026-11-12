export interface Logger {
  log: (...rest: unknown[]) => void;
  error: (...rest: unknown[]) => void;
  warn: (...rest: unknown[]) => void;
}
