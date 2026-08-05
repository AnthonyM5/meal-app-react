// Resolve a path under the repo-root `audits/` directory.
//
// The maintenance scripts are documented to run from `apps/web` (they need
// its .env.local), but `audits/` lives at the monorepo root — so a bare
// relative path like 'audits/foo.md' resolves to apps/web/audits and throws
// ENOENT. Walk up from cwd to the workspace root instead, so the scripts work
// from either directory.

import { existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Absolute path to `<repo-root>/audits/<fileName>`, creating the dir.
 * Throws when no workspace root is found — silently creating an `audits/`
 * directory wherever the walk happened to stop would scatter reports outside
 * the repo and make the script look like it succeeded.
 */
export function auditPath(fileName: string): string {
  let dir = process.cwd()
  for (let i = 0; i < 5; i++) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) {
      const auditsDir = resolve(dir, 'audits')
      mkdirSync(auditsDir, { recursive: true })
      return resolve(auditsDir, fileName)
    }
    const parent = resolve(dir, '..')
    if (parent === dir) break // hit the filesystem root
    dir = parent
  }
  throw new Error(
    `auditPath: no pnpm-workspace.yaml found within 5 levels above ` +
      `${process.cwd()} — run this script from inside the repo (apps/web).`
  )
}
