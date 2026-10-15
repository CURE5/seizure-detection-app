// app/api/pm2/restart/route.ts

import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

// Promisify exec for async/await usage
const execAsync = promisify(exec);

export async function POST(request: Request) {
  // Optional shared-secret check. Set PM2_API_KEY (server) and
  // NEXT_PUBLIC_PM2_API_KEY (client) to the same value to require it.
  const requiredKey = process.env.PM2_API_KEY;
  if (requiredKey && request.headers.get("x-api-key") !== requiredKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // **Parse Request Body**: Expecting JSON with 'appName'
  const { appName } = await request.json();

  if (!appName) {
    return NextResponse.json(
      { error: "Missing appName in request body" },
      { status: 400 }
    );
  }

  try {
    // Execute the PM2 restart command
    const { stdout, stderr } = await execAsync(`pm2 stop ${appName}`);

    if (stderr) {
      console.error("PM2 Restart Error:", stderr);
      return NextResponse.json({ error: stderr }, { status: 500 });
    }

    console.log("PM2 stop Output:", stdout);
    return NextResponse.json(
      { message: `PM2 app '${appName}' stopped successfully.` },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Execution Error:", error);
    return NextResponse.json(
      { error: error.message || "Unknown error" },
      { status: 500 }
    );
  }
}
