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


# --- Calendar Models (Phase 2 — feature/calendar) ---

class CalendarReminderInput(BaseModel):
    minutes_before: int = Field(ge=0, le=43_200)         # up to 30 days ahead
    channel: str = "whatsapp"                            # whatsapp | toast | both


class CalendarCreateBody(BaseModel):
    name: str
    color: str = "#00ff41"
    is_default: bool = False


class EventCreateBody(BaseModel):
    calendar_id: str
    title: str
    starts_at: str                                       # ISO 8601
    ends_at: str
    all_day: bool = False
    description: Optional[str] = None
    location: Optional[str] = None
    rrule: Optional[str] = None
    linked_note_id: Optional[str] = None
    reminders: Optional[list[CalendarReminderInput]] = None


class EventUpdateBody(BaseModel):
    title: Optional[str] = None
    starts_at: Optional[str] = None
    ends_at: Optional[str] = None
    all_day: Optional[bool] = None
    description: Optional[str] = None
    location: Optional[str] = None
    rrule: Optional[str] = None
    linked_note_id: Optional[str] = None

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
async def revoke_api_key(key_id: str, user_token: str = Header(..., alias="X-User-Token")):
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
                note_row_id = existing_id
            else:
                ins = service.table("notes").insert({
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
                note_row_id = (ins.data[0]["id"] if ins.data else None)

            # Mirror into calendar_events so the new calendar UI shows it.
            # Idempotent via UNIQUE(user_id, ics_uid) — re-importing same UID
            # updates the row instead of inserting. Best-effort: failures
            # here don't break the note ingestion above.
            if uid:
                try:
                    ics_calendar_id = _ensure_ics_calendar(service, user_id)
                    end_dt = evt.get("end") or start
                    event_row = {
                        "user_id": user_id,
                        "calendar_id": ics_calendar_id,
                        "title": summary[:200],
                        "description": evt.get("description"),
                        "location": evt.get("location"),
                        "starts_at": start.isoformat(),
                        "ends_at": end_dt.isoformat(),
                        "all_day": False,
                        "ics_uid": uid,
                        "linked_note_id": note_row_id,
                        "updated_at": _utcnow().isoformat(),
                    }
                    service.table("calendar_events") \
                        .upsert(event_row, on_conflict="user_id,ics_uid") \
                        .execute()
                except Exception as e:
                    errors.append(f"calendar mirror {uid}: {e}")

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
# CALENDAR ENDPOINTS (Phase 2 — feature/calendar)
# =============================================================================
#
# All endpoints below are scope-gated agent endpoints (X-API-Key auth).
# Single source of truth for any external system that needs to read or
# write the user's calendar — Sendell, Claude Desktop (via REST fallback),
# n8n, custom cron jobs, you name it.

from dateutil.rrule import rrulestr as _rrulestr  # noqa: E402  (intentional late import)


def _calendar_parse_iso(value: str) -> datetime:
    """Same semantics as tools/calendar.py _parse_iso, kept local to avoid
    importing from `tools` into the FastAPI app."""
    if not value:
        raise HTTPException(status_code=400, detail="ISO datetime required")
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(value)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Bad ISO datetime: {e}")
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _calendar_serialize(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "calendar_id": row["calendar_id"],
        "title": row["title"],
        "description": row.get("description"),
        "location": row.get("location"),
        "starts_at": row["starts_at"],
        "ends_at": row["ends_at"],
        "all_day": row.get("all_day", False),
        "rrule": row.get("rrule"),
        "rrule_exdates": row.get("rrule_exdates") or [],
        "recurrence_parent_id": row.get("recurrence_parent_id"),
        "linked_note_id": row.get("linked_note_id"),
        "ics_uid": row.get("ics_uid"),
        "metadata": row.get("metadata") or {},
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
    }


def _calendar_expand(row: dict[str, Any], wstart: datetime, wend: datetime) -> list[dict[str, Any]]:
    base = _calendar_serialize(row)
    if not row.get("rrule"):
        starts = _calendar_parse_iso(row["starts_at"])
        ends = _calendar_parse_iso(row["ends_at"])
        if ends < wstart or starts > wend:
            return []
        base["instance_start"] = base["starts_at"]
        return [base]
    duration = _calendar_parse_iso(row["ends_at"]) - _calendar_parse_iso(row["starts_at"])
    dtstart = _calendar_parse_iso(row["starts_at"])
    rule = _rrulestr(row["rrule"], dtstart=dtstart)
    exdates = {_calendar_parse_iso(d).isoformat() for d in (row.get("rrule_exdates") or [])}
    out: list[dict[str, Any]] = []
    for occ in rule.between(wstart, wend, inc=True):
        starts_iso = occ.isoformat()
        if starts_iso in exdates:
            continue
        instance = dict(base)
        instance["starts_at"] = starts_iso
        instance["ends_at"] = (occ + duration).isoformat()
        instance["instance_start"] = starts_iso
        out.append(instance)
    return out


def _ensure_default_calendar(service: Client, user_id: str) -> str:
    """Returns the user's default calendar id, creating one on first use."""
    found = service.table("calendars") \
        .select("id") \
        .eq("user_id", user_id) \
        .eq("is_default", True) \
        .limit(1) \
        .execute()
    if found.data:
        return found.data[0]["id"]
    created = service.table("calendars").insert({
        "user_id": user_id,
        "name": "Mi Calendario",
        "color": "#00ff41",
        "is_default": True,
        "source": "manual",
    }).execute()
    return created.data[0]["id"]


def _ensure_ics_calendar(service: Client, user_id: str, name: str = "Importado") -> str:
    """One ICS bucket per user. Created lazily on first ingest."""
    found = service.table("calendars") \
        .select("id") \
        .eq("user_id", user_id) \
        .eq("source", "ics") \
        .limit(1) \
        .execute()
    if found.data:
        return found.data[0]["id"]
    created = service.table("calendars").insert({
        "user_id": user_id,
        "name": name,
        "color": "#00cfff",
        "is_default": False,
        "source": "ics",
    }).execute()
    return created.data[0]["id"]


# ---------- Calendars CRUD ---------------------------------------------------

@app.get("/api/agent/calendars")
async def agent_list_calendars(api_key: dict = Depends(require_scope("read"))):
    """Lista los calendarios del usuario."""
    user_id = api_key["user_id"]
    service = supabase_for_user(user_id)
    result = service.table("calendars") \
        .select("id, name, color, visible, is_default, source, created_at") \
        .eq("user_id", user_id) \
        .order("is_default", desc=True) \
        .order("name") \
        .execute()
    log_api_call(api_key, "calendar.list", "agent_list_calendars")
    return {"calendars": result.data or []}


@app.post("/api/agent/calendars")
async def agent_create_calendar(
    body: CalendarCreateBody,
    api_key: dict = Depends(require_scope("write")),
):
    """Crea un calendario."""
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="name requerido")
    if len(body.name) > 80:
        raise HTTPException(status_code=400, detail="name <= 80")
    if not body.color.startswith("#"):
        raise HTTPException(status_code=400, detail="color debe empezar con #")

    user_id = api_key["user_id"]
    service = supabase_for_user(user_id)

    if body.is_default:
        service.table("calendars") \
            .update({"is_default": False}) \
            .eq("user_id", user_id) \
            .eq("is_default", True) \
            .execute()

    created = service.table("calendars").insert({
        "user_id": user_id,
        "name": body.name.strip(),
        "color": body.color,
        "is_default": body.is_default,
    }).execute()
    log_api_call(api_key, "calendar.create", "agent_create_calendar",
                 resource_id=created.data[0]["id"])
    return created.data[0]


@app.delete("/api/agent/calendars/{calendar_id}")
async def agent_delete_calendar(
    calendar_id: str,
    api_key: dict = Depends(require_scope("write")),
):
    user_id = api_key["user_id"]
    service = supabase_for_user(user_id)
    result = service.table("calendars") \
        .delete() \
        .eq("id", calendar_id) \
        .eq("user_id", user_id) \
        .execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Calendar not found")
    log_api_call(api_key, "calendar.delete", "agent_delete_calendar",
                 resource_id=calendar_id)
    return {"status": "ok"}


# ---------- Events CRUD ------------------------------------------------------

@app.get("/api/agent/events")
async def agent_list_events(
    start: str = Query(..., description="ISO 8601 inclusive lower bound"),
    end: str = Query(..., description="ISO 8601 inclusive upper bound"),
    calendar_ids: Optional[str] = Query(
        None, description="Comma-separated calendar UUIDs to filter by"
    ),
    api_key: dict = Depends(require_scope("read")),
):
    """
    Lista eventos en [start, end]. Recurring events se expanden server-side
    — recibes una entrada por instancia con `instance_start` único.
    """
    wstart = _calendar_parse_iso(start)
    wend = _calendar_parse_iso(end)
    if wend < wstart:
        raise HTTPException(status_code=400, detail="end >= start")

    user_id = api_key["user_id"]
    service = supabase_for_user(user_id)

    cal_filter: list[str] = []
    if calendar_ids:
        cal_filter = [c.strip() for c in calendar_ids.split(",") if c.strip()]

    query = service.table("calendar_events") \
        .select("*") \
        .eq("user_id", user_id)
    if cal_filter:
        query = query.in_("calendar_id", cal_filter)

    rows = (query.execute().data) or []

    # If no explicit filter, hide events from non-visible calendars.
    if not cal_filter:
        cals = service.table("calendars") \
            .select("id, visible") \
            .eq("user_id", user_id) \
            .execute()
        visible = {c["id"] for c in (cals.data or []) if c.get("visible", True)}
        rows = [r for r in rows if r["calendar_id"] in visible]

    out: list[dict[str, Any]] = []
    for r in rows:
        out.extend(_calendar_expand(r, wstart, wend))
    out.sort(key=lambda e: e["starts_at"])
    log_api_call(api_key, "calendar.list_events", "agent_list_events")
    return {"events": out}


@app.post("/api/agent/events")
async def agent_create_event(
    body: EventCreateBody,
    api_key: dict = Depends(require_scope("write")),
):
    if not body.title.strip():
        raise HTTPException(status_code=400, detail="title requerido")

    starts = _calendar_parse_iso(body.starts_at)
    ends = _calendar_parse_iso(body.ends_at)
    if ends < starts:
        raise HTTPException(status_code=400, detail="ends_at >= starts_at")

    if body.rrule:
        try:
            _rrulestr(body.rrule, dtstart=starts)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"RRULE inválida: {e}")

    user_id = api_key["user_id"]
    service = supabase_for_user(user_id)

    # Verify calendar belongs to user.
    cal = service.table("calendars") \
        .select("id") \
        .eq("id", body.calendar_id) \
        .eq("user_id", user_id) \
        .execute()
    if not cal.data:
        raise HTTPException(status_code=404, detail="Calendar not found")

    row = {
        "user_id": user_id,
        "calendar_id": body.calendar_id,
        "title": body.title.strip()[:200],
        "description": body.description,
        "location": body.location,
        "starts_at": starts.isoformat(),
        "ends_at": ends.isoformat(),
        "all_day": body.all_day,
        "rrule": body.rrule,
        "linked_note_id": body.linked_note_id,
    }
    created = service.table("calendar_events").insert(row).execute()
    event = created.data[0]

    if body.reminders:
        for r in body.reminders:
            if r.channel not in ("whatsapp", "toast", "both"):
                raise HTTPException(status_code=400, detail="channel inválido")
            fire_at = starts.timestamp() - r.minutes_before * 60
            fire_at_iso = datetime.fromtimestamp(fire_at, tz=timezone.utc).isoformat()
            service.table("event_reminders").insert({
                "user_id": user_id,
                "event_id": event["id"],
                "minutes_before": r.minutes_before,
                "channel": r.channel,
                "fire_at": fire_at_iso,
            }).execute()

    log_api_call(api_key, "calendar.create_event", "agent_create_event",
                 resource_id=event["id"])
    return _calendar_serialize(event)


