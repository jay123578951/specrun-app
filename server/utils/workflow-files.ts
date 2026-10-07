import type { WorkflowFilesEntry, WorkflowFilesUpdateResult } from '../../src/api/types'
import { Buffer } from 'node:buffer'
import { open, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { buildWorkflowEntry, extractGeneratedBy, parseUpdateResult, readSkillHead } from '../../src/api/workflow-files'
import { cliSettings } from './cli-resolver'
import { runCli, toProbeFailure } from './openspec-cli'
import { projectEntries } from './project-state'

const SKILLS_DIR = path.join('.claude', 'skills')
const SKILL_PREFIX = 'openspec-'
const SKILL_FILE = 'SKILL.md'

async function listedProjects(): Promise<string[]> {
  return (await projectEntries()).filter(entry => !entry.temporary).map(entry => entry.path)
}

async function currentCliVersion(): Promise<string | null> {
  const settings = await cliSettings()
  return settings.bin ? settings.version : null
}

export async function listProjectWorkflowFiles(): Promise<WorkflowFilesEntry[]> {
  const [projects, cliVersion] = await Promise.all([listedProjects(), currentCliVersion()])
  return Promise.all(projects.map(project => readProject(project, cliVersion)))
}

async function readProject(project: string, cliVersion: string | null): Promise<WorkflowFilesEntry> {
  try {
    if (!(await stat(project)).isDirectory())
      return buildWorkflowEntry({ path: project, exists: false, generatedBy: [] }, cliVersion)
  }
  catch {
    return buildWorkflowEntry({ path: project, exists: false, generatedBy: [] }, cliVersion)
  }

  const skillsDir = path.join(project, SKILLS_DIR)
  let names: string[] = []
  try {
    names = (await readdir(skillsDir, { withFileTypes: true }))
      .filter(entry => entry.isDirectory() && entry.name.startsWith(SKILL_PREFIX))
      .map(entry => entry.name)
  }
  catch {
  }

  const generatedBy = await Promise.all(names.map(name => readGeneratedBy(path.join(skillsDir, name, SKILL_FILE))))
  return buildWorkflowEntry({ path: project, exists: true, generatedBy }, cliVersion)
}

async function readGeneratedBy(file: string): Promise<string | null> {
  try {
    const handle = await open(file, 'r')
    try {
      return extractGeneratedBy(await readSkillHead(async (len) => {
        const buffer = Buffer.alloc(len)
        const { bytesRead } = await handle.read(buffer, 0, len, null)
        return buffer.subarray(0, bytesRead)
      }))
    }
    finally {
      await handle.close()
    }
  }
  catch {
    return null
  }
}

export async function updateProjectWorkflowFiles(input: string): Promise<WorkflowFilesUpdateResult> {
  const target = path.resolve(input)
  if (!input || !(await listedProjects()).includes(target))
    return { ok: false, message: 'This project is not in the project list.' }

  const args = ['update', target]
  try {
    const { error, stdout, stderr } = await runCli(args, target)
    if (!error)
      return parseUpdateResult({ exitCode: 0, stdout, stderr })
    if (typeof error.code === 'number')
      return parseUpdateResult({ exitCode: error.code, stdout, stderr })
    return parseUpdateResult({ exitCode: null, stdout, stderr, failureMessage: toProbeFailure(error, args).message })
  }
  catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) }
  }
}
