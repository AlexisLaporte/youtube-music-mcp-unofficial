import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

// Track running analysis process
let analysisProcess: ReturnType<typeof spawn> | null = null;
let analysisStatus: {
  running: boolean;
  startedAt: number | null;
  processedCount: number;
  lastVideoId: string | null;
  error: string | null;
} = {
  running: false,
  startedAt: null,
  processedCount: 0,
  lastVideoId: null,
  error: null,
};

export async function GET() {
  return NextResponse.json(analysisStatus);
}

export async function POST(request: NextRequest) {
  if (analysisStatus.running) {
    return NextResponse.json(
      { error: "Analysis already running", status: analysisStatus },
      { status: 409 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const limit = body.limit || 0;
  const force = body.force || false;
  const videoIds: string[] = body.videoIds || [];

  const scriptPath = path.join(process.cwd(), "scripts", "analyze-batch.py");
  const pythonPath = path.join(process.cwd(), "scripts", "venv", "bin", "python");

  const args = [scriptPath];
  if (limit > 0 && videoIds.length === 0) args.push("--limit", String(limit));
  if (force) args.push("--force");

  // If specific videoIds provided, pass them one by one
  for (const videoId of videoIds) {
    args.push("--video-id", videoId);
  }

  try {
    analysisStatus = {
      running: true,
      startedAt: Date.now(),
      processedCount: 0,
      lastVideoId: null,
      error: null,
    };

    analysisProcess = spawn(pythonPath, args, {
      cwd: process.cwd(),
      env: { ...process.env },
    });

    // Parse output to track progress
    analysisProcess.stdout?.on("data", (data: Buffer) => {
      const output = data.toString();
      console.log("[Analysis]", output);

      // Parse progress from output like "[1/10] Analyzing VIDEO_ID..."
      const progressMatch = output.match(/\[(\d+)\/\d+\] Analyzing ([a-zA-Z0-9_-]+)/);
      if (progressMatch) {
        analysisStatus.processedCount = parseInt(progressMatch[1], 10);
        analysisStatus.lastVideoId = progressMatch[2];
      }
    });

    analysisProcess.stderr?.on("data", (data: Buffer) => {
      console.error("[Analysis Error]", data.toString());
    });

    analysisProcess.on("close", (code) => {
      console.log("[Analysis] Process exited with code", code);
      analysisStatus.running = false;
      if (code !== 0) {
        analysisStatus.error = `Process exited with code ${code}`;
      }
      analysisProcess = null;
    });

    analysisProcess.on("error", (err) => {
      console.error("[Analysis] Process error:", err);
      analysisStatus.running = false;
      analysisStatus.error = err.message;
      analysisProcess = null;
    });

    return NextResponse.json({ started: true, status: analysisStatus });
  } catch (error) {
    analysisStatus.running = false;
    analysisStatus.error = error instanceof Error ? error.message : "Failed to start";
    return NextResponse.json(
      { error: analysisStatus.error },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  if (analysisProcess) {
    analysisProcess.kill("SIGTERM");
    analysisProcess = null;
    analysisStatus.running = false;
    analysisStatus.error = "Cancelled by user";
    return NextResponse.json({ cancelled: true });
  }
  return NextResponse.json({ cancelled: false, message: "No process running" });
}
