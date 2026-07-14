/**
 * Development-only logging utility.
 *
 * Use `devLog` and `devWarn` for debug logs that should never appear in
 * production.  They compile away entirely when `NODE_ENV !== 'development'`.
 *
 * For production-important messages (errors, operational warnings), use
 * the native `console.error` / `console.warn` directly.
 *
 * @example
 *   import { devLog, devWarn } from '@/utils/debug';
 *   devLog('📦 Payload received:', payload);
 *   devWarn('Unusual state, but continuing:', state);
 */

const isDev = process.env.NODE_ENV === 'development';

/** Log only in development. */
export const devLog = (...args) => {
  if (isDev) {
    console.log(...args);
  }
};

/** Warn only in development. */
export const devWarn = (...args) => {
  if (isDev) {
    console.warn(...args);
  }
};
