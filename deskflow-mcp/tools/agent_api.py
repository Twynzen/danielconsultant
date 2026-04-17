"""
DeskFlow MCP Server - Agent API
================================
Aggregated, agent-friendly tools that return everything an external agent
needs in a single round-trip. The intent is that an agent (Claude, GPT,
n8n, Sendell, ...) can answer "what should I tell my user about?" with a
single MCP call instead of paging through low-level CRUD tools.

These wrap the more granular `intelligence` and `metadata` tools.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from mcp.server.fastmcp import FastMCP

from auth import check_rate_limit, get_authenticated_client
from .intelligence import (
    _connection_degree,
    _fetch_workspace_notes,
    _parse_iso,
    _resolve_workspace,
    _score_note,
    _serialize,
    _utcnow,
)


def _briefing_section(notes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Trim notes to the small shape used inside the briefing payload."""
    out = []
    for note in notes:
        metadata = note.get("metadata") or {}
        desktop = note.get("_desktop") or {}
        out.append({
            "id": note["id"],
            "title": note["title"],
            "desktop_name": desktop.get("name"),
            "type": metadata.get("type"),
            "status": metadata.get("status"),
            "priority": metadata.get("priority"),
            "due_date": metadata.get("dueDate"),
            "tags": metadata.get("tags") or [],
            "updated_at": note.get("updated_at"),
        })
    return out


