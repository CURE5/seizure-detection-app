import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ dir: string[] }> }
) {
  let dirArr = (await params).dir;
  let dir = dirArr.join("/");
  if (!dir) {
    return new NextResponse(null, { status: 500 });
  }

  // Prevent path traversal attacks
  if (dir.indexOf("..") >= 0) {
    return new NextResponse(null, { status: 400 });
  }

  try {
    const filePath = path.join(process.cwd(), "public", dir);

    // Check if the file exists
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Determine the MIME type based on the file extension
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      ".mp4": "video/mp4",
      ".avi": "video/x-msvideo",
      ".mov": "video/quicktime",
      // Add more MIME types as needed
    };
    const contentType = mimeTypes[ext] || "application/octet-stream";

    // Read the file content
    const data = fs.readFileSync(filePath);
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;

    // Check if the client requested a Range
    const rangeHeader = req.headers.get("range");
    if (!rangeHeader) {
      // No Range header: return the full file
      const data = fs.readFileSync(filePath);
      // Return a standard 200 OK with full file
      return new NextResponse(data, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Length": fileSize.toString(),
        },
      });
    }

    // Range header found: parse it
    // Example: "bytes=1000-"
    const bytesPrefix = "bytes=";
    if (!rangeHeader.startsWith(bytesPrefix)) {
      return NextResponse.json(
        { error: "Malformed range header." },
        { status: 416 }
      );
    }

    const rangeString = rangeHeader.slice(bytesPrefix.length).trim();
    // e.g. "1000-" => start=1000, end=?
    const [startStr, endStr] = rangeString.split("-");

    let start = parseInt(startStr, 10);
    let end = endStr ? parseInt(endStr, 10) : fileSize - 1;

    // Validate range
    if (isNaN(start) || start < 0 || start >= fileSize) {
      return NextResponse.json(
        { error: "Invalid range start." },
        { status: 416 }
      );
    }
    if (isNaN(end) || end < 0 || end >= fileSize) {
      end = fileSize - 1; // If unspecified or out of range, use the file end
    }

    // Calculate the chunk size
    const chunkSize = end - start + 1;

    // Create a read stream for the requested chunk
    const stream = fs.createReadStream(filePath, { start, end });

    // Construct Content-Range header
    // E.g. "bytes 1000-1999/2000"
    const contentRange = `bytes ${start}-${end}/${fileSize}`;

    // Return 206 Partial Content response
    return new NextResponse(stream as any, {
      // Next.js 13's NextResponse expects a body as a Blob, ArrayBuffer, etc.
      // Casting stream as any is a quick hack, but see below for discussion.
      status: 206,
      headers: {
        "Content-Type": contentType,
        "Content-Length": chunkSize.toString(),
        "Content-Range": contentRange,
        "Accept-Ranges": "bytes",
      },
    });
  } catch (error) {
    console.error("Error serving file:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
