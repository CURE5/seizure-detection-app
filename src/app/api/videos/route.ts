// app/api/videos/route.ts

import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// Define the allowed video file extensions
const ALLOWED_EXTENSIONS = [".mp4", ".avi", ".mov", ".mkv"];

// Define the type for a video file's metadata
interface VideoFile {
  name: string;
  url: string;
  size: number; // in bytes
  createdAt: string; // ISO string
}

const setCorsHeaders = (response: NextResponse) => {
  // Replace '*' with your specific origin in production for better security
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
};

// Handler for GET requests
export async function GET(request: Request) {
  try {
    // Define the path to the 'recorded_videos' directory
    const videosDirectory = path.join(
      process.cwd(),
      "public",
      "recorded_video"
    );

    // Check if the directory exists
    try {
      await fs.access(videosDirectory);
    } catch (error) {
      const response = NextResponse.json(
        { error: "Recorded videos directory not found." },
        { status: 404 }
      );
      return setCorsHeaders(response);
    }

    // Read all files in the directory
    const files = await fs.readdir(videosDirectory);

    // Filter out only video files based on their extension
    const videoFiles: VideoFile[] = [];

    for (const file of files) {
      const fileExt = path.extname(file).toLowerCase();
      if (ALLOWED_EXTENSIONS.includes(fileExt)) {
        const filePath = path.join(videosDirectory, file);
        const stats = await fs.stat(filePath);

        // Extract date from filename: video_YYYYMMDD_HHMMSS.mp4
        let createdAt = stats.birthtime.toISOString(); // fallback to file creation date
        const dateMatch = file.match(/video_(\d{8})_(\d{6})/);
        if (dateMatch) {
          const dateStr = dateMatch[1]; // YYYYMMDD
          const timeStr = dateMatch[2]; // HHMMSS
          // Parse: YYYYMMDD -> YYYY-MM-DD, HHMMSS -> HH:MM:SS
          const year = dateStr.substring(0, 4);
          const month = dateStr.substring(4, 6);
          const day = dateStr.substring(6, 8);
          const hour = timeStr.substring(0, 2);
          const minute = timeStr.substring(2, 4);
          const second = timeStr.substring(4, 6);
          createdAt = new Date(
            `${year}-${month}-${day}T${hour}:${minute}:${second}`
          ).toISOString();
        }

        videoFiles.push({
          name: file,
          url: `/api/videos/recorded_video/${encodeURIComponent(file)}`,
          size: stats.size,
          createdAt: createdAt,
        });
      }
    }

    // Optionally, sort videos by creation date (newest first)
    videoFiles.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    // ... existing code ...

    // Calculate start and end indices
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedVideos = videoFiles.slice(start, end);

    const response = NextResponse.json(
      { videos: paginatedVideos, page, total: videoFiles.length },
      { status: 200 }
    );
    return setCorsHeaders(response);
  } catch (error) {
    console.error("Error listing videos:", error);
    const response = NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
    return setCorsHeaders(response);
  }
}

// Handler for OPTIONS requests (Preflight)
export async function OPTIONS(request: Request) {
  const response = NextResponse.json({}, { status: 200 });
  return setCorsHeaders(response);
}
