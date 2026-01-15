#!/usr/bin/env python3
"""
DeskFlow MCP Server - REMOTE VERSION (Render/Cloud)
====================================================
Servidor MCP remoto que funciona con:
1. Claude Desktop (vía SSE/Streamable HTTP)
2. Sendell u otros sistemas (vía REST API)

Deploy: Render, Railway, Fly.io, etc.
"""

import os
import json
import asyncio
from typing import Any, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Supabase imports
from supabase import create_client, Client

# =============================================================================
# CONFIGURATION
# =============================================================================

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
API_SECRET_KEY = os.getenv("API_SECRET_KEY", "change-me-in-production")

if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY are required")

# =============================================================================
# AUTH HELPERS
# =============================================================================

async def get_supabase_client(user_token: str) -> Client:
    """
    Create authenticated Supabase client using user's refresh token.
    """
    client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

    try:
        # Try to refresh the session with the user's token
        response = client.auth.refresh_session(user_token)
        if response and response.user:
            return client
        raise ValueError("Invalid token")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")


def verify_api_key(x_api_key: str = Header(None)) -> bool:
    """
    Verify API key for REST endpoints (used by Sendell, etc.)
    """
    if not x_api_key:
        raise HTTPException(status_code=401, detail="X-API-Key header required")
    if x_api_key != API_SECRET_KEY:
        raise HTTPException(status_code=403, detail="Invalid API key")
    return True


# =============================================================================
# FASTAPI APP
# =============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    print("🚀 DeskFlow MCP Remote Server starting...")
    print(f"📡 Supabase URL: {SUPABASE_URL[:30]}...")
    yield
    print("👋 Server shutting down...")

app = FastAPI(
    title="DeskFlow MCP Remote Server",
    description="MCP Server for DeskFlow - Works with Claude Desktop and REST API for Sendell",
    version="1.1.0",
    lifespan=lifespan
)

# CORS for web access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class WorkspaceIndexRequest(BaseModel):
    user_token: str
    workspace_id: Optional[str] = None
    include_content: bool = False

class SearchRequest(BaseModel):
    user_token: str
    workspace_id: str
    query: str
    limit: int = 20

class NoteCreateRequest(BaseModel):
    user_token: str
    desktop_id: str
    title: str
    content: str = ""
    color: str = "#00ff41"

# =============================================================================
# HEALTH CHECK (for UptimeRobot)
# =============================================================================

@app.get("/")
async def root():
    """Root endpoint - shows server info."""
    return {
        "service": "DeskFlow MCP Remote Server",
        "version": "1.1.0",
        "status": "running",
        "endpoints": {
            "health": "/health",
            "api_docs": "/docs",
            "mcp_sse": "/mcp/sse",
            "rest_api": "/api/*"
        }
    }

@app.get("/health")
async def health_check():
    """Health check for UptimeRobot and monitoring."""
    return {"status": "healthy", "service": "deskflow-mcp"}

# =============================================================================
# REST API ENDPOINTS (for Sendell and other systems)
# =============================================================================

@app.post("/api/workspace-index")
async def api_workspace_index(request: WorkspaceIndexRequest):
    """
    Get complete workspace index.
    Used by Sendell to understand user's projects and notes.
    """
    client = await get_supabase_client(request.user_token)

    # Get default workspace if not specified
    if not request.workspace_id:
        workspace = client.table("workspaces") \
            .select("id") \
            .eq("is_default", True) \
            .is_("deleted_at", "null") \
            .single() \
            .execute()
        if not workspace.data:
            raise HTTPException(status_code=404, detail="No default workspace found")
        workspace_id = workspace.data["id"]
    else:
        workspace_id = request.workspace_id

    # Get workspace info
    workspace = client.table("workspaces") \
        .select("id, name, description, created_at") \
        .eq("id", workspace_id) \
        .is_("deleted_at", "null") \
        .single() \
        .execute()

    if not workspace.data:
        raise HTTPException(status_code=404, detail="Workspace not found")

    # Get all desktops
    desktops = client.table("desktops") \
        .select("id, name, parent_id, position_order") \
        .eq("workspace_id", workspace_id) \
        .order("position_order") \
        .execute()

    desktop_list = desktops.data or []
    desktop_ids = [d["id"] for d in desktop_list]

    if not desktop_ids:
        return {
            "workspace": workspace.data,
            "desktops": [],
            "notes": [],
            "folders": [],
            "stats": {"desktops": 0, "notes": 0, "folders": 0}
        }

    # Get all notes
    note_fields = "id, title, desktop_id, updated_at"
    if request.include_content:
        note_fields += ", content"

    notes = client.table("notes") \
        .select(note_fields) \
        .in_("desktop_id", desktop_ids) \
        .execute()

    # Get all folders
    folders = client.table("folders") \
        .select("id, name, desktop_id, target_desktop_id") \
        .in_("desktop_id", desktop_ids) \
        .execute()

    return {
        "workspace": workspace.data,
        "desktops": desktop_list,
        "notes": notes.data or [],
        "folders": folders.data or [],
        "stats": {
            "desktops": len(desktop_list),
            "notes": len(notes.data or []),
            "folders": len(folders.data or [])
        }
    }