@app.patch("/api/agent/events/{event_id}")
async def agent_update_event(
    event_id: str,
    body: EventUpdateBody,
    scope: str = Query("this", regex="^(this|future|all)$"),
    api_key: dict = Depends(require_scope("write")),
):
    """Mutate an event. `scope` only matters for recurring events."""
    user_id = api_key["user_id"]
    service = supabase_for_user(user_id)

    existing = service.table("calendar_events") \
        .select("*") \
        .eq("id", event_id) \
        .eq("user_id", user_id) \
        .execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Event not found")
    row = existing.data[0]
    is_recurring = bool(row.get("rrule"))

    patch: dict[str, Any] = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if body.title is not None:
        patch["title"] = body.title.strip()[:200]
    if body.starts_at is not None:
        patch["starts_at"] = _calendar_parse_iso(body.starts_at).isoformat()
    if body.ends_at is not None:
        patch["ends_at"] = _calendar_parse_iso(body.ends_at).isoformat()
    if body.all_day is not None:
        patch["all_day"] = body.all_day
    if body.description is not None:
        patch["description"] = body.description
    if body.location is not None:
        patch["location"] = body.location
    if body.rrule is not None:
        if body.rrule:
            try:
                _rrulestr(body.rrule, dtstart=_calendar_parse_iso(
                    patch.get("starts_at") or row["starts_at"]))
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"RRULE inválida: {e}")
        patch["rrule"] = body.rrule or None
    if body.linked_note_id is not None:
        patch["linked_note_id"] = body.linked_note_id or None

    if not is_recurring or scope == "all":
        service.table("calendar_events") \
            .update(patch) \
            .eq("id", event_id) \
            .execute()
        log_api_call(api_key, "calendar.update_event", "agent_update_event",
                     resource_id=event_id)
        return _calendar_serialize({**row, **patch})

    if scope == "this":
        instance_start = patch.get("starts_at") or row["starts_at"]
        exdates = list(row.get("rrule_exdates") or [])
        exdates.append(row["starts_at"])
        service.table("calendar_events") \
            .update({"rrule_exdates": exdates}) \
            .eq("id", event_id) \
            .execute()
        isolated = {
            "user_id": user_id,
            "calendar_id": row["calendar_id"],
            "title": patch.get("title", row["title"]),
            "description": patch.get("description", row.get("description")),
            "location": patch.get("location", row.get("location")),
            "starts_at": instance_start,
            "ends_at": patch.get("ends_at", row["ends_at"]),
            "all_day": patch.get("all_day", row.get("all_day", False)),
            "rrule": None,
            "recurrence_parent_id": event_id,
            "linked_note_id": patch.get("linked_note_id", row.get("linked_note_id")),
        }
        ins = service.table("calendar_events").insert(isolated).execute()
        log_api_call(api_key, "calendar.update_event_this", "agent_update_event",
                     resource_id=event_id)
        return _calendar_serialize(ins.data[0])

    # scope == "future"
    cutoff = _calendar_parse_iso(patch.get("starts_at") or row["starts_at"])
    until_str = cutoff.strftime("%Y%m%dT%H%M%SZ")
    old_rrule = row["rrule"] or ""
    new_parent = ";".join(
        p for p in old_rrule.split(";") if not p.upper().startswith("UNTIL=")
    )
    new_parent += f";UNTIL={until_str}" if new_parent else f"UNTIL={until_str}"
    service.table("calendar_events") \
        .update({"rrule": new_parent}) \
        .eq("id", event_id) \
        .execute()
    new_series = {
        "user_id": user_id,
        "calendar_id": row["calendar_id"],
        "title": patch.get("title", row["title"]),
        "description": patch.get("description", row.get("description")),
        "location": patch.get("location", row.get("location")),
        "starts_at": patch.get("starts_at") or row["starts_at"],
        "ends_at": patch.get("ends_at") or row["ends_at"],
        "all_day": patch.get("all_day", row.get("all_day", False)),
        "rrule": patch.get("rrule", row.get("rrule")),
        "linked_note_id": patch.get("linked_note_id", row.get("linked_note_id")),
    }
    ins = service.table("calendar_events").insert(new_series).execute()
    log_api_call(api_key, "calendar.update_event_future", "agent_update_event",
                 resource_id=event_id)
    return _calendar_serialize(ins.data[0])


