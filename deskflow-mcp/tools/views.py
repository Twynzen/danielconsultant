"""
DeskFlow MCP Server - Smart View Projections
=============================================
Read-only views over the workspace optimised for agents that want a flat
projection (table), a Kanban-style status grouping, or a timeline.

These are deliberately thin wrappers over `intelligence._fetch_workspace_notes`
so the agent and frontend share a single shape.
"""

from __future__ import annotations

from typing import Any, Optional

from mcp.server.fastmcp import FastMCP

from auth import check_rate_limit, get_authenticated_client
from .intelligence import (
    _fetch_workspace_notes,
    _resolve_workspace,
    _parse_iso,
)


def _flat(note: dict[str, Any]) -> dict[str, Any]:
    desktop = note.get("_desktop") or {}
    metadata = note.get("metadata") or {}
    return {
        "id": note["id"],
        "title": note["title"],
        "desktop_id": note["desktop_id"],
        "desktop_name": desktop.get("name"),
        "type": metadata.get("type"),
        "status": metadata.get("status"),
        "priority": metadata.get("priority"),
        "due_date": metadata.get("dueDate"),
        "tags": metadata.get("tags") or [],
        "updated_at": note.get("updated_at"),
    }


def register_view_tools(mcp: FastMCP):
    @mcp.tool()
    async def get_table_view(
        workspace_id: Optional[str] = None,
        type: Optional[str] = None,
        status: Optional[str] = None,
        tag: Optional[str] = None,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """
        Flat list of notes with their metadata, suitable for spreadsheet-style
        rendering. Filters compose with AND.
        """
        check_rate_limit(is_write=False)
        limit = min(max(1, limit), 500)

        client = await get_authenticated_client()
        wid = await _resolve_workspace(client, workspace_id)
        notes = await _fetch_workspace_notes(client, wid)

        rows = []
        for n in notes:
            m = n.get("metadata") or {}
            if type and m.get("type") != type:
                continue
            if status and m.get("status") != status:
                continue
            if tag and tag not in (m.get("tags") or []):
                continue
            rows.append(_flat(n))

        return rows[:limit]

    @mcp.tool()
    async def get_kanban_view(
        workspace_id: Optional[str] = None,
    ) -> dict[str, list[dict[str, Any]]]:
        """
        Notes grouped by metadata.status. Notes without a status land in the
        'none' bucket.
        """
        check_rate_limit(is_write=False)

        client = await get_authenticated_client()
        wid = await _resolve_workspace(client, workspace_id)
        notes = await _fetch_workspace_notes(client, wid)

        buckets: dict[str, list[dict[str, Any]]] = {
            "blocked": [], "active": [], "inactive": [],
            "none": [], "completed": [], "archived": [],
        }
        for n in notes:
            m = n.get("metadata") or {}
            status = m.get("status") or "none"
            buckets.setdefault(status, []).append(_flat(n))
        return buckets

    @mcp.tool()
    async def get_timeline_view(
        workspace_id: Optional[str] = None,
        start: Optional[str] = None,
        end: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        """
        Items with `dueDate`, optionally bounded by [start, end] (ISO-8601).
        Sorted ascending by dueDate.
        """
        check_rate_limit(is_write=False)

        client = await get_authenticated_client()
        wid = await _resolve_workspace(client, workspace_id)
        notes = await _fetch_workspace_notes(client, wid)

        start_dt = _parse_iso(start) if start else None
        end_dt = _parse_iso(end) if end else None

        rows = []
        for n in notes:
            m = n.get("metadata") or {}
            due = _parse_iso(m.get("dueDate"))
            if due is None:
                continue
            if start_dt and due < start_dt:
                continue
            if end_dt and due > end_dt:
                continue
            rows.append(_flat(n))

        rows.sort(key=lambda r: r["due_date"] or "")
        return rows