def register_agent_api_tools(mcp: FastMCP):
    """Register the agent-facing aggregate tools."""

    @mcp.tool()
    async def get_user_context_briefing(
        workspace_id: Optional[str] = None,
        max_priorities: int = 10,
        max_recent: int = 20,
        upcoming_window_hours: int = 48,
        stale_threshold_days: int = 14,
    ) -> dict[str, Any]:
        """
        Return a single, opinionated briefing of the user's current state.
        Designed to be the first call an agent makes per conversation.

        Sections:
            priorities_today    — top scored items
            active_projects     — projects with status='active'
            blocked_items       — anything blocked
            upcoming_meetings   — type='meeting' due within window
            recent_activity     — last `max_recent` notes by updated_at
            stale_items         — projects/tasks not touched in N days
            weekly_summary      — counts of last 7 days

        Args:
            workspace_id: Defaults to user's default workspace.
            max_priorities: 1..50 (default 10).
            max_recent: 1..50 (default 20).
            upcoming_window_hours: How far ahead to look for meetings.
            stale_threshold_days: Threshold for "stale".
        """
        check_rate_limit(is_write=False)
        max_priorities = min(max(1, max_priorities), 50)
        max_recent = min(max(1, max_recent), 50)
        upcoming_window_hours = min(max(1, upcoming_window_hours), 24 * 30)
        stale_threshold_days = min(max(1, stale_threshold_days), 365)

        client = await get_authenticated_client()
        wid = await _resolve_workspace(client, workspace_id)
        notes = await _fetch_workspace_notes(client, wid)
        degree_map = await _connection_degree(client, wid)
        now = _utcnow()
        upcoming_cutoff = now + timedelta(hours=upcoming_window_hours)
        stale_cutoff = now - timedelta(days=stale_threshold_days)
        week_ago = now - timedelta(days=7)

        priorities: list[dict[str, Any]] = []
        active_projects: list[dict[str, Any]] = []
        blocked_items: list[dict[str, Any]] = []
        upcoming_meetings: list[dict[str, Any]] = []
        recent_activity: list[dict[str, Any]] = []
        stale_items: list[dict[str, Any]] = []
        completed_week = 0
        new_week = 0

        for note in notes:
            metadata = note.get("metadata") or {}
            updated = _parse_iso(note.get("updated_at"))
            created = _parse_iso(note.get("created_at"))

            score, reasons = _score_note(note, now, degree_map.get(note["id"], 0))
            if score >= 0:
                priorities.append(_serialize(note, score, reasons))

            if metadata.get("type") == "project" and metadata.get("status") == "active":
                active_projects.append({
                    "id": note["id"],
                    "title": note["title"],
                    "progress": metadata.get("progress"),
                    "tags": metadata.get("tags") or [],
                    "updated_at": note.get("updated_at"),
                })

            if metadata.get("status") == "blocked":
                blocked_items.append({
                    "id": note["id"],
                    "title": note["title"],
                    "desktop_name": (note.get("_desktop") or {}).get("name"),
                    "type": metadata.get("type"),
                })

            if metadata.get("type") == "meeting":
                due = _parse_iso(metadata.get("dueDate"))
                if due is not None and now <= due <= upcoming_cutoff:
                    upcoming_meetings.append({
                        "id": note["id"],
                        "title": note["title"],
                        "due_date": metadata.get("dueDate"),
                    })

            if metadata.get("type") in ("task", "project") \
                    and metadata.get("status") not in ("completed", "archived"):
                anchor = _parse_iso(metadata.get("lastReviewedAt")) or updated
                if anchor is not None and anchor < stale_cutoff:
                    stale_items.append({
                        "id": note["id"],
                        "title": note["title"],
                        "days_since": (now - anchor).days,
                    })

            if updated is not None and updated >= week_ago:
                if metadata.get("status") == "completed":
                    completed_week += 1
                if created is not None and created >= week_ago:
                    new_week += 1

        priorities.sort(key=lambda x: x["score"], reverse=True)
        active_projects.sort(key=lambda p: p["updated_at"] or "", reverse=True)
        upcoming_meetings.sort(key=lambda m: m["due_date"] or "")
        stale_items.sort(key=lambda s: s["days_since"], reverse=True)

        # Recent activity is just the last edited notes regardless of metadata.
        recent_sorted = sorted(
            notes,
            key=lambda n: n.get("updated_at") or "",
            reverse=True,
        )[:max_recent]
        recent_activity = _briefing_section(recent_sorted)

        return {
            "date": now.date().isoformat(),
            "generated_at": now.isoformat(),
            "workspace_id": wid,
            "priorities_today": priorities[:max_priorities],
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
                "notes": len(notes),
                "active_projects": len(active_projects),
                "blocked": len(blocked_items),
            },
        }

    @mcp.tool()
    async def agent_log_insight(
        content: str,
        title: Optional[str] = None,
        tags: Optional[list[str]] = None,
        project_note_id: Optional[str] = None,
        desktop_id: Optional[str] = None,
        source: str = "agent",
        workspace_id: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        Persist an insight produced by an agent. Creates a note tagged
        type='log' with source set so the user can see who logged it.

        At least one of `desktop_id` or `project_note_id` should be provided
        so the insight is filed somewhere meaningful. If neither is provided,
        the insight is dropped on the workspace's first available desktop.
        """
        check_rate_limit(is_write=True)

        if not content or not content.strip():
            raise ValueError("content is required")
        if len(content) > 100_000:
            raise ValueError("content must be <= 100,000 characters")

        client = await get_authenticated_client()
        wid = await _resolve_workspace(client, workspace_id)

        target_desktop_id = desktop_id
        if not target_desktop_id and project_note_id:
            ref = client.table("notes") \
                .select("desktop_id") \
                .eq("id", project_note_id) \
                .single() \
                .execute()
            if ref.data:
                target_desktop_id = ref.data["desktop_id"]

        if not target_desktop_id:
            first = client.table("desktops") \
                .select("id") \
                .eq("workspace_id", wid) \
                .order("position_order") \
                .limit(1) \
                .execute()
            if not first.data:
                raise ValueError("Workspace has no desktops to file insight into")
            target_desktop_id = first.data[0]["id"]

        metadata = {
            "type": "log",
            "tags": tags or [],
            "source": source,
        }
        if project_note_id:
            metadata["linkedResources"] = [{
                "type": "note",
                "uri": f"deskflow:note/{project_note_id}",
                "label": "Linked project note",
            }]

        note_data = {
            "desktop_id": target_desktop_id,
            "title": (title or content.split("\n", 1)[0])[:200].strip() or "Insight",
            "content": content,
            "position_x": 100,
            "position_y": 100,
            "width": 320,
            "height": 200,
            "color": "#1a3324",
            "z_index": 1,
            "minimized": False,
            "metadata": metadata,
        }

        result = client.table("notes").insert(note_data).execute()
        if not result.data:
            raise ValueError("Failed to create insight note")
        return result.data[0]

    @mcp.tool()
    async def agent_create_task(
        title: str,
        priority: int = 3,
        due_date: Optional[str] = None,
        desktop_id: Optional[str] = None,
        project_note_id: Optional[str] = None,
        tags: Optional[list[str]] = None,
        source: str = "agent",
        workspace_id: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        Create a task note (type='task', status='active') with metadata.
        Designed for agents that want to add a TODO without juggling raw notes.
        """
        check_rate_limit(is_write=True)
        if not title or not title.strip():
            raise ValueError("title is required")
        if priority < 1 or priority > 5:
            raise ValueError("priority must be in 1..5")
        if due_date is not None:
            if _parse_iso(due_date) is None:
                raise ValueError("due_date must be ISO-8601")

        client = await get_authenticated_client()
        wid = await _resolve_workspace(client, workspace_id)

        target_desktop_id = desktop_id
        if not target_desktop_id and project_note_id:
            ref = client.table("notes") \
                .select("desktop_id") \
                .eq("id", project_note_id) \
                .single() \
                .execute()
            if ref.data:
                target_desktop_id = ref.data["desktop_id"]

        if not target_desktop_id:
            first = client.table("desktops") \
                .select("id") \
                .eq("workspace_id", wid) \
                .order("position_order") \
                .limit(1) \
                .execute()
            if not first.data:
                raise ValueError("Workspace has no desktops to file task into")
            target_desktop_id = first.data[0]["id"]

        metadata: dict[str, Any] = {
            "type": "task",
            "status": "active",
            "priority": priority,
            "tags": tags or [],
            "source": source,
        }
        if due_date:
            metadata["dueDate"] = due_date

        note_data = {
            "desktop_id": target_desktop_id,
            "title": title.strip()[:200],
            "content": "",
            "position_x": 100,
            "position_y": 100,
            "width": 280,
            "height": 160,
            "color": "#003b1c",
            "z_index": 1,
            "minimized": False,
            "metadata": metadata,
        }
        result = client.table("notes").insert(note_data).execute()
        if not result.data:
            raise ValueError("Failed to create task")
        return result.data[0]

    @mcp.tool()
    async def agent_update_project_status(
        project_note_id: str,
        status: Optional[str] = None,
        progress: Optional[float] = None,
        note: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        Update a project's status and/or progress, optionally appending a
        timestamped log line to its content.
        """
        check_rate_limit(is_write=True)

        if not project_note_id or len(project_note_id) != 36:
            raise ValueError("project_note_id must be a UUID")

        client = await get_authenticated_client()
        existing = client.table("notes") \
            .select("metadata, content") \
            .eq("id", project_note_id) \
            .single() \
            .execute()
        if not existing.data:
            raise ValueError(f"Note {project_note_id} not found")

        metadata = dict(existing.data.get("metadata") or {})
        metadata.setdefault("type", "project")
        if status is not None:
            if status not in {"active", "inactive", "completed", "archived", "blocked"}:
                raise ValueError("Invalid status")
            metadata["status"] = status
        if progress is not None:
            if progress < 0 or progress > 100:
                raise ValueError("progress must be 0..100")
            metadata["progress"] = float(progress)
        metadata["lastReviewedAt"] = _utcnow().isoformat()

        updates: dict[str, Any] = {
            "metadata": metadata,
            "updated_at": _utcnow().isoformat(),
        }
        if note:
            stamp = _utcnow().strftime("%Y-%m-%d %H:%M UTC")
            updates["content"] = (
                (existing.data.get("content") or "")
                + f"\n\n— [{stamp}] {note}"
            ).strip()

        result = client.table("notes") \
            .update(updates) \
            .eq("id", project_note_id) \
            .execute()
        if not result.data:
            raise ValueError(f"Failed to update note {project_note_id}")
        return result.data[0]

    @mcp.tool()
    async def get_context_for_topic(
        topic: str,
        workspace_id: Optional[str] = None,
        limit: int = 15,
    ) -> dict[str, Any]:
        """
        Find notes relevant to a topic by scanning titles, content, and tags.
        Returns the matches plus a small connection graph for the top hit.
        """
        check_rate_limit(is_write=False)
        if not topic or len(topic.strip()) < 2:
            raise ValueError("topic must be at least 2 characters")
        limit = min(max(1, limit), 50)
        topic_lower = topic.strip().lower()

        client = await get_authenticated_client()
        wid = await _resolve_workspace(client, workspace_id)
        notes = await _fetch_workspace_notes(client, wid, include_content=True)

        scored: list[tuple[float, dict[str, Any]]] = []
        for n in notes:
            metadata = n.get("metadata") or {}
            title = (n.get("title") or "").lower()
            content = (n.get("content") or "").lower()
            tags = [t.lower() for t in (metadata.get("tags") or [])]

            score = 0.0
            if topic_lower in title:
                score += 5
            if topic_lower in tags:
                score += 4
            if topic_lower in content:
                score += 1 + min(content.count(topic_lower) * 0.2, 3)

            if score > 0:
                scored.append((score, {
                    "id": n["id"],
                    "title": n["title"],
                    "desktop_name": (n.get("_desktop") or {}).get("name"),
                    "metadata": metadata,
                    "snippet": (n.get("content") or "")[:280],
                    "score": round(score, 2),
                }))

        scored.sort(key=lambda r: r[0], reverse=True)
        top = [s[1] for s in scored[:limit]]
        return {
            "workspace_id": wid,
            "topic": topic,
            "matches": top,
            "match_count": len(scored),
        }

    @mcp.tool()
    async def get_project_deep_dive(
        project_note_id: str,
    ) -> dict[str, Any]:
        """
        Return everything connected to a single project note: the note itself,
        its full content, its metadata, and all directly-connected notes.
        """
        check_rate_limit(is_write=False)
        if not project_note_id or len(project_note_id) != 36:
            raise ValueError("project_note_id must be a UUID")

        client = await get_authenticated_client()
        note = client.table("notes") \
            .select("*") \
            .eq("id", project_note_id) \
            .single() \
            .execute()
        if not note.data:
            raise ValueError(f"Note {project_note_id} not found")

        outgoing = client.table("connections") \
            .select("to_note_id, color, label") \
            .eq("from_note_id", project_note_id) \
            .execute()
        incoming = client.table("connections") \
            .select("from_note_id, color, label") \
            .eq("to_note_id", project_note_id) \
            .execute()

        connected_ids = set()
        for c in (outgoing.data or []):
            connected_ids.add(c["to_note_id"])
        for c in (incoming.data or []):
            connected_ids.add(c["from_note_id"])

        connected: list[dict[str, Any]] = []
        if connected_ids:
            rows = client.table("notes") \
                .select("id, title, desktop_id, metadata, updated_at") \
                .in_("id", list(connected_ids)) \
                .execute()
            connected = rows.data or []

        return {
            "note": note.data,
            "metadata": note.data.get("metadata") or {},
            "connected_notes": connected,
            "connection_count": len(connected_ids),
        }
