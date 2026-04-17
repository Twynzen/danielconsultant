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
from datetime import datetime, timedelta, timezone
from typing import Any, List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Supabase imports
from supabase import create_client, Client

# Agent API key auth (Phase 4 — Intelligence Engine)
from api_keys import (
    generate_key,
    hash_key,
    log_api_call,
    require_scope,
    supabase_for_user,
    verify_api_key,
)

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
        "version": "1.3.0",
        "status": "running",
        "endpoints": {
            "health": "/health",
            "api_docs": "/docs",
            "mcp_sse": "/mcp/sse",
            "rest_api": "/api/*",
            "sendell_init": "/api/v2/sendell/init",
            "sendell_context": "/api/v2/sendell/context",
            "agent_briefing": "/api/agent/briefing",
            "agent_ingest": "/api/agent/ingest",
            "agent_ingest_ics": "/api/agent/ingest-ics",
            "agent_priorities": "/api/agent/priorities",
            "agent_keys": "/api/agent/keys",
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
# AGENT API — Multi-agent endpoints authenticated via X-API-Key
# =============================================================================
#
# These routes are designed for ANY agent (Claude, GPT, Gemini, n8n, Make,
# Zapier, custom code) — not Sendell-specific. Authentication is per-API-key
# so each integration has its own scopes, rate limit, and audit trail.

# ---------- Pydantic ----------------------------------------------------------

class ApiKeyCreateRequest(BaseModel):
    user_token: str
    name: str = Field(..., min_length=1, max_length=80)
    scopes: List[str] = Field(default_factory=lambda: ["read"])
    rate_limit: int = 60


class ApiKeyListRequest(BaseModel):
    user_token: str


class IngestNoteRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    content: str = ""
    type: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[int] = None
    tags: Optional[List[str]] = None
    due_date: Optional[str] = None
    source: Optional[str] = None
    desktop_id: Optional[str] = None
    workspace_id: Optional[str] = None


class BriefingRequest(BaseModel):
    workspace_id: Optional[str] = None
    max_priorities: int = 10
    max_recent: int = 20
    upcoming_window_hours: int = 48
    stale_threshold_days: int = 14


class IcsIngestRequest(BaseModel):
    # Raw ICS feed (VCALENDAR text). Can be a pasted export or the body of an
    # http-accessible .ics URL — we don't fetch it ourselves so the caller
    # stays in control of whatever auth the feed needs.
    ics: str
    workspace_id: Optional[str] = None
    target_desktop_id: Optional[str] = None
    connector_id: Optional[str] = None
    # Only ingest events that start on or after this cutoff. Defaults to
    # today so past meetings don't flood the workspace.
    start_after: Optional[str] = None
    # Safety cap per ingestion call.
    max_events: int = 100


# ---------- Helpers ----------------------------------------------------------

VALID_TYPES = {"note", "task", "project", "reference", "contact",
               "meeting", "idea", "log"}
VALID_STATUSES = {"active", "inactive", "completed", "archived", "blocked"}
VALID_SCOPES = {"read", "write", "admin"}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _parse_iso(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _resolve_default_workspace(client: Client, user_id: str) -> str:
    ws = client.table("workspaces") \
        .select("id") \
        .eq("user_id", user_id) \
        .eq("is_default", True) \
        .is_("deleted_at", "null") \
        .single() \
        .execute()
    if not ws.data:
        raise HTTPException(status_code=404, detail="No default workspace for user")
    return ws.data["id"]


def _score_briefing_note(note: dict, now: datetime, degree: int):
    metadata = note.get("metadata") or {}
    reasons: List[str] = []
    score = 0.0

    status = metadata.get("status")
    if status in ("archived", "completed"):
        return -1.0, [status]
    if status == "blocked":
        score += 5
        reasons.append("blocked")
    if status == "active":
        score += 2

    priority = metadata.get("priority")
    if isinstance(priority, int) and 1 <= priority <= 5:
        score += (6 - priority) * 1.5
        if priority <= 2:
            reasons.append(f"priority {priority}")

    due = _parse_iso(metadata.get("dueDate"))
    if due is not None:
        delta_h = (due - now).total_seconds() / 3600
        if delta_h < 0:
            score += 8
            reasons.append("overdue")
        elif delta_h <= 24:
            score += 6
            reasons.append("due today")
        elif delta_h <= 72:
            score += 4
            reasons.append("due soon")

    note_type = metadata.get("type")
    if note_type in ("meeting", "task"):
        score += 1.5
    elif note_type == "project":
        score += 1
    elif note_type in ("reference", "log"):
        score -= 0.5

    if degree >= 5:
        score += 1.5
        reasons.append("hub")
    elif degree >= 2:
        score += 0.5

    updated = _parse_iso(note.get("updated_at"))
    if updated is not None:
        age_h = (now - updated).total_seconds() / 3600
        if age_h <= 48:
            score += 1

    return score, reasons


# ---------- API key management (uses Supabase user-token auth) ---------------

@app.post("/api/agent/keys")
async def create_api_key(request: ApiKeyCreateRequest):
    """
    Create a new API key for the authenticated user. The plaintext is
    returned ONCE — store it immediately, it cannot be retrieved later.
    """
    # Validate scopes
    invalid = [s for s in request.scopes if s not in VALID_SCOPES]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Invalid scopes: {invalid}")

    # Authenticate the human user via their refresh token
    client = await get_supabase_client(request.user_token)
    me = client.auth.get_user()
    if not me or not me.user:
        raise HTTPException(status_code=401, detail="Could not resolve user")
    user_id = me.user.id

    plaintext, prefix, digest = generate_key()

    # Store via service client so RLS policies don't fight us; the row carries
    # the user_id so the user-scoped RLS policy still applies on later reads.
    service = supabase_for_user(user_id)
    inserted = service.table("api_keys").insert({
        "user_id": user_id,
        "name": request.name,
        "key_prefix": prefix,
        "key_hash": digest,
        "scopes": request.scopes,
        "rate_limit": max(1, min(request.rate_limit, 1000)),
    }).execute()

    if not inserted.data:
        raise HTTPException(status_code=500, detail="Failed to mint API key")

    row = inserted.data[0]
    return {
        "id": row["id"],
        "name": row["name"],
        "key": plaintext,                 # SHOWN ONCE
        "key_prefix": row["key_prefix"],
        "scopes": row["scopes"],
        "rate_limit": row["rate_limit"],
        "created_at": row["created_at"],
        "warning": "Store the `key` value now. It will not be shown again.",
    }


@app.post("/api/agent/keys/list")
async def list_api_keys(request: ApiKeyListRequest):
    client = await get_supabase_client(request.user_token)
    me = client.auth.get_user()
    if not me or not me.user:
        raise HTTPException(status_code=401, detail="Could not resolve user")
    user_id = me.user.id

    service = supabase_for_user(user_id)
    rows = service.table("api_keys") \
        .select("id, name, key_prefix, scopes, rate_limit, revoked, created_at, last_used_at") \
        .eq("user_id", user_id) \
        .order("created_at", desc=True) \
        .execute()
    return {"keys": rows.data or []}


@app.delete("/api/agent/keys/{key_id}")
async def revoke_api_key(key_id: str, user_token: str = Query(...)):
    client = await get_supabase_client(user_token)
    me = client.auth.get_user()
    if not me or not me.user:
        raise HTTPException(status_code=401, detail="Could not resolve user")
    user_id = me.user.id

    service = supabase_for_user(user_id)
    service.table("api_keys") \
        .update({"revoked": True}) \
        .eq("id", key_id) \
        .eq("user_id", user_id) \
        .execute()
    return {"status": "revoked", "id": key_id}


# ---------- Agent-facing endpoints (X-API-Key auth) --------------------------

@app.post("/api/agent/briefing")
async def agent_briefing(
    request: BriefingRequest,
    api_key: dict = Depends(require_scope("read")),
):
    """
    Aggregated briefing of the user's current state — the recommended first
    call for any agent. Returns priorities, blocked items, projects,
    upcoming meetings, recent activity, stale items and a weekly summary.
    """
    user_id = api_key["user_id"]
    service = supabase_for_user(user_id)
    workspace_id = request.workspace_id or _resolve_default_workspace(service, user_id)

    # Pull desktops + notes + connections for the workspace.
    desktops = service.table("desktops") \
        .select("id, name") \
        .eq("workspace_id", workspace_id) \
        .execute()
    desktop_rows = desktops.data or []
    desktop_ids = [d["id"] for d in desktop_rows]
    desktop_lookup = {d["id"]: d for d in desktop_rows}

    notes_rows = []
    if desktop_ids:
        notes_q = service.table("notes") \
            .select("id, title, desktop_id, color, metadata, created_at, updated_at") \
            .in_("desktop_id", desktop_ids) \
            .execute()
        notes_rows = notes_q.data or []
        for n in notes_rows:
            n["_desktop"] = desktop_lookup.get(n["desktop_id"])
            n["metadata"] = n.get("metadata") or {}

    degree: dict[str, int] = {}
    if desktop_ids:
        conns = service.table("connections") \
            .select("from_note_id, to_note_id") \
            .in_("desktop_id", desktop_ids) \
            .execute()
        for c in conns.data or []:
            degree[c["from_note_id"]] = degree.get(c["from_note_id"], 0) + 1
            degree[c["to_note_id"]] = degree.get(c["to_note_id"], 0) + 1

    now = _utcnow()
    upcoming_cutoff = now + timedelta(hours=request.upcoming_window_hours)
    stale_cutoff = now - timedelta(days=request.stale_threshold_days)
    week_ago = now - timedelta(days=7)

    priorities, active_projects, blocked_items, upcoming_meetings = [], [], [], []
    stale_items = []
    completed_week = new_week = 0

    for n in notes_rows:
        m = n["metadata"]
        score, reasons = _score_briefing_note(n, now, degree.get(n["id"], 0))
        if score >= 0:
            priorities.append({
                "id": n["id"], "title": n["title"],
                "desktop_name": (n["_desktop"] or {}).get("name"),
                "metadata": m, "score": round(score, 2), "reasons": reasons,
            })

        if m.get("type") == "project" and m.get("status") == "active":
            active_projects.append({
                "id": n["id"], "title": n["title"],
                "progress": m.get("progress"), "tags": m.get("tags") or [],
                "updated_at": n.get("updated_at"),
            })
        if m.get("status") == "blocked":
            blocked_items.append({
                "id": n["id"], "title": n["title"], "type": m.get("type"),
            })
        if m.get("type") == "meeting":
            due = _parse_iso(m.get("dueDate"))
            if due is not None and now <= due <= upcoming_cutoff:
                upcoming_meetings.append({
                    "id": n["id"], "title": n["title"], "due_date": m.get("dueDate"),
                })

        updated = _parse_iso(n.get("updated_at"))
        created = _parse_iso(n.get("created_at"))
        if m.get("type") in ("task", "project") \
                and m.get("status") not in ("completed", "archived"):
            anchor = _parse_iso(m.get("lastReviewedAt")) or updated
            if anchor is not None and anchor < stale_cutoff:
                stale_items.append({
                    "id": n["id"], "title": n["title"],
                    "days_since": (now - anchor).days,
                })

        if updated is not None and updated >= week_ago:
            if m.get("status") == "completed":
                completed_week += 1
            if created is not None and created >= week_ago:
                new_week += 1

    priorities.sort(key=lambda x: x["score"], reverse=True)
    upcoming_meetings.sort(key=lambda x: x["due_date"] or "")
    stale_items.sort(key=lambda x: x["days_since"], reverse=True)
    recent = sorted(notes_rows, key=lambda r: r.get("updated_at") or "",
                    reverse=True)[:request.max_recent]
    recent_activity = [{
        "id": r["id"], "title": r["title"],
        "desktop_name": (r["_desktop"] or {}).get("name"),
        "updated_at": r.get("updated_at"),
        "type": r["metadata"].get("type"),
        "status": r["metadata"].get("status"),
    } for r in recent]

    log_api_call(api_key, "briefing.read", "agent_briefing")

    return {
        "date": now.date().isoformat(),
        "generated_at": now.isoformat(),
        "workspace_id": workspace_id,
        "priorities_today": priorities[:request.max_priorities],
        "active_projects": active_projects,
        "blocked_items": blocked_items,
        "upcoming_meetings": upcoming_meetings,
        "recent_activity": recent_activity,
        "stale_items": stale_items[:20],
        "weekly_summary": {
            "completed": completed_week,
            "new": new_week,
            "window_start": week_ago.isoformat(),
            "window_end": now.isoformat(),
        },
        "totals": {
            "notes": len(notes_rows),
            "active_projects": len(active_projects),
            "blocked": len(blocked_items),
        },
    }


@app.post("/api/agent/ingest")
async def agent_ingest(
    request: IngestNoteRequest,
    api_key: dict = Depends(require_scope("write")),
):
    """
    Generic ingestion endpoint. Any service (Slack bot, n8n workflow,
    cron job, custom agent) can POST here to create a note with metadata.
    """
    if request.type and request.type not in VALID_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid type: {request.type}")
    if request.status and request.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status: {request.status}")
    if request.priority is not None and not (1 <= request.priority <= 5):
        raise HTTPException(status_code=400, detail="priority must be 1..5")
    if request.due_date and _parse_iso(request.due_date) is None:
        raise HTTPException(status_code=400, detail="due_date must be ISO-8601")

    user_id = api_key["user_id"]
    service = supabase_for_user(user_id)
    workspace_id = request.workspace_id or _resolve_default_workspace(service, user_id)

    desktop_id = request.desktop_id
    if not desktop_id:
        first = service.table("desktops") \
            .select("id") \
            .eq("workspace_id", workspace_id) \
            .order("position_order") \
            .limit(1) \
            .execute()
        if not first.data:
            raise HTTPException(status_code=404, detail="Workspace has no desktops")
        desktop_id = first.data[0]["id"]
    else:
        # Confirm the desktop belongs to a workspace owned by this user.
        check = service.table("desktops") \
            .select("workspace_id") \
            .eq("id", desktop_id) \
            .single() \
            .execute()
        if not check.data:
            raise HTTPException(status_code=404, detail="desktop_id not found")
        owner = service.table("workspaces") \
            .select("user_id") \
            .eq("id", check.data["workspace_id"]) \
            .single() \
            .execute()
        if not owner.data or owner.data["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="desktop_id does not belong to caller")

    metadata: dict[str, Any] = {
        "source": request.source or f"api:{api_key['name']}",
    }
    if request.type:
        metadata["type"] = request.type
    if request.status:
        metadata["status"] = request.status
    if request.priority is not None:
        metadata["priority"] = request.priority
    if request.tags:
        metadata["tags"] = request.tags
    if request.due_date:
        metadata["dueDate"] = request.due_date

    inserted = service.table("notes").insert({
        "desktop_id": desktop_id,
        "title": request.title.strip(),
        "content": request.content,
        "position_x": 100,
        "position_y": 100,
        "width": 300,
        "height": 200,
        "color": "#0c2a18",
        "z_index": 1,
        "minimized": False,
        "metadata": metadata,
    }).execute()

    if not inserted.data:
        raise HTTPException(status_code=500, detail="Failed to ingest note")

    row = inserted.data[0]
    log_api_call(api_key, "note.create", "agent_ingest", resource_id=row["id"])
    return {"status": "ok", "note": row}


@app.get("/api/agent/priorities")
async def agent_priorities(
    workspace_id: Optional[str] = None,
    max_items: int = 20,
    api_key: dict = Depends(require_scope("read")),
):
    """
    Lightweight priorities endpoint — the briefing's top section without the
    rest of the payload. Useful for status-bar style integrations.
    """
    user_id = api_key["user_id"]
    service = supabase_for_user(user_id)
    wid = workspace_id or _resolve_default_workspace(service, user_id)
    max_items = min(max(1, max_items), 100)

    desktops = service.table("desktops") \
        .select("id, name") \
        .eq("workspace_id", wid) \
        .execute()
    desktop_rows = desktops.data or []
    desktop_ids = [d["id"] for d in desktop_rows]
    desktop_lookup = {d["id"]: d for d in desktop_rows}
    if not desktop_ids:
        return {"workspace_id": wid, "items": []}

    notes_q = service.table("notes") \
        .select("id, title, desktop_id, metadata, updated_at") \
        .in_("desktop_id", desktop_ids) \
        .execute()
    rows = notes_q.data or []

    conns = service.table("connections") \
        .select("from_note_id, to_note_id") \
        .in_("desktop_id", desktop_ids) \
        .execute()
    degree: dict[str, int] = {}
    for c in conns.data or []:
        degree[c["from_note_id"]] = degree.get(c["from_note_id"], 0) + 1
        degree[c["to_note_id"]] = degree.get(c["to_note_id"], 0) + 1

    now = _utcnow()
    scored: list[dict[str, Any]] = []
    for n in rows:
        n["_desktop"] = desktop_lookup.get(n["desktop_id"])
        n["metadata"] = n.get("metadata") or {}
        score, reasons = _score_briefing_note(n, now, degree.get(n["id"], 0))
        if score < 0:
            continue
        scored.append({
            "id": n["id"], "title": n["title"],
            "desktop_name": n["_desktop"]["name"] if n["_desktop"] else None,
            "metadata": n["metadata"],
            "score": round(score, 2),
            "reasons": reasons,
        })

    scored.sort(key=lambda r: r["score"], reverse=True)
    log_api_call(api_key, "priorities.read", "agent_priorities")
    return {"workspace_id": wid, "items": scored[:max_items]}


# ---------- ICS (Google Calendar / iCal) ingestion ---------------------------
#
# Rather than implementing OAuth against every calendar provider, we accept
# the raw ICS feed and parse it here. Any provider exposing an ICS URL works
# (Google, Outlook, Apple, Fastmail, CalDAV, ...). The caller passes the ICS
# body it already has — this keeps provider auth out of the MCP server.

def _ics_unfold(ics_text: str) -> list[str]:
    """ICS lines can wrap with a leading space/tab. Unfold them per RFC 5545."""
    lines = ics_text.replace("\r\n", "\n").split("\n")
    unfolded: list[str] = []
    for line in lines:
        if line.startswith((" ", "\t")) and unfolded:
            unfolded[-1] += line[1:]
        else:
            unfolded.append(line)
    return unfolded


def _ics_parse_dt(value: str) -> Optional[datetime]:
    """
    Parse a DTSTART/DTEND value. Returns a timezone-aware UTC datetime or
    None when the value is unparseable. VALUE=DATE (all-day) produces a
    midnight-UTC datetime on that date.
    """
    if not value:
        return None
    raw = value.strip()
    # Strip a trailing Z and remember it so we can mark UTC.
    is_utc = raw.endswith("Z")
    raw = raw.rstrip("Z")

    try:
        if "T" in raw:
            dt = datetime.strptime(raw, "%Y%m%dT%H%M%S")
        else:
            dt = datetime.strptime(raw, "%Y%m%d")
    except ValueError:
        return None

    return dt.replace(tzinfo=timezone.utc) if is_utc or "T" not in raw else dt.replace(tzinfo=timezone.utc)


def _ics_events(ics_text: str) -> list[dict[str, Any]]:
    """Extract events from an ICS feed as dicts with uid/summary/start/end/location/description."""
    events: list[dict[str, Any]] = []
    current: Optional[dict[str, Any]] = None

    for raw_line in _ics_unfold(ics_text):
        line = raw_line.strip()
        if not line:
            continue
        if line == "BEGIN:VEVENT":
            current = {}
            continue
        if line == "END:VEVENT":
            if current is not None:
                events.append(current)
            current = None
            continue
        if current is None:
            continue

        # Split KEY[;PARAMS]:VALUE — params live between the first ; and :.
        sep = line.find(":")
        if sep == -1:
            continue
        head = line[:sep]
        value = line[sep + 1:]
        key = head.split(";", 1)[0].upper()

        if key == "UID":
            current["uid"] = value
        elif key == "SUMMARY":
            current["summary"] = _ics_unescape(value)
        elif key == "DESCRIPTION":
            current["description"] = _ics_unescape(value)
        elif key == "LOCATION":
            current["location"] = _ics_unescape(value)
        elif key == "DTSTART":
            current["start"] = _ics_parse_dt(value)
        elif key == "DTEND":
            current["end"] = _ics_parse_dt(value)

    return events


def _ics_unescape(value: str) -> str:
    return (value
            .replace("\\n", "\n")
            .replace("\\N", "\n")
            .replace("\\,", ",")
            .replace("\\;", ";")
            .replace("\\\\", "\\"))


@app.post("/api/agent/ingest-ics")
async def agent_ingest_ics(
    request: IcsIngestRequest,
    api_key: dict = Depends(require_scope("write")),
):
    """
    Ingest an ICS feed (Google Calendar / Outlook / Apple / any iCal source).

    For each VEVENT in the feed a note is created (or kept idempotent via
    the event UID) with metadata.type='meeting', dueDate=DTSTART and
    linkedResources pointing back to the original UID.
    """
    if not request.ics or not request.ics.strip():
        raise HTTPException(status_code=400, detail="ics body is required")
    if len(request.ics) > 2_000_000:
        raise HTTPException(status_code=400, detail="ICS payload too large (2MB cap)")

    max_events = min(max(1, request.max_events), 500)

    user_id = api_key["user_id"]
    service = supabase_for_user(user_id)
    workspace_id = request.workspace_id or _resolve_default_workspace(service, user_id)

    # Resolve target desktop.
    desktop_id = request.target_desktop_id
    if not desktop_id:
        first = service.table("desktops") \
            .select("id") \
            .eq("workspace_id", workspace_id) \
            .order("position_order") \
            .limit(1) \
            .execute()
        if not first.data:
            raise HTTPException(status_code=404, detail="Workspace has no desktops")
        desktop_id = first.data[0]["id"]

    cutoff = _parse_iso(request.start_after) if request.start_after else _utcnow()

    events = _ics_events(request.ics)[:max_events]

    created = 0
    updated = 0
    skipped = 0
    errors: list[str] = []

    for evt in events:
        try:
            start: Optional[datetime] = evt.get("start")
            summary = evt.get("summary") or "(Sin título)"
            uid = evt.get("uid")

            if start is None:
                skipped += 1
                continue
            if cutoff is not None and start < cutoff:
                skipped += 1
                continue

            metadata: dict[str, Any] = {
                "type": "meeting",
                "status": "active",
                "source": f"connector:calendar:{api_key['name']}",
                "dueDate": start.isoformat(),
                "tags": ["calendar"],
            }
            if uid:
                metadata["linkedResources"] = [{
                    "type": "ics",
                    "uri": f"ics:uid:{uid}",
                    "label": "Calendar event UID",
                }]

            content_lines = []
            if evt.get("location"):
                content_lines.append(f"📍 {evt['location']}")
            if evt.get("description"):
                content_lines.append(evt["description"])
            content = "\n\n".join(content_lines)

            # Idempotency: if the event UID was already ingested (linkedResources
            # contains its uri), update instead of inserting.
            existing_id = None
            if uid:
                match = service.table("notes") \
                    .select("id") \
                    .eq("desktop_id", desktop_id) \
                    .contains("metadata->linkedResources", [{"uri": f"ics:uid:{uid}"}]) \
                    .limit(1) \
                    .execute()
                if match.data:
                    existing_id = match.data[0]["id"]

            if existing_id:
                service.table("notes") \
                    .update({
                        "title": summary[:200],
                        "content": content,
                        "metadata": metadata,
                        "updated_at": _utcnow().isoformat(),
                    }) \
                    .eq("id", existing_id) \
                    .execute()
                updated += 1
            else:
                service.table("notes").insert({
                    "desktop_id": desktop_id,
                    "title": summary[:200],
                    "content": content,
                    "position_x": 100,
                    "position_y": 100,
                    "width": 300,
                    "height": 180,
                    "color": "#15311f",
                    "z_index": 1,
                    "minimized": False,
                    "metadata": metadata,
                }).execute()
                created += 1

        except Exception as e:
            errors.append(f"{evt.get('uid') or evt.get('summary', '?')}: {e}")

    if request.connector_id:
        try:
            service.table("connectors") \
                .update({
                    "last_sync_at": _utcnow().isoformat(),
                    "last_sync_status": f"ok ({created} new, {updated} updated)"
                        if not errors else f"partial ({len(errors)} errors)",
                }) \
                .eq("id", request.connector_id) \
                .eq("user_id", user_id) \
                .execute()
        except Exception:
            pass

    log_api_call(api_key, "ingest.ics", "agent_ingest_ics",
                 resource_id=desktop_id, status=200 if not errors else 207)

    return {
        "status": "ok" if not errors else "partial",
        "workspace_id": workspace_id,
        "desktop_id": desktop_id,
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "errors": errors[:20],
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
