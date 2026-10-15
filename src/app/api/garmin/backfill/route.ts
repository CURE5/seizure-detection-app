// app/api/garmin/backfill/route.ts
//
// Triggers a Garmin Cloud backfill for the last N days, then merges the
// fetched HR samples into hr_logs/ where the live BLE feed had gaps. Both
// scripts live in the seizure-detection-server repo and run inside its
// `sz` venv. Cached Garmin tokens under .garmin_tokens/ must already be
// seeded — the FE-triggered run is non-interactive (no MFA prompt).

import { NextResponse } from "next/server";
import { execFile } from "child_process";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

// seizure-detection-server is a sibling of seizure-detection-app (the FE's cwd
// under pm2). Resolving relatively keeps the route portable across deploy
// roots — only the sibling layout has to hold.
const SERVER_DIR = path.resolve(process.cwd(), "..", "seizure-detection-server");
const PYTHON_BIN = path.join(SERVER_DIR, "sz", "bin", "python");
const BACKFILL_SCRIPT = path.join(SERVER_DIR, "scripts", "garmin_backfill.py");
const MERGE_SCRIPT = path.join(SERVER_DIR, "scripts", "garmin_hr_merge.py");

const DEFAULT_DAYS = 7;
const MAX_DAYS = 90;

// Generous: a 90-day range hitting one 5-min cooldown stays well under this.
// Most runs finish in under a minute.
const SCRIPT_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_BUFFER = 16 * 1024 * 1024;

// Module-scoped guard: pm2 runs a single Node process for the FE, so this
// is enough to prevent concurrent runs from racing on the .garmin_tokens
// store (the garminconnect lib rewrites tokens mid-session).
let runInProgress = false;

function isoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const setCorsHeaders = (response: NextResponse) => {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
};

type ExecError = {
  message?: string;
  stdout?: string;
  stderr?: string;
  code?: number;
};

async function runScript(
  script: string,
  args: string[]
): Promise<{ stdout: string; stderr: string }> {
  const { stdout, stderr } = await execFileAsync(
    PYTHON_BIN,
    ["-u", script, ...args],
    { timeout: SCRIPT_TIMEOUT_MS, maxBuffer: MAX_BUFFER }
  );
  return { stdout, stderr };
}

export async function POST(request: Request) {
  let body: { days?: number; force?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    // empty body is allowed — defaults apply
  }

  const requested = body.days ?? DEFAULT_DAYS;
  if (
    !Number.isFinite(requested) ||
    !Number.isInteger(requested) ||
    requested < 1 ||
    requested > MAX_DAYS
  ) {
    return setCorsHeaders(
      NextResponse.json(
        { error: `days must be an integer in [1, ${MAX_DAYS}]; got ${requested}` },
        { status: 400 }
      )
    );
  }
  const days = requested;

  if (runInProgress) {
    return setCorsHeaders(
      NextResponse.json(
        { error: "A Garmin sync is already running on this server" },
        { status: 409 }
      )
    );
  }
  runInProgress = true;

  // Inclusive window: yesterday-(days-1) .. yesterday. Today is excluded —
  // Garmin Cloud usually hasn't received it yet, matching the Python
  // script's default-to-yesterday convention. Local TZ matches the Pi's
  // `date.today()` so off-by-one near midnight stays consistent.
  const yesterday = new Date(Date.now() - 24 * 3600 * 1000);
  const start = new Date(yesterday.getTime() - (days - 1) * 24 * 3600 * 1000);
  const startIso = isoDateLocal(start);
  const endIso = isoDateLocal(yesterday);
  const force = !!body.force;

  const startedAt = Date.now();
  try {
    const backfillArgs = ["--start", startIso, "--end", endIso];
    if (force) backfillArgs.push("--force");

    let backfill;
    try {
      backfill = await runScript(BACKFILL_SCRIPT, backfillArgs);
    } catch (error: unknown) {
      const e = error as ExecError;
      return setCorsHeaders(
        NextResponse.json(
          {
            error: "garmin_backfill.py failed",
            message: e.message,
            code: e.code,
            stdout: e.stdout ?? "",
            stderr: e.stderr ?? "",
            startDate: startIso,
            endDate: endIso,
          },
          { status: 500 }
        )
      );
    }

    let merge;
    try {
      merge = await runScript(MERGE_SCRIPT, [
        "--start",
        startIso,
        "--end",
        endIso,
      ]);
    } catch (error: unknown) {
      const e = error as ExecError;
      return setCorsHeaders(
        NextResponse.json(
          {
            error: "garmin_hr_merge.py failed",
            message: e.message,
            code: e.code,
            stdout: e.stdout ?? "",
            stderr: e.stderr ?? "",
            backfillStdout: backfill.stdout,
            startDate: startIso,
            endDate: endIso,
          },
          { status: 500 }
        )
      );
    }

    return setCorsHeaders(
      NextResponse.json({
        ok: true,
        days,
        startDate: startIso,
        endDate: endIso,
        force,
        durationMs: Date.now() - startedAt,
        backfill: {
          stdout: backfill.stdout.trim(),
          stderr: backfill.stderr.trim(),
        },
        merge: {
          stdout: merge.stdout.trim(),
          stderr: merge.stderr.trim(),
        },
      })
    );
  } finally {
    runInProgress = false;
  }
}

export async function OPTIONS() {
  return setCorsHeaders(NextResponse.json({}, { status: 200 }));
}
