// app/api/pm2/restart/route.ts

import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

// Promisify exec for async/await usage
const execAsync = promisify(exec);

/**

To enable this I edited
sudo visudo
pi ALL=(ALL) NOPASSWD: /sbin/shutdown
 */
export async function POST(request: Request) {
  console.log("Received reboot request at:", new Date().toISOString());
  console.log("Request Headers:", request.headers);
  // Optional shared-secret check. Set PM2_API_KEY (server) and
  // NEXT_PUBLIC_PM2_API_KEY (client) to the same value to require it.
  const requiredKey = process.env.PM2_API_KEY;
  if (requiredKey && request.headers.get("x-api-key") !== requiredKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Execute the PM2 restart command
    const { stdout, stderr } = await execAsync(`sudo reboot`);

    if (stderr) {
      console.error("Pi reboot error:", stderr);
      return NextResponse.json({ error: stderr }, { status: 500 });
    }

    console.log("Pi reboot output:", stdout);
    return NextResponse.json({ message: `Pi rebooting` }, { status: 200 });
  } catch (error: any) {
    console.error("Execution Error:", error);
    return NextResponse.json(
      { error: error.message || "Unknown error" },
      { status: 500 }
    );
  }
}