@app.delete("/api/agent/events/{event_id}")
async def agent_delete_event(
    event_id: str,
    scope: str = Query("this", regex="^(this|future|all)$"),
    api_key: dict = Depends(require_scope("write")),
):
    user_id = api_key["user_id"]
    service = supabase_for_user(user_id)

    existing = service.table("calendar_events") \
        .select("*") \
        .eq("id", event_id) \
        .eq("user_id", user_id) \
        .execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Event not found")
    row = existing.data[0]
    is_recurring = bool(row.get("rrule"))

    if not is_recurring or scope == "all":
        service.table("calendar_events") \
            .delete() \
            .eq("id", event_id) \
            .execute()
        log_api_call(api_key, "calendar.delete_event", "agent_delete_event",
                     resource_id=event_id)
        return {"status": "ok"}

    if scope == "this":
        exdates = list(row.get("rrule_exdates") or [])
        exdates.append(row["starts_at"])
        service.table("calendar_events") \
            .update({"rrule_exdates": exdates}) \
            .eq("id", event_id) \
            .execute()
        log_api_call(api_key, "calendar.delete_event_this", "agent_delete_event",
                     resource_id=event_id)
        return {"status": "ok", "scope": "this"}

    cutoff = _calendar_parse_iso(row["starts_at"])
    until_str = cutoff.strftime("%Y%m%dT%H%M%SZ")
    old_rrule = row["rrule"] or ""
    new_rrule = ";".join(
        p for p in old_rrule.split(";") if not p.upper().startswith("UNTIL=")
    )
    new_rrule += f";UNTIL={until_str}" if new_rrule else f"UNTIL={until_str}"
    service.table("calendar_events") \
        .update({"rrule": new_rrule}) \
        .eq("id", event_id) \
        .execute()
    log_api_call(api_key, "calendar.delete_event_future", "agent_delete_event",
                 resource_id=event_id)
    return {"status": "ok", "scope": "future"}


