import type { WorkflowFilesListResult } from '../../src/api/types'
import { listProjectWorkflowFiles } from '../utils/workflow-files'

export default defineEventHandler(async (): Promise<WorkflowFilesListResult> => {
  try {
    return { ok: true, entries: await listProjectWorkflowFiles() }
  }
  catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) }
  }
})
