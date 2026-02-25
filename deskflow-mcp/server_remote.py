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
from typing import Any, List, Optional
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
    version="1.2.0",
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


# --- Sendell v2 Models ---

class SendellInitRequest(BaseModel):
    user_token: str
    instance_id: str
    instance_name: str = "Sendell"

class SendellContextRequest(BaseModel):
    user_token: str
    instance_id: str
    include_knowledge: bool = True
    include_recent_conversations: int = 5
    include_tasks: bool = True
    max_content_length: int = 500

# =============================================================================
# HEALTH CHECK (for UptimeRobot)
# =============================================================================

@app.get("/")
async def root():
    """Root endpoint - shows server info."""
    return {
        "service": "DeskFlow MCP Remote Server",
        "version": "1.2.0",
        "status": "running",
        "endpoints": {
            "health": "/health",
            "api_docs": "/docs",
            "mcp_sse": "/mcp/sse",
            "rest_api": "/api/*",
            "sendell_init": "/api/v2/sendell/init",
            "sendell_context": "/api/v2/sendell/context",
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
# SENDELL v2 API ENDPOINTS
# =============================================================================

# Standard desktop names for Sendell Hub hierarchy
SENDELL_DESKTOP_NAMES = {
    "hub": "Sendell Hub",
    "conversations": "Conversations",
    "knowledge": "Knowledge Base",
    "tasks": "Tasks & Calendar",
    "system": "System",
}


async def _get_default_workspace_id(client: Client) -> str:
    """Get the default workspace ID for the authenticated user."""
    workspace = client.table("workspaces") \
        .select("id") \
        .eq("is_default", True) \
        .is_("deleted_at", "null") \
        .single() \
        .execute()
    if not workspace.data:
        raise HTTPException(status_code=404, detail="No default workspace found")
    return workspace.data["id"]


async def _get_next_position_order(client: Client, workspace_id: str) -> int:
    """Get the next available position_order for a workspace."""
    result = client.table("desktops") \
        .select("position_order") \
        .eq("workspace_id", workspace_id) \
        .order("position_order", desc=True) \
        .limit(1) \
        .execute()
    if result.data:
        return result.data[0]["position_order"] + 1
    return 0


def _hub_name(instance_name: str) -> str:
    return f"{SENDELL_DESKTOP_NAMES['hub']} — {instance_name}"


def _sub_name(key: str, instance_name: str) -> str:
    return f"{SENDELL_DESKTOP_NAMES[key]} — {instance_name}"


@app.post("/api/v2/sendell/init")
async def sendell_init(request: SendellInitRequest):
    """
    Bootstrap the Sendell Hub desktop hierarchy for a Sendell instance.
    Idempotent: returns existing IDs if already initialized.

    Creates:
      - Sendell Hub — {instance_name}  (root)
        - Conversations — {instance_name}
        - Knowledge Base — {instance_name}
        - Tasks & Calendar — {instance_name}
        - System — {instance_name}
    """
    client = await get_supabase_client(request.user_token)
    workspace_id = await _get_default_workspace_id(client)
    hub_name = _hub_name(request.instance_name)

    # Check if Sendell Hub already exists
    existing = client.table("desktops") \
        .select("id, name, parent_id") \
        .eq("workspace_id", workspace_id) \
        .ilike("name", hub_name) \
        .execute()

    if existing.data:
        # Already initialized — find child desktops
        hub_id = existing.data[0]["id"]
        children = client.table("desktops") \
            .select("id, name") \
            .eq("workspace_id", workspace_id) \
            .eq("parent_id", hub_id) \
            .execute()

        child_map = {d["name"]: d["id"] for d in (children.data or [])}

        return {
            "status": "already_initialized",
            "workspace_id": workspace_id,
            "instance_id": request.instance_id,
            "sendell_hub": {
                "desktop_id": hub_id,
                "conversations_desktop_id": child_map.get(
                    _sub_name("conversations", request.instance_name)
                ),
                "knowledge_desktop_id": child_map.get(
                    _sub_name("knowledge", request.instance_name)
                ),
                "tasks_desktop_id": child_map.get(
                    _sub_name("tasks", request.instance_name)
                ),
                "system_desktop_id": child_map.get(
                    _sub_name("system", request.instance_name)
                ),
            }
        }

    # Create the hierarchy
    pos = await _get_next_position_order(client, workspace_id)

    # 1. Create Hub root desktop
    hub_result = client.table("desktops") \
        .insert({
            "workspace_id": workspace_id,
            "name": hub_name,
            "parent_id": None,
            "position_order": pos,
        }) \
        .execute()

    if not hub_result.data:
        raise HTTPException(status_code=500, detail="Failed to create Sendell Hub desktop")

    hub_id = hub_result.data[0]["id"]

    # 2. Create child desktops
    child_keys = ["conversations", "knowledge", "tasks", "system"]
    child_ids = {}

    for i, key in enumerate(child_keys):
        child_result = client.table("desktops") \
            .insert({
                "workspace_id": workspace_id,
                "name": _sub_name(key, request.instance_name),
                "parent_id": hub_id,
                "position_order": pos + 1 + i,
            }) \
            .execute()

        if child_result.data:
            child_ids[key] = child_result.data[0]["id"]

    # 3. Create folders on Hub linking to children
    for key, child_id in child_ids.items():
        folder_x = 100 + (list(child_ids.keys()).index(key) % 2) * 250
        folder_y = 100 + (list(child_ids.keys()).index(key) // 2) * 200
        client.table("folders") \
            .insert({
                "desktop_id": hub_id,
                "target_desktop_id": child_id,
                "name": SENDELL_DESKTOP_NAMES[key],
                "position_x": folder_x,
                "position_y": folder_y,
                "icon": None,
                "color": "#00ff41",
            }) \
            .execute()

    # 4. Create initial system note
    if "system" in child_ids:
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).isoformat()
        client.table("notes") \
            .insert({
                "desktop_id": child_ids["system"],
                "title": f"Instance Config — {request.instance_name}",
                "content": (
                    f"---\n"
                    f"sendell_type: system\n"
                    f"sendell_instance: {request.instance_id}\n"
                    f"instance_name: {request.instance_name}\n"
                    f"initialized_at: {now}\n"
                    f"---\n\n"
                    f"# Sendell Integration\n\n"
                    f"**Instance**: {request.instance_name} ({request.instance_id})\n"
                    f"**Connected**: {now[:10]}\n"
                    f"**Status**: Active\n"
                ),
                "color": "#333333",
                "position_x": 100,
                "position_y": 100,
                "width": 350,
                "height": 250,
                "z_index": 1,
            }) \
            .execute()

    return {
        "status": "initialized",
        "workspace_id": workspace_id,
        "instance_id": request.instance_id,
        "sendell_hub": {
            "desktop_id": hub_id,
            "conversations_desktop_id": child_ids.get("conversations"),
            "knowledge_desktop_id": child_ids.get("knowledge"),
            "tasks_desktop_id": child_ids.get("tasks"),
            "system_desktop_id": child_ids.get("system"),
        }
    }


@app.post("/api/v2/sendell/context")
async def sendell_context(request: SendellContextRequest):
    """
    Single-call context retrieval optimized for Sendell.
    Returns knowledge notes, recent conversations, and tasks from the
    Sendell Hub hierarchy for the specified instance.
    """
    client = await get_supabase_client(request.user_token)
    workspace_id = await _get_default_workspace_id(client)

    # Find Sendell Hub desktops for this instance
    all_desktops = client.table("desktops") \
        .select("id, name, parent_id") \
        .eq("workspace_id", workspace_id) \
        .execute()

    desktop_list = all_desktops.data or []

    # Find hub by name pattern
    hub_name = _hub_name(request.instance_id)
    hub = None
    for d in desktop_list:
        if d["name"] and hub_name.lower() in d["name"].lower():
            hub = d
            break

    # If not found by instance_id, try by common patterns
    if not hub:
        for d in desktop_list:
            if d["name"] and "sendell hub" in d["name"].lower():
                hub = d
                break

    if not hub:
        return {
            "status": "not_initialized",
            "message": "Sendell Hub not found. Call /api/v2/sendell/init first.",
            "workspace_id": workspace_id,
            "knowledge": [],
            "recent_conversations": [],
            "tasks": [],
            "stats": {
                "total_notes": 0,
                "sendell_notes": 0,
                "last_sync": None,
            }
        }

    hub_id = hub["id"]

    # Find child desktops
    children = {d["name"]: d["id"] for d in desktop_list if d["parent_id"] == hub_id}

    # Resolve desktop IDs
    knowledge_id = None
    conversations_id = None
    tasks_id = None

    for name, did in children.items():
        name_lower = name.lower() if name else ""
        if "knowledge" in name_lower:
            knowledge_id = did
        elif "conversation" in name_lower:
            conversations_id = did
        elif "task" in name_lower or "calendar" in name_lower:
            tasks_id = did

    # Collect all Sendell desktop IDs for stats
    sendell_desktop_ids = [hub_id] + list(children.values())

    # Build response
    knowledge = []
    recent_conversations = []
    tasks = []
    max_len = request.max_content_length

    # Knowledge notes
    if request.include_knowledge and knowledge_id:
        k_result = client.table("notes") \
            .select("id, title, content, color, updated_at") \
            .eq("desktop_id", knowledge_id) \
            .order("updated_at", desc=True) \
            .execute()

        for note in (k_result.data or []):
            content = note.get("content") or ""
            knowledge.append({
                "id": note["id"],
                "title": note["title"],
                "content_preview": content[:max_len] if max_len > 0 else "",
                "full_length": len(content),
                "updated_at": note["updated_at"],
            })

    # Recent conversations
    if request.include_recent_conversations > 0 and conversations_id:
        # Get conversations desktop and any monthly sub-desktops
        conv_children = [d["id"] for d in desktop_list if d["parent_id"] == conversations_id]
        conv_desktop_ids = [conversations_id] + conv_children

        c_result = client.table("notes") \
            .select("id, title, content, color, updated_at") \
            .in_("desktop_id", conv_desktop_ids) \
            .order("updated_at", desc=True) \
            .limit(request.include_recent_conversations) \
            .execute()

        for note in (c_result.data or []):
            content = note.get("content") or ""
            recent_conversations.append({
                "id": note["id"],
                "title": note["title"],
                "content_preview": content[:max_len] if max_len > 0 else "",
                "full_length": len(content),
                "updated_at": note["updated_at"],
            })

    # Tasks
    if request.include_tasks and tasks_id:
        t_result = client.table("notes") \
            .select("id, title, content, color, updated_at") \
            .eq("desktop_id", tasks_id) \
            .order("updated_at", desc=True) \
            .execute()

        for note in (t_result.data or []):
            content = note.get("content") or ""
            tasks.append({
                "id": note["id"],
                "title": note["title"],
                "content_preview": content[:max_len] if max_len > 0 else "",
                "full_length": len(content),
                "updated_at": note["updated_at"],
            })

    # Stats
    sendell_notes_count = 0
    if sendell_desktop_ids:
        stats_result = client.table("notes") \
            .select("id", count="exact") \
            .in_("desktop_id", sendell_desktop_ids) \
            .execute()
        sendell_notes_count = stats_result.count or 0

    total_notes_result = client.table("notes") \
        .select("id", count="exact") \
        .in_("desktop_id", [d["id"] for d in desktop_list]) \
        .execute()
    total_notes_count = total_notes_result.count or 0

    return {
        "status": "ok",
        "workspace_id": workspace_id,
        "instance_id": request.instance_id,
        "sendell_hub": {
            "desktop_id": hub_id,
            "conversations_desktop_id": conversations_id,
            "knowledge_desktop_id": knowledge_id,
            "tasks_desktop_id": tasks_id,
        },
        "knowledge": knowledge,
        "recent_conversations": recent_conversations,
        "tasks": tasks,
        "stats": {
            "total_notes": total_notes_count,
            "sendell_notes": sendell_notes_count,
            "knowledge_count": len(knowledge),
            "conversations_count": len(recent_conversations),
            "tasks_count": len(tasks),
        }
    }


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
