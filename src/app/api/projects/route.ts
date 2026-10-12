import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import {
  deleteUserProject,
  getProjectById,
  getUserProjects,
  saveUserProject,
} from "@/lib/projects";

function getAuthUser(req: NextRequest) {
  const token =
    req.cookies.get(COOKIE_NAME)?.value ||
    req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const verified = verifySessionToken(token);
  return verified.valid && verified.email ? verified : null;
}

export async function GET(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("id");

  try {
    if (projectId) {
      const project = await getProjectById(projectId, auth.email);
      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, project });
    }

    const projects = await getUserProjects(auth.email);
    return NextResponse.json({ success: true, projects });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, title, prompt, code, styleId, durationInFrames, fps, conversationHistory, renderStatus, renderId, renderBucket, renderUrl, renderSize } = body;

    if (!code) {
      return NextResponse.json({ error: "Code content is required" }, { status: 400 });
    }

    const saved = await saveUserProject({
      id,
      userEmail: auth.email,
      title,
      prompt: prompt || "Untitled Project",
      code,
      styleId,
      durationInFrames: Number(durationInFrames) || 300,
      fps: Number(fps) || 30,
      conversationHistory: Array.isArray(conversationHistory) ? conversationHistory : [],
      renderStatus,
      renderId,
      renderBucket,
      renderUrl,
      renderSize,
    });

    return NextResponse.json({ success: true, project: saved });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("id");

  if (!projectId) {
    return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
  }

  try {
    await deleteUserProject(projectId, auth.email);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
