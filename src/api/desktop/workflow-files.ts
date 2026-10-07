import type { WorkflowFilesEntry, WorkflowFilesListResult, WorkflowFilesUpdateResult } from '../types'
import { buildWorkflowEntry, extractGeneratedBy, parseUpdateResult, readSkillHead } from '../workflow-files'
import { cliSettings, runCli } from './cli'
import { config } from './config-store'
import { join } from './paths'
import { ensureAccess } from './projects'
import { canonicalPath, closeResource, openFileForRead, readDir, readFileChunk, statPath } from './shell'

const SKILLS_DIR = ['.claude', 'skills']
const SKILL_PREFIX = 'openspec-'
const SKILL_FILE = 'SKILL.md'

export async function listWorkflowFiles(): Promise<WorkflowFilesListResult> {
  try {
    const [current, settings] = await Promise.all([config(), cliSettings()])
    const cliVersion = settings.bin ? settings.version : null
    const entries = await Promise.all(current.projects.map(project => readProject(project, cliVersion)))
    return { ok: true, entries }
  }
  catch (error) {
    return { ok: false, message: describe(error) }
  }
}

async function readProject(project: string, cliVersion: string | null): Promise<WorkflowFilesEntry> {
  const missing = buildWorkflowEntry({ path: project, exists: false, generatedBy: [] }, cliVersion)
  let canonical: string
  try {
    canonical = await canonicalPath(project)
    await ensureAccess(canonical)
    if (!(await statPath(canonical)).isDirectory)
      return missing
  }
  catch {
    return missing
  }

  const skillsDir = join(canonical, ...SKILLS_DIR)
  let names: string[] = []
  try {
    names = (await readDir(skillsDir))
      .filter(entry => entry.isDirectory && entry.name.startsWith(SKILL_PREFIX))
      .map(entry => entry.name)
  }
  catch {
  }

  const generatedBy = await Promise.all(names.map(name => readGeneratedBy(join(skillsDir, name, SKILL_FILE))))
  return buildWorkflowEntry({ path: project, exists: true, generatedBy }, cliVersion)
}

async function readGeneratedBy(file: string): Promise<string | null> {
  try {
    const rid = await openFileForRead(file)
    try {
      return extractGeneratedBy(await readSkillHead(len => readFileChunk(rid, len)))
    }
    finally {
      await closeResource(rid)
    }
  }
  catch {
    return null
  }
}

export async function updateWorkflowFiles(path: string): Promise<WorkflowFilesUpdateResult> {
  try {
    const current = await config()
    if (!path || !current.projects.includes(path))
      return { ok: false, message: 'This project is not in the project list.' }

    const outcome = await runCli(['update', path], path)
    if (!outcome.ok)
      return parseUpdateResult({ exitCode: null, stdout: '', stderr: '', failureMessage: outcome.failure.message })
    return parseUpdateResult({ exitCode: outcome.exitCode, stdout: outcome.stdout, stderr: outcome.stderr })
  }
  catch (error) {
    return { ok: false, message: describe(error) }
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
