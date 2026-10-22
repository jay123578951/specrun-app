import type { ProjectActionResult } from '../../../src/api/types'
import { reorderProjects } from '../../utils/project-state'
import { buildSnapshot } from '../../utils/projects-snapshot'

export default defineEventHandler(async (event): Promise<ProjectActionResult> => {
  const body = await readBody(event) as { paths?: unknown } | null
  const paths = body?.paths
  if (!Array.isArray(paths) || !paths.every(each => typeof each === 'string')) {
    setResponseStatus(event, 400)
    return { ok: false, message: 'Send the project paths as a list of strings.' }
  }

  const outcome = await reorderProjects(paths)
  if (!outcome.ok) {
    setResponseStatus(event, 400)
    return { ok: false, message: outcome.message }
  }

  return { ok: true, snapshot: await buildSnapshot({ badges: false }) }
})
