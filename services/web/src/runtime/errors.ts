export type RuntimeErrorCode = 'permission' | 'unavailable' | 'cancelled' | 'invalid';

/**
 * Error returned to the guest app: rejects with `{ code, message }`.
 *
 * @example
 * throw new RuntimeCallError('permission', 'Capacité « camera » non déclarée dans uforge.json');
 */
export class RuntimeCallError extends Error {
  constructor(
    readonly code: RuntimeErrorCode,
    message: string,
  ) {
    super(message);
  }
}