@app.get("/api/agent/calendar/today")
async def agent_calendar_today(api_key: dict = Depends(require_scope("read"))):
    """Conveniencia: devuelve los eventos de hoy ya expandidos."""
    user_id = api_key["user_id"]
    now = datetime.now(timezone.utc)
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    day_end = now.replace(hour=23, minute=59, second=59, microsecond=999_999)

    service = supabase_for_user(user_id)
    rows = (service.table("calendar_events")
            .select("*")
            .eq("user_id", user_id)
            .execute()
            .data) or []
    out: list[dict[str, Any]] = []
    for r in rows:
        out.extend(_calendar_expand(r, day_start, day_end))
    out.sort(key=lambda e: e["starts_at"])
    log_api_call(api_key, "calendar.today", "agent_calendar_today")
    return {"date": day_start.date().isoformat(), "events": out}


# ---------- Daily briefing (Phase 4 — calendar+priorities+free slots) --------
#
# Single-call answer for agents asking "what should the user do today?".
# Combines events from calendar_events + ranked priorities from notes
# metadata + free time slots inside a configurable work window.

@app.get("/api/agent/calendar/daily-briefing")
async def agent_calendar_daily_briefing(
    date: Optional[str] = Query(None, description="ISO date; default today UTC"),
    window_start: str = Query("09:00", description="Work window start HH:MM"),
    window_end: str = Query("19:00", description="Work window end HH:MM"),
    min_slot_minutes: int = Query(30, ge=5, le=480),
    api_key: dict = Depends(require_scope("read")),
):
    """Aggregated daily briefing — events + priorities + free slots."""
    user_id = api_key["user_id"]
    service = supabase_for_user(user_id)

    anchor = _calendar_parse_iso(date) if date else datetime.now(timezone.utc)
    day_start = anchor.replace(hour=0, minute=0, second=0, microsecond=0)
    day_end = anchor.replace(hour=23, minute=59, second=59, microsecond=999_999)

    # ----- Events for the day (with calendar metadata) -----
    rows = (service.table("calendar_events")
            .select("*")
            .eq("user_id", user_id)
            .execute()
            .data) or []
    cal_rows = (service.table("calendars")
                .select("id, name, color, visible")
                .eq("user_id", user_id)
                .execute()
                .data) or []
    cals = {c["id"]: c for c in cal_rows}

    schedule: list[dict[str, Any]] = []
    for r in rows:
        cal = cals.get(r["calendar_id"])
        if cal and cal.get("visible") is False:
            continue
        for inst in _calendar_expand(r, day_start, day_end):
            inst["calendar_name"] = (cal or {}).get("name")
            inst["calendar_color"] = (cal or {}).get("color")
            schedule.append(inst)

    # Notes whose metadata.scheduledStart/End fall within the day are
    # also surfaced as schedule items — they are the primary way users
    # block out hours of their day in DeskFlow. The frontend renders them
    # identically to calendar_events.
    notes_for_schedule = service.table("notes") \
        .select("id, title, desktop_id, metadata") \
        .not_.is_("metadata->>scheduledStart", "null") \
        .gte("metadata->>scheduledStart", day_start.isoformat()) \
        .lte("metadata->>scheduledStart", day_end.isoformat()) \
        .execute()
    for n in (notes_for_schedule.data or []):
        m = n.get("metadata") or {}
        s = m.get("scheduledStart")
        e = m.get("scheduledEnd")
        if not s or not e:
            continue
        schedule.append({
            "id": f"note-{n['id']}",
            "calendar_id": "__notes__",
            "title": n.get("title") or "(sin título)",
            "starts_at": s,
            "ends_at": e,
            "all_day": False,
            "linked_note_id": n["id"],
            "instance_start": s,
            "calendar_name": "Notas",
            "calendar_color": "#00ff41",
            "metadata": m,
        })

    schedule.sort(key=lambda e: e["starts_at"])

    now_iso = datetime.now(timezone.utc).isoformat()
    next_event = next((e for e in schedule if e["starts_at"] >= now_iso), None)

    # ----- Priorities + blocked + stale (re-uses briefing scoring) -----
    workspace = service.table("workspaces") \
        .select("id") \
        .eq("user_id", user_id) \
        .eq("is_default", True) \
        .is_("deleted_at", "null") \
        .limit(1) \
        .execute()
    workspace_id = workspace.data[0]["id"] if workspace.data else None

    priorities: list[dict[str, Any]] = []
    blocked: list[dict[str, Any]] = []
    stale: list[dict[str, Any]] = []

    if workspace_id:
        desktops_q = service.table("desktops") \
            .select("id, name") \
            .eq("workspace_id", workspace_id) \
            .execute()
        desktop_rows = desktops_q.data or []
        desktop_ids = [d["id"] for d in desktop_rows]
        desktop_lookup = {d["id"]: d for d in desktop_rows}

        notes_rows: list[dict[str, Any]] = []
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

        now_dt = datetime.now(timezone.utc)
        stale_cutoff = now_dt - timedelta(days=14)

        for n in notes_rows:
            m = n["metadata"]
            score, reasons = _score_briefing_note(n, now_dt, degree.get(n["id"], 0))
            if score >= 0:
                priorities.append({
                    "id": n["id"], "title": n["title"],
                    "desktop_name": (n["_desktop"] or {}).get("name"),
                    "metadata": m, "score": round(score, 2), "reasons": reasons,
                })
            if m.get("status") == "blocked":
                blocked.append({"id": n["id"], "title": n["title"], "type": m.get("type")})
            if m.get("type") in ("task", "project") and m.get("status") not in ("completed", "archived"):
                anchor_dt = _parse_iso(m.get("lastReviewedAt")) or _parse_iso(n.get("updated_at"))
                if anchor_dt is not None and anchor_dt < stale_cutoff:
                    stale.append({
                        "id": n["id"], "title": n["title"],
                        "days_since": (now_dt - anchor_dt).days,
                    })

        priorities.sort(key=lambda x: x["score"], reverse=True)
        stale.sort(key=lambda x: x["days_since"], reverse=True)

    # ----- Free slots inside the work window -----
    try:
        ws_h, ws_m = (int(x) for x in window_start.split(":"))
        we_h, we_m = (int(x) for x in window_end.split(":"))
    except ValueError:
        raise HTTPException(status_code=400, detail="window_start/end must be HH:MM")
    win_start = anchor.replace(hour=ws_h, minute=ws_m, second=0, microsecond=0)
    win_end = anchor.replace(hour=we_h, minute=we_m, second=0, microsecond=0)

    busy: list[tuple[datetime, datetime]] = []
    for evt in schedule:
        s = _calendar_parse_iso(evt["starts_at"])
        e = _calendar_parse_iso(evt["ends_at"])
        s = max(s, win_start)
        e = min(e, win_end)
        if e > s:
            busy.append((s, e))
    busy.sort(key=lambda x: x[0])
    merged: list[tuple[datetime, datetime]] = []
    for s, e in busy:
        if merged and s <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], e))
        else:
            merged.append((s, e))
    free_slots: list[dict[str, Any]] = []
    cursor = win_start
    for s, e in merged:
        if s > cursor:
            minutes = int((s - cursor).total_seconds() / 60)
            if minutes >= min_slot_minutes:
                free_slots.append({
                    "start": cursor.isoformat(),
                    "end": s.isoformat(),
                    "minutes": minutes,
                })
        cursor = max(cursor, e)
    if cursor < win_end:
        minutes = int((win_end - cursor).total_seconds() / 60)
        if minutes >= min_slot_minutes:
            free_slots.append({
                "start": cursor.isoformat(),
                "end": win_end.isoformat(),
                "minutes": minutes,
            })

    free_minutes = sum(s["minutes"] for s in free_slots)

    log_api_call(api_key, "calendar.daily_briefing", "agent_calendar_daily_briefing")

    return {
        "date": day_start.date().isoformat(),
        "summary": {
            "events": len(schedule),
            "priorities": len(priorities),
            "blocked": len(blocked),
            "free_minutes": free_minutes,
        },
        "next_event": next_event,
        "schedule": schedule,
        "priorities": priorities[:8],
        "free_slots": free_slots,
        "blocked": blocked[:10],
        "stale": stale[:10],
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
