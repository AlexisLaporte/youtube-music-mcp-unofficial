import { NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'
import { getSession, isAdmin } from '@/lib/auth'

// Track background process
let backgroundProcess: ReturnType<typeof spawn> | null = null
let processStartedAt: number | null = null

// POST - start background analysis
export async function POST() {
  const session = await getSession()
  if (!session || !isAdmin(session.email)) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  if (backgroundProcess && !backgroundProcess.killed) {
    return NextResponse.json({
      error: 'Analysis already running',
      startedAt: processStartedAt
    }, { status: 409 })
  }

  const scriptPath = path.join(process.cwd(), 'scripts', 'analyze-batch.py')
  const pythonPath = path.join(process.cwd(), 'scripts', 'venv', 'bin', 'python')

  backgroundProcess = spawn(pythonPath, [scriptPath], {
    cwd: process.cwd(),
    detached: true, // Run independently of parent
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  processStartedAt = Date.now()

  // Log output but don't block
  backgroundProcess.stdout?.on('data', (data: Buffer) => {
    console.log(`[Background Analysis]`, data.toString().trim())
  })

  backgroundProcess.stderr?.on('data', (data: Buffer) => {
    console.error(`[Background Analysis Error]`, data.toString().trim())
  })

  backgroundProcess.on('close', (code) => {
    console.log(`[Background Analysis] Finished with code ${code}`)
    backgroundProcess = null
    processStartedAt = null
  })

  // Unref to allow parent to exit independently
  backgroundProcess.unref()

  return NextResponse.json({
    started: true,
    message: 'Background analysis started. Check /api/analysis/progress for status.',
    startedAt: processStartedAt
  })
}

// GET - check if background process is running
export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const running = backgroundProcess !== null && !backgroundProcess.killed

  return NextResponse.json({
    running,
    startedAt: processStartedAt,
    uptime: processStartedAt ? Math.round((Date.now() - processStartedAt) / 1000) : null
  })
}

// DELETE - stop background process
export async function DELETE() {
  const session = await getSession()
  if (!session || !isAdmin(session.email)) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  if (!backgroundProcess || backgroundProcess.killed) {
    return NextResponse.json({ error: 'No process running' }, { status: 404 })
  }

  backgroundProcess.kill('SIGTERM')
  backgroundProcess = null
  processStartedAt = null

  return NextResponse.json({ stopped: true })
}
