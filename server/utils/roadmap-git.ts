import type { RoadmapListProbe } from '../../src/api/types'
import { execFile } from 'node:child_process'
import { CHANGED_ARGS, GIT_MAX_BUFFER, GIT_TIMEOUT_MS, LOG_ARGS, TRACKED_ARGS } from '../../src/api/roadmap-git-args'

export async function readRoadmapGit(roadmapDir: string): Promise<RoadmapListProbe['git']> {
  const [log, changed, tracked] = await Promise.all([
    runGit(roadmapDir, LOG_ARGS),
    runGit(roadmapDir, CHANGED_ARGS),
    runGit(roadmapDir, TRACKED_ARGS),
  ])
  if (log === undefined || changed === undefined || tracked === undefined)
    return undefined
  return { log, changed, tracked }
}

function runGit(cwd: string, args: string[]): Promise<string | undefined> {
  return new Promise((resolve) => {
    execFile('git', args, { cwd, timeout: GIT_TIMEOUT_MS, maxBuffer: GIT_MAX_BUFFER, encoding: 'utf8' }, (error, stdout) => {
      resolve(error ? undefined : stdout)
    })
  })
}
