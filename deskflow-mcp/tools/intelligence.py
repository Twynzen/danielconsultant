"""
DeskFlow MCP Server - Daily Intelligence Engine
================================================
Reads the metadata layer attached to notes and produces ranked views suitable
for humans (the Daily Dashboard) and agents (the briefing endpoint).

The engine is intentionally pure-Python over Supabase rows: it does not call
back into the LLM. Scoring rules live in `_score_note` so they're easy to
inspect and tweak.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Iterable, Optional

from mcp.server.fastmcp import FastMCP

from auth import check_rate_limit, get_authenticated_client


# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------

def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _parse_iso(value: Optional[str]) -> Optional[datetime]:
    """Parse an ISO-8601 string, tolerating trailing Z and naive datetimes."""
    if not value or not isinstance(value, str):
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


async def _get_default_workspace_id(client) -> str:
    workspace = client.table("workspaces") \
        .select("id") \
        .eq("is_default", True) \
        .is_("deleted_at", "null") \
        .single() \
        .execute()
    if not workspace.data:
        raise ValueError("No default workspace found for current user")
    return workspace.data["id"]


async def _resolve_workspace(client, workspace_id: Optional[str]) -> str:
    if workspace_id and len(workspace_id) == 36:
        return workspace_id
    return await _get_default_workspace_id(client)


async def _fetch_workspace_notes(
    client,
    workspace_id: str,
    include_content: bool = False,
) -> list[dict[str, Any]]:
    """Return every note in the workspace flattened across desktops."""
    desktops = client.table("desktops") \
        .select("id, name") \
        .eq("workspace_id", workspace_id) \
        .execute()
    desktop_rows = desktops.data or []
    if not desktop_rows:
        return []

    desktop_lookup = {d["id"]: d for d in desktop_rows}
    desktop_ids = list(desktop_lookup.keys())

    fields = "id, title, desktop_id, color, metadata, created_at, updated_at"
    if include_content:
        fields += ", content"

    notes = client.table("notes") \
        .select(fields) \
        .in_("desktop_id", desktop_ids) \
        .execute()

    rows = notes.data or []
    for row in rows:
        row["_desktop"] = desktop_lookup.get(row["desktop_id"])
        row["metadata"] = row.get("metadata") or {}
    return rows


async def _connection_degree(client, workspace_id: str) -> dict[str, int]:
    """Count incoming+outgoing connections per note inside the workspace."""
    desktops = client.table("desktops") \
        .select("id") \
        .eq("workspace_id", workspace_id) \
        .execute()
    desktop_ids = [d["id"] for d in (desktops.data or [])]
    if not desktop_ids:
        return {}

    conns = client.table("connections") \
        .select("from_note_id, to_note_id") \
        .in_("desktop_id", desktop_ids) \
        .execute()
    degree: dict[str, int] = {}
    for c in conns.data or []:
        degree[c["from_note_id"]] = degree.get(c["from_note_id"], 0) + 1
        degree[c["to_note_id"]] = degree.get(c["to_note_id"], 0) + 1
    return degree


# ----------------------------------------------------------------------------
# Scoring
# ----------------------------------------------------------------------------

def _score_note(
    note: dict[str, Any],
    now: datetime,
    degree: int,
) -> tuple[float, list[str]]:
    """
    Return (score, reasons). Higher score = should appear higher in the
    daily dashboard. Reasons are short human-readable strings the UI can
    surface as badges ("overdue", "high priority", etc.).
    """
    metadata = note.get("metadata") or {}
    reasons: list[str] = []
    score = 0.0

    # Status drives the floor: archived/completed items basically vanish.
    status = metadata.get("status")
    if status == "archived" or status == "completed":
        return (-1.0, ["completed" if status == "completed" else "archived"])
    if status == "blocked":
        score += 5.0
        reasons.append("blocked")
    if status == "active":
        score += 2.0

    # Priority — 1 (urgent) ... 5 (someday). Higher prio == bigger boost.
    priority = metadata.get("priority")
    if isinstance(priority, int) and 1 <= priority <= 5:
        score += (6 - priority) * 1.5
        if priority <= 2:
            reasons.append(f"priority {priority}")

    # Due date proximity.
    due = _parse_iso(metadata.get("dueDate"))
    if due is not None:
        delta_hours = (due - now).total_seconds() / 3600
        if delta_hours < 0:
            score += 8.0
            reasons.append("overdue")
        elif delta_hours <= 24:
            score += 6.0
            reasons.append("due today")
        elif delta_hours <= 72:
            score += 4.0
            reasons.append("due soon")
        elif delta_hours <= 24 * 7:
            score += 2.0

    # Type weighting: meetings and tasks bubble up; references stay quiet.
    note_type = metadata.get("type")
    if note_type in ("meeting", "task"):
        score += 1.5
    elif note_type == "project":
        score += 1.0
    elif note_type in ("reference", "log"):
        score -= 0.5

    # Connection degree — hub notes are usually important context.
    if degree >= 5:
        score += 1.5
        reasons.append("hub")
    elif degree >= 2:
        score += 0.5

    # Recency: edits in the last 48h are likely the user's current focus.
    updated = _parse_iso(note.get("updated_at"))
    if updated is not None:
        age_hours = (now - updated).total_seconds() / 3600
        if age_hours <= 48:
            score += 1.0

    # Stale items still relevant — projects/tasks not reviewed in 14 days.
    last_reviewed = _parse_iso(metadata.get("lastReviewedAt")) or updated
    if last_reviewed is not None and note_type in ("project", "task"):
        days_since = (now - last_reviewed).days
        if days_since >= 14 and status not in ("completed", "archived"):
            score += 1.5
            reasons.append("needs review")

    return (score, reasons)


def _serialize(note: dict[str, Any], score: float, reasons: list[str]) -> dict[str, Any]:
    desktop = note.get("_desktop") or {}
    return {
        "id": note["id"],
        "title": note["title"],
        "desktop_id": note["desktop_id"],
        "desktop_name": desktop.get("name"),
        "color": note.get("color"),
        "metadata": note.get("metadata") or {},
        "updated_at": note.get("updated_at"),
        "score": round(score, 2),
        "reasons": reasons,
    }


# ----------------------------------------------------------------------------
# Tool registration
# ----------------------------------------------------------------------------

def register_intelligence_tools(mcp: FastMCP):
    """Register the daily-intelligence MCP tools."""

    @mcp.tool()
    async def get_daily_priorities(
        workspace_id: Optional[str] = None,
        max_items: int = 20,
    ) -> dict[str, Any]:
        """
        Rank every note in the workspace and return the top items the user
        should pay attention to today.

        Args:
            workspace_id: Workspace UUID. Falls back to the default workspace.
            max_items: Cap on the returned list (1..100).

        Returns:
            { date, workspace_id, items: [...], total_considered }
        """
        check_rate_limit(is_write=False)
        max_items = min(max(1, max_items), 100)

        client = await get_authenticated_client()
        wid = await _resolve_workspace(client, workspace_id)
        notes = await _fetch_workspace_notes(client, wid)
        degree_map = await _connection_degree(client, wid)
        now = _utcnow()

        scored = []
        for note in notes:
            score, reasons = _score_note(note, now, degree_map.get(note["id"], 0))
            if score < 0:
                continue
            scored.append(_serialize(note, score, reasons))

        scored.sort(key=lambda x: x["score"], reverse=True)
        return {
            "date": now.date().isoformat(),
            "workspace_id": wid,
            "items": scored[:max_items],
            "total_considered": len(notes),
        }

    @mcp.tool()
    async def get_project_status_report(
        workspace_id: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        Group `type='project'` notes by status and surface their progress.

        Returns:
            {
              workspace_id,
              counts: { active, inactive, blocked, completed, archived, none },
              projects: [ { ..., progress, days_since_update } ]
            }
        """
        check_rate_limit(is_write=False)

        client = await get_authenticated_client()
        wid = await _resolve_workspace(client, workspace_id)
        notes = await _fetch_workspace_notes(client, wid)
        now = _utcnow()

        counts = {"active": 0, "inactive": 0, "blocked": 0,
                  "completed": 0, "archived": 0, "none": 0}
        projects = []
        for note in notes:
            metadata = note.get("metadata") or {}
            if metadata.get("type") != "project":
                continue
            status = metadata.get("status") or "none"
            counts[status] = counts.get(status, 0) + 1

            updated = _parse_iso(note.get("updated_at"))
            days_since = (now - updated).days if updated else None
            projects.append({
                "id": note["id"],
                "title": note["title"],
                "desktop_id": note["desktop_id"],
                "desktop_name": (note.get("_desktop") or {}).get("name"),
                "status": metadata.get("status"),
                "priority": metadata.get("priority"),
                "progress": metadata.get("progress"),
                "tags": metadata.get("tags") or [],
                "due_date": metadata.get("dueDate"),
                "days_since_update": days_since,
                "updated_at": note.get("updated_at"),
            })

        # Active projects first, then by recency.
        status_rank = {"blocked": 0, "active": 1, "inactive": 2,
                       "none": 3, "completed": 4, "archived": 5}
        projects.sort(key=lambda p: (
            status_rank.get(p["status"] or "none", 99),
            p["days_since_update"] if p["days_since_update"] is not None else 9999,
        ))

        return {"workspace_id": wid, "counts": counts, "projects": projects}

    @mcp.tool()
    async def get_blocked_items(
        workspace_id: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        """
        Return every note marked status='blocked'. These need user attention
        to unblock — agents typically surface them first in a briefing.
        """
        check_rate_limit(is_write=False)

        client = await get_authenticated_client()
        wid = await _resolve_workspace(client, workspace_id)
        notes = await _fetch_workspace_notes(client, wid)

        blocked = []
        for note in notes:
            metadata = note.get("metadata") or {}
            if metadata.get("status") == "blocked":
                blocked.append({
                    "id": note["id"],
                    "title": note["title"],
                    "desktop_id": note["desktop_id"],
                    "desktop_name": (note.get("_desktop") or {}).get("name"),
                    "metadata": metadata,
                    "updated_at": note.get("updated_at"),
                })
        return blocked

    @mcp.tool()
    async def get_stale_items(
        workspace_id: Optional[str] = None,
        days: int = 14,
    ) -> list[dict[str, Any]]:
        """
        Find tasks/projects that have not been touched (or reviewed) in `days`.

        Args:
            workspace_id: Defaults to the user's default workspace.
            days: Threshold in days (default 14, max 365).
        """
        check_rate_limit(is_write=False)
        days = min(max(1, days), 365)

        client = await get_authenticated_client()
        wid = await _resolve_workspace(client, workspace_id)
        notes = await _fetch_workspace_notes(client, wid)
        now = _utcnow()

        cutoff = now - timedelta(days=days)
        stale = []
        for note in notes:
            metadata = note.get("metadata") or {}
            if metadata.get("type") not in ("task", "project"):
                continue
            if metadata.get("status") in ("completed", "archived"):
                continue
            reviewed = _parse_iso(metadata.get("lastReviewedAt"))
            updated = _parse_iso(note.get("updated_at"))
            anchor = reviewed or updated
            if anchor is None or anchor > cutoff:
                continue
            stale.append({
                "id": note["id"],
                "title": note["title"],
                "desktop_id": note["desktop_id"],
                "desktop_name": (note.get("_desktop") or {}).get("name"),
                "metadata": metadata,
                "last_touch": anchor.isoformat(),
                "days_since": (now - anchor).days,
            })

        stale.sort(key=lambda r: r["days_since"], reverse=True)
        return stale

    @mcp.tool()
    async def get_weekly_review(
        workspace_id: Optional[str] = None,
        weeks_back: int = 0,
    ) -> dict[str, Any]:
        """
        Summarise the last 7-day window: what changed, what completed,
        what's still active.

        Args:
            workspace_id: Defaults to the user's default workspace.
            weeks_back: 0 = current week, 1 = previous week, ...
        """
        check_rate_limit(is_write=False)
        weeks_back = max(0, min(weeks_back, 52))

        client = await get_authenticated_client()
        wid = await _resolve_workspace(client, workspace_id)
        notes = await _fetch_workspace_notes(client, wid)
        now = _utcnow()

        end = now - timedelta(days=7 * weeks_back)
        start = end - timedelta(days=7)

        completed: list[dict[str, Any]] = []
        active: list[dict[str, Any]] = []
        new_items: list[dict[str, Any]] = []

        for note in notes:
            metadata = note.get("metadata") or {}
            updated = _parse_iso(note.get("updated_at"))
            created = _parse_iso(note.get("created_at"))
            if updated is None or not (start <= updated <= end):
                continue

            entry = {
                "id": note["id"],
                "title": note["title"],
                "desktop_id": note["desktop_id"],
                "desktop_name": (note.get("_desktop") or {}).get("name"),
                "type": metadata.get("type"),
                "status": metadata.get("status"),
                "updated_at": note.get("updated_at"),
            }

            if metadata.get("status") == "completed":
                completed.append(entry)
            elif metadata.get("status") == "active":
                active.append(entry)

            if created is not None and start <= created <= end:
                new_items.append(entry)

        return {
            "workspace_id": wid,
            "window": {"start": start.isoformat(), "end": end.isoformat()},
            "completed": completed,
            "active": active,
            "new_items": new_items,
            "totals": {
                "completed": len(completed),
                "active": len(active),
                "new": len(new_items),
            },
        }

    @mcp.tool()
    async def suggest_next_actions(
        workspace_id: Optional[str] = None,
        limit: int = 5,
    ) -> list[dict[str, Any]]:
        """
        Compact, opinionated list of "what to do next" — useful for an agent
        that wants a one-shot answer without paging through everything.

        Builds on `get_daily_priorities` but trims to actionable items
        (tasks, blocked items, overdue meetings).
        """
        check_rate_limit(is_write=False)
        limit = min(max(1, limit), 20)

        client = await get_authenticated_client()
        wid = await _resolve_workspace(client, workspace_id)
        notes = await _fetch_workspace_notes(client, wid)
        degree_map = await _connection_degree(client, wid)
        now = _utcnow()

        actionable: list[dict[str, Any]] = []
        for note in notes:
            metadata = note.get("metadata") or {}
            note_type = metadata.get("type")
            status = metadata.get("status")
            due = _parse_iso(metadata.get("dueDate"))

            is_actionable = (
                note_type in ("task", "meeting")
                or status == "blocked"
                or (due is not None and due <= now + timedelta(days=2))
            )
            if not is_actionable:
                continue
            if status in ("completed", "archived"):
                continue

            score, reasons = _score_note(note, now, degree_map.get(note["id"], 0))
            if score < 0:
                continue
            actionable.append(_serialize(note, score, reasons))

        actionable.sort(key=lambda x: x["score"], reverse=True)
        return actionable[:limit]
