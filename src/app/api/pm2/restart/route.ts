// app/api/pm2/restart/route.ts

import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// pm2 jlist returns the parts of a process status that we care about for
// verifying a restart actually replaced the underlying OS process.
type Pm2ProcSnapshot = {
  pid: number;
  status: string;
  restartCount: number;
  uptimeMs: number;
};

type BluetoothClearStep = {
  command: string;
  ok: boolean;
  output: string;
};

const BLUETOOTH_ADDRESS_RE = /^[0-9A-Fa-f]{2}(:[0-9A-Fa-f]{2}){5}$/;

async function pm2Snapshot(appName: string): Promise<Pm2ProcSnapshot | null> {
  const { stdout } = await execAsync("pm2 jlist");
  const list = JSON.parse(stdout);
  const proc = list.find((p: { name: string }) => p.name === appName);
  if (!proc) return null;
  return {
    pid: proc.pid ?? 0,
    status: proc.pm2_env?.status ?? "unknown",
    restartCount: proc.pm2_env?.restart_time ?? 0,
    uptimeMs: proc.pm2_env?.pm_uptime
      ? Date.now() - proc.pm2_env.pm_uptime
      : 0,
  };
}

// Clears stale BlueZ state for a BLE peripheral so the restarted server can
// reconnect cleanly. Best-effort: a non-zero rc just means the device wasn't
// in the registry, which is fine. Returns one entry per command so the FE
// can display what happened.
async function clearBluetoothDevice(
  address: string
): Promise<BluetoothClearStep[]> {
  const steps: BluetoothClearStep[] = [];
  for (const verb of ["disconnect", "remove"] as const) {
    try {
      const { stdout, stderr } = await execAsync(
        `bluetoothctl ${verb} ${address}`,
        { timeout: 5000 }
      );
      steps.push({
        command: `bluetoothctl ${verb} ${address}`,
        ok: true,
        output: (stdout + stderr).trim().slice(-200),
      });
    } catch (error: unknown) {
      const e = error as { message?: string; stdout?: string; stderr?: string };
      steps.push({
        command: `bluetoothctl ${verb} ${address}`,
        ok: false,
        output: (e.stderr || e.stdout || e.message || "").trim().slice(-200),
      });
    }
  }
  return steps;
}

export async function POST(request: Request) {
  // Optional shared-secret check. Set PM2_API_KEY (server) and
  // NEXT_PUBLIC_PM2_API_KEY (client) to the same value to require it.
  const requiredKey = process.env.PM2_API_KEY;
  if (requiredKey && request.headers.get("x-api-key") !== requiredKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json();
  const { appName, force, clearBluetoothAddresses } = body as {
    appName?: string;
    force?: boolean;
    clearBluetoothAddresses?: string[];
  };

  if (!appName) {
    return NextResponse.json(
      { error: "Missing appName in request body" },
      { status: 400 }
    );
  }

  const addressesToClear = force ? clearBluetoothAddresses ?? [] : [];
  const invalidAddresses = addressesToClear.filter(
    (addr) => !BLUETOOTH_ADDRESS_RE.test(addr)
  );
  if (invalidAddresses.length > 0) {
    return NextResponse.json(
      {
        error: `Invalid BLE address format: ${invalidAddresses.join(", ")}`,
      },
      { status: 400 }
    );
  }

  const before = await pm2Snapshot(appName);
  if (before === null) {
    const { stdout: list } = await execAsync("pm2 jlist");
    const names = JSON.parse(list).map((p: { name: string }) => p.name);
    return NextResponse.json(
      {
        error: `pm2 has no process named "${appName}"`,
        availableProcesses: names,
      },
      { status: 404 }
    );
  }

  // Clear BlueZ state BEFORE pm2 restart so that the new Python process
  // doesn't inherit a phantom-connected GATT cache from the old one.
  const bluetoothSteps: BluetoothClearStep[] = [];
  for (const addr of addressesToClear) {
    bluetoothSteps.push(...(await clearBluetoothDevice(addr)));
  }

  let stdout = "";
  let stderr = "";
  try {
    ({ stdout, stderr } = await execAsync(`pm2 restart ${appName}`));
  } catch (error: unknown) {
    const e = error as { message?: string; stdout?: string; stderr?: string };
    return NextResponse.json(
      {
        error: e.message ?? "pm2 restart failed",
        stdout: e.stdout ?? "",
        stderr: e.stderr ?? "",
        before,
        bluetoothSteps,
      },
      { status: 500 }
    );
  }

  const after = await pm2Snapshot(appName);
  const pidChanged = !!after && after.pid !== before.pid;
  const restartCountIncremented =
    !!after && after.restartCount > before.restartCount;
  const verified = pidChanged || restartCountIncremented;

  console.log("PM2 Restart:", {
    appName,
    force: !!force,
    addressesToClear,
    before,
    after,
    verified,
    bluetoothSteps,
    stdout: stdout.trim(),
    stderr: stderr.trim(),
  });

  return NextResponse.json(
    {
      message: verified
        ? `pm2 app "${appName}" restarted (pid ${before.pid} → ${after?.pid}).`
        : `pm2 reported success but pid did not change — process may not have actually restarted.`,
      verified,
      force: !!force,
      before,
      after,
      bluetoothSteps,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
    },
    { status: verified ? 200 : 500 }
  );
}
