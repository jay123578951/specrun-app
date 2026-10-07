import type { WorkflowFilesUpdateResult } from '../../../src/api/types'
import { updateProjectWorkflowFiles } from '../../utils/workflow-files'

export default defineEventHandler(async (event): Promise<WorkflowFilesUpdateResult> => {
  const body = await readBody(event).catch(() => null) as { path?: unknown } | null
  const input = typeof body?.path === 'string' ? body.path : ''
  const result = await updateProjectWorkflowFiles(input)
  if (!result.ok)
    setResponseStatus(event, 400)
  return result
})