@app.post("/api/search")
async def api_search(request: SearchRequest):
    """
    Search notes by title or content.
    Useful for Sendell to find specific project information.
    """
    client = await get_supabase_client(request.user_token)

    # Get desktops in workspace
    desktops = client.table("desktops") \
        .select("id") \
        .eq("workspace_id", request.workspace_id) \
        .execute()

    if not desktops.data:
        return {"results": [], "count": 0}

    desktop_ids = [d["id"] for d in desktops.data]

    # Search by title
    title_results = client.table("notes") \
        .select("id, title, content, desktop_id, updated_at") \
        .in_("desktop_id", desktop_ids) \
        .ilike("title", f"%{request.query}%") \
        .limit(request.limit) \
        .execute()

    # Search by content
    content_results = client.table("notes") \
        .select("id, title, content, desktop_id, updated_at") \
        .in_("desktop_id", desktop_ids) \
        .ilike("content", f"%{request.query}%") \
        .limit(request.limit) \
        .execute()

    # Merge and deduplicate
    seen = set()
    results = []
    for note in (title_results.data or []) + (content_results.data or []):
        if note["id"] not in seen:
            seen.add(note["id"])
            results.append(note)

    return {"results": results[:request.limit], "count": len(results)}


@app.post("/api/note")
async def api_create_note(request: NoteCreateRequest):
    """
    Create a new note.
    Useful for Sendell to save conversation summaries or insights.
    """
    client = await get_supabase_client(request.user_token)

    note_data = {
        "desktop_id": request.desktop_id,
        "title": request.title,
        "content": request.content,
        "color": request.color,
        "position_x": 100,
        "position_y": 100,
        "width": 300,
        "height": 200,
        "z_index": 1
    }

    result = client.table("notes") \
        .insert(note_data) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create note")

    return {"success": True, "note": result.data[0]}


@app.get("/api/note/{note_id}")
async def api_get_note(note_id: str, user_token: str = Query(...)):
    """
    Get a specific note by ID.
    """
    client = await get_supabase_client(user_token)

    result = client.table("notes") \
        .select("id, title, content, desktop_id, color, updated_at, created_at") \
        .eq("id", note_id) \
        .single() \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Note not found")

    return result.data


@app.get("/api/recent-notes")
async def api_recent_notes(
    user_token: str = Query(...),
    workspace_id: str = Query(None),
    limit: int = Query(10)
):
    """
    Get most recently updated notes.
    Useful for Sendell to know what user is working on.
    """
    client = await get_supabase_client(user_token)

    # Get default workspace if not specified
    if not workspace_id:
        workspace = client.table("workspaces") \
            .select("id") \
            .eq("is_default", True) \
            .is_("deleted_at", "null") \
            .single() \
            .execute()
        if not workspace.data:
            raise HTTPException(status_code=404, detail="No default workspace")
        workspace_id = workspace.data["id"]

    # Get desktops
    desktops = client.table("desktops") \
        .select("id") \
        .eq("workspace_id", workspace_id) \
        .execute()

    if not desktops.data:
        return {"notes": [], "count": 0}

    desktop_ids = [d["id"] for d in desktops.data]

    # Get recent notes
    notes = client.table("notes") \
        .select("id, title, desktop_id, updated_at") \
        .in_("desktop_id", desktop_ids) \
        .order("updated_at", desc=True) \
        .limit(limit) \
        .execute()

    return {"notes": notes.data or [], "count": len(notes.data or [])}


# =============================================================================
# MCP SSE ENDPOINT (for Claude Desktop)
# =============================================================================

@app.get("/mcp/sse")
async def mcp_sse_endpoint(user_token: str = Query(...)):
    """
    SSE endpoint for MCP protocol.
    Claude Desktop connects here for real-time communication.
    """
    # Validate token first
    await get_supabase_client(user_token)

    async def event_generator():
        # Send initial connection event
        yield f"data: {json.dumps({'type': 'connection', 'status': 'connected'})}\n\n"

        # Keep connection alive
        while True:
            await asyncio.sleep(30)
            yield f"data: {json.dumps({'type': 'ping'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


# =============================================================================
# MAIN
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
