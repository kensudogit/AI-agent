/**
 * During `next build`, App Route handlers can be executed. Skip DB I/O to avoid
 * spurious SSL / auth errors when CI or local .env points at a different database.
 */
export function isNextProductionBuild(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build';
}
