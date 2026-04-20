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

    # ------------------------------------------------------------------
    # Calendar-aware tools (Phase 4)
    # ------------------------------------------------------------------
    # These read the calendar_events table directly and combine it with the
    # note-based intelligence above to give agents a single "what should I
    # do today" answer. Pure logic, no LLM.

    @mcp.tool()
    async def get_today_schedule(date: Optional[str] = None) -> dict[str, Any]:
        """
        Devuelve los eventos del calendario para `date` (default = hoy),
        con RRULE expandido y ordenados por hora. Pensado para que un
        agente externo pueda decir "tienes 3 reuniones hoy a las...".

        Args:
            date: ISO date (YYYY-MM-DD) or full ISO datetime. None → hoy UTC.

        Returns:
            { date, events: [...], next_event }
        """
        check_rate_limit(is_write=False)

        from dateutil.rrule import rrulestr  # late import — only used here

        client = await get_authenticated_client()
        anchor = _parse_iso(date) or _utcnow()
        day_start = anchor.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = anchor.replace(hour=23, minute=59, second=59, microsecond=999_999)

        rows = (client.table("calendar_events").select("*").execute().data) or []
        cal_rows = (client.table("calendars")
                    .select("id, name, color, visible")
                    .execute().data) or []
        cals = {c["id"]: c for c in cal_rows}

        out: list[dict[str, Any]] = []
        for row in rows:
            cal = cals.get(row["calendar_id"])
            if cal and cal.get("visible") is False:
                continue
            instances = _expand_event_in_window(row, day_start, day_end, rrulestr)
            for inst in instances:
                inst["calendar_name"] = (cal or {}).get("name")
                inst["calendar_color"] = (cal or {}).get("color")
                out.append(inst)

        # Notes with metadata.scheduledStart/End in the window are surfaced
        # as schedule items too — the primary way users block hours of their
        # day in DeskFlow without touching calendar_events.
        notes_q = client.table("notes") \
            .select("id, title, desktop_id, metadata") \
            .not_.is_("metadata->>scheduledStart", "null") \
            .gte("metadata->>scheduledStart", day_start.isoformat()) \
            .lte("metadata->>scheduledStart", day_end.isoformat()) \
            .execute()
        for n in (notes_q.data or []):
            m = n.get("metadata") or {}
            s = m.get("scheduledStart")
            e = m.get("scheduledEnd")
            if not s or not e:
                continue
            out.append({
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

        out.sort(key=lambda e: e["starts_at"])
        now_iso = _utcnow().isoformat()
        next_event = next((e for e in out if e["starts_at"] >= now_iso), None)

        return {
            "date": day_start.date().isoformat(),
            "events": out,
            "next_event": next_event,
        }

    @mcp.tool()
    async def get_free_time_slots(
        date: Optional[str] = None,
        min_minutes: int = 30,
        window_start: str = "09:00",
        window_end: str = "19:00",
    ) -> dict[str, Any]:
        """
        Resta los eventos del día a la ventana laboral y devuelve los huecos
        de >= `min_minutes`. Útil para que un agente sepa cuándo proponer
        una nueva tarea o reunión sin colisionar.

        Args:
            date: ISO date. None → hoy.
            min_minutes: Tamaño mínimo del hueco para que cuente.
            window_start / window_end: "HH:MM" — ventana del día considerada
                disponible (default 09:00–19:00 UTC).

        Returns:
            { date, window: {start, end}, slots: [{start, end, minutes}] }
        """
        check_rate_limit(is_write=False)

        schedule = await get_today_schedule(date)
        anchor = _parse_iso(date) or _utcnow()

        ws_h, ws_m = (int(x) for x in window_start.split(":"))
        we_h, we_m = (int(x) for x in window_end.split(":"))
        win_start = anchor.replace(hour=ws_h, minute=ws_m, second=0, microsecond=0)
        win_end = anchor.replace(hour=we_h, minute=we_m, second=0, microsecond=0)

        # Build sorted busy intervals clipped to the window.
        busy: list[tuple[datetime, datetime]] = []
        for evt in schedule["events"]:
            s = _parse_iso(evt["starts_at"]) or win_start
            e = _parse_iso(evt["ends_at"]) or s
            s = max(s, win_start)
            e = min(e, win_end)
            if e > s:
                busy.append((s, e))
        busy.sort(key=lambda x: x[0])

        # Merge overlapping busy intervals.
        merged: list[tuple[datetime, datetime]] = []
        for s, e in busy:
            if merged and s <= merged[-1][1]:
                merged[-1] = (merged[-1][0], max(merged[-1][1], e))
            else:
                merged.append((s, e))

        # Compute gaps.
        slots: list[dict[str, Any]] = []
        cursor = win_start
        for s, e in merged:
            if s > cursor:
                minutes = int((s - cursor).total_seconds() / 60)
                if minutes >= min_minutes:
                    slots.append({
                        "start": cursor.isoformat(),
                        "end": s.isoformat(),
                        "minutes": minutes,
                    })
            cursor = max(cursor, e)
        if cursor < win_end:
            minutes = int((win_end - cursor).total_seconds() / 60)
            if minutes >= min_minutes:
                slots.append({
                    "start": cursor.isoformat(),
                    "end": win_end.isoformat(),
                    "minutes": minutes,
                })

        return {
            "date": win_start.date().isoformat(),
            "window": {"start": win_start.isoformat(), "end": win_end.isoformat()},
            "slots": slots,
        }

    @mcp.tool()
    async def get_daily_briefing(date: Optional[str] = None) -> dict[str, Any]:
        """
        Single-call briefing combinando prioridades del día + eventos +
        huecos libres + ítems bloqueados + items estancados. Es la llamada
        recomendada para que un agente externo (Sendell, Claude, Gemini)
        responda "qué hago hoy" en una sola query.

        Returns:
            {
              date, summary: { events, priorities, free_minutes },
              next_event,
              schedule: [...],
              priorities: [...],
              free_slots: [...],
              blocked: [...],
              stale: [...]
            }
        """
        check_rate_limit(is_write=False)

        priorities_payload = await get_daily_priorities(max_items=8)
        schedule_payload = await get_today_schedule(date)
        free_payload = await get_free_time_slots(date)
        blocked_payload = await get_blocked_items()
        stale_payload = await get_stale_items()

        free_minutes = sum(s["minutes"] for s in free_payload["slots"])

        return {
            "date": schedule_payload["date"],
            "summary": {
                "events": len(schedule_payload["events"]),
                "priorities": len(priorities_payload["items"]),
                "blocked": len(blocked_payload),
                "free_minutes": free_minutes,
            },
            "next_event": schedule_payload["next_event"],
            "schedule": schedule_payload["events"],
            "priorities": priorities_payload["items"],
            "free_slots": free_payload["slots"],
            "blocked": blocked_payload[:10],
            "stale": stale_payload[:10],
        }

    @mcp.tool()
    async def suggest_daily_plan(
        date: Optional[str] = None,
        max_suggestions: int = 5,
    ) -> dict[str, Any]:
        """
        Asigna las top-N prioridades a los huecos libres del día por scoring
        determinístico (priority * urgency * fit). Devuelve un borrador —
        el agente o el usuario decide si lo aplica.

        Returns:
            { date, plan: [{slot, suggestion: {note_id, title, reason}}] }
        """
        check_rate_limit(is_write=False)

        priorities_payload = await get_daily_priorities(max_items=20)
        free_payload = await get_free_time_slots(date)

        slots = free_payload["slots"]
        items = priorities_payload["items"]

        plan: list[dict[str, Any]] = []
        used_items: set[str] = set()
        for slot in slots:
            slot_minutes = slot["minutes"]
            # Best-fit: pick the highest-scoring unused item that "fits" —
            # tasks with higher priority go first; we don't try to estimate
            # task duration here (that's a future field), so we just take
            # the next best item per slot until we run out.
            for item in items:
                if item["id"] in used_items:
                    continue
                used_items.add(item["id"])
                plan.append({
                    "slot": slot,
                    "suggestion": {
                        "note_id": item["id"],
                        "title": item["title"],
                        "score": item["score"],
                        "reason": ", ".join(item.get("reasons") or []) or "high priority",
                        "estimated_minutes": min(slot_minutes, 60),
                    },
                })
                break
            if len(plan) >= max_suggestions:
                break

        return {
            "date": free_payload["date"],
            "plan": plan,
            "unused_slots": max(0, len(slots) - len(plan)),
        }


# ----------------------------------------------------------------------------
# Helper used by the calendar-aware intelligence tools above.
# Kept module-level (not nested) so it's testable in isolation.
# ----------------------------------------------------------------------------

def _expand_event_in_window(
    row: dict[str, Any],
    window_start: datetime,
    window_end: datetime,
    rrulestr_fn,
) -> list[dict[str, Any]]:
    """Same shape as the MCP calendar tool — expand RRULE inside [start,end]."""
    base = {
        "id": row["id"],
        "calendar_id": row["calendar_id"],
        "title": row["title"],
        "description": row.get("description"),
        "location": row.get("location"),
        "starts_at": row["starts_at"],
        "ends_at": row["ends_at"],
        "all_day": row.get("all_day", False),
        "linked_note_id": row.get("linked_note_id"),
    }
    if not row.get("rrule"):
        s = _parse_iso(row["starts_at"])
        e = _parse_iso(row["ends_at"])
        if not s or not e or e < window_start or s > window_end:
            return []
        base["instance_start"] = base["starts_at"]
        return [base]

    dtstart = _parse_iso(row["starts_at"])
    dtend = _parse_iso(row["ends_at"])
    if dtstart is None or dtend is None:
        return []
    duration = dtend - dtstart
    rule = rrulestr_fn(row["rrule"], dtstart=dtstart)
    exdates = {(_parse_iso(d) or dtstart).isoformat()
               for d in (row.get("rrule_exdates") or [])}
    out: list[dict[str, Any]] = []
    for occ in rule.between(window_start, window_end, inc=True):
        starts_iso = occ.isoformat()
        if starts_iso in exdates:
            continue
        instance = dict(base)
        instance["starts_at"] = starts_iso
        instance["ends_at"] = (occ + duration).isoformat()
        instance["instance_start"] = starts_iso
        out.append(instance)
    return out
