"""
DeskFlow MCP Server - Metadata Tools
====================================
Operations on the intelligence layer (NoteMetadata) attached to notes.

The metadata column is stored as JSONB on `notes.metadata` and defaults to
`{}` so notes without metadata behave exactly as before. Every helper here
treats a missing or empty metadata object as "no intelligence layer set".
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from mcp.server.fastmcp import FastMCP

from auth import check_rate_limit, get_authenticated_client


VALID_TYPES = {
    "note", "task", "project", "reference",
    "contact", "meeting", "idea", "log",
}
VALID_STATUSES = {
    "active", "inactive", "completed", "archived", "blocked",
}


def _validate_metadata_patch(patch: dict[str, Any]) -> dict[str, Any]:
    """Lightly validate a metadata patch before persisting it.

    We keep validation forgiving so agents can experiment with custom keys,
    but we reject obviously wrong values for the typed fields the engine
    relies on (type, status, priority, dueDate, tags, progress).
    """
    cleaned: dict[str, Any] = {}

    if "type" in patch:
        value = patch["type"]
        if value is None:
            cleaned["type"] = None
        elif isinstance(value, str) and value in VALID_TYPES:
            cleaned["type"] = value
        else:
            raise ValueError(f"metadata.type must be one of {sorted(VALID_TYPES)}")

    if "status" in patch:
        value = patch["status"]
        if value is None:
            cleaned["status"] = None
        elif isinstance(value, str) and value in VALID_STATUSES:
            cleaned["status"] = value
        else:
            raise ValueError(f"metadata.status must be one of {sorted(VALID_STATUSES)}")

    if "priority" in patch:
        value = patch["priority"]
        if value is None:
            cleaned["priority"] = None
        elif isinstance(value, int) and 1 <= value <= 5:
            cleaned["priority"] = value
        else:
            raise ValueError("metadata.priority must be an int in 1..5")

    if "tags" in patch:
        value = patch["tags"]
        if value is None:
            cleaned["tags"] = None
        elif isinstance(value, list) and all(isinstance(t, str) for t in value):
            cleaned["tags"] = [t.strip() for t in value if t.strip()]
        else:
            raise ValueError("metadata.tags must be a list of strings")

    if "dueDate" in patch:
        value = patch["dueDate"]
        if value is None:
            cleaned["dueDate"] = None
        elif isinstance(value, str):
            # Accept ISO-8601 dates or datetimes; reject obvious nonsense.
            try:
                datetime.fromisoformat(value.replace("Z", "+00:00"))
            except ValueError as exc:
                raise ValueError(f"metadata.dueDate must be ISO-8601: {exc}") from exc
            cleaned["dueDate"] = value
        else:
            raise ValueError("metadata.dueDate must be an ISO-8601 string")

    if "progress" in patch:
        value = patch["progress"]
        if value is None:
            cleaned["progress"] = None
        elif isinstance(value, (int, float)) and 0 <= value <= 100:
            cleaned["progress"] = float(value)
        else:
            raise ValueError("metadata.progress must be a number in 0..100")

    # Free-form fields — pass through unchanged so agents can extend the layer.
    for key in ("assignee", "source", "linkedResources", "customFields", "lastReviewedAt"):
        if key in patch:
            cleaned[key] = patch[key]

    return cleaned


def _merge_metadata(existing: Optional[dict[str, Any]], patch: dict[str, Any]) -> dict[str, Any]:
    """Apply `patch` on top of `existing`, removing keys explicitly set to None."""
    merged = dict(existing or {})
    for key, value in patch.items():
        if value is None:
            merged.pop(key, None)
        else:
            merged[key] = value
    return merged


def register_metadata_tools(mcp: FastMCP):
    """Register intelligence/metadata MCP tools."""

    @mcp.tool()
    async def update_note_metadata(
        note_id: str,
        type: Optional[str] = None,
        status: Optional[str] = None,
        priority: Optional[int] = None,
        tags: Optional[list[str]] = None,
        due_date: Optional[str] = None,
        assignee: Optional[str] = None,
        source: Optional[str] = None,
        progress: Optional[float] = None,
        mark_reviewed: bool = False,
        replace: bool = False,
    ) -> dict[str, Any]:
        """
        Update a note's intelligence metadata.

        By default this MERGES the patch into the existing metadata. Pass
        `replace=True` to overwrite the whole metadata blob.

        Args:
            note_id: UUID of the note to update.
            type: One of note|task|project|reference|contact|meeting|idea|log.
            status: One of active|inactive|completed|archived|blocked.
            priority: Integer 1 (urgent) .. 5 (someday).
            tags: List of free-form tags.
            due_date: ISO-8601 date or datetime.
            assignee: Free-form responsible party.
            source: Origin marker, e.g. 'manual', 'agent:sendell', 'connector:gmail'.
            progress: 0..100 percent complete (useful for type='project').
            mark_reviewed: If True, sets lastReviewedAt to now.
            replace: If True, the patch becomes the entire metadata.

        Returns:
            The note row with its new metadata.
        """
        check_rate_limit(is_write=True)

        if not note_id or len(note_id) != 36:
            raise ValueError("note_id debe ser un UUID válido")

        patch_input: dict[str, Any] = {}
        if type is not None:
            patch_input["type"] = type
        if status is not None:
            patch_input["status"] = status
        if priority is not None:
            patch_input["priority"] = priority
        if tags is not None:
            patch_input["tags"] = tags
        if due_date is not None:
            patch_input["dueDate"] = due_date
        if assignee is not None:
            patch_input["assignee"] = assignee
        if source is not None:
            patch_input["source"] = source
        if progress is not None:
            patch_input["progress"] = progress
        if mark_reviewed:
            patch_input["lastReviewedAt"] = datetime.now(timezone.utc).isoformat()

        if not patch_input:
            raise ValueError("Provide at least one metadata field to update")

        cleaned = _validate_metadata_patch(patch_input)

        client = await get_authenticated_client()

        if replace:
            new_metadata = {k: v for k, v in cleaned.items() if v is not None}
        else:
            existing = client.table("notes") \
                .select("metadata") \
                .eq("id", note_id) \
                .single() \
                .execute()
            if not existing.data:
                raise ValueError(f"Nota {note_id} no encontrada")
            new_metadata = _merge_metadata(existing.data.get("metadata"), cleaned)

        result = client.table("notes") \
            .update({
                "metadata": new_metadata,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }) \
            .eq("id", note_id) \
            .execute()

        if not result.data:
            raise ValueError(f"Nota {note_id} no encontrada")

        return result.data[0]

    @mcp.tool()
    async def get_note_metadata(note_id: str) -> dict[str, Any]:
        """
        Read the intelligence metadata attached to a note.

        Args:
            note_id: UUID of the note.

        Returns:
            { note_id, metadata }. `metadata` is `{}` for notes without one.
        """
        check_rate_limit(is_write=False)

        if not note_id or len(note_id) != 36:
            raise ValueError("note_id debe ser un UUID válido")

        client = await get_authenticated_client()
        result = client.table("notes") \
            .select("id, metadata") \
            .eq("id", note_id) \
            .single() \
            .execute()

        if not result.data:
            raise ValueError(f"Nota {note_id} no encontrada")

        return {
            "note_id": result.data["id"],
            "metadata": result.data.get("metadata") or {},
        }

    @mcp.tool()
    async def filter_notes_by_metadata(
        workspace_id: str,
        type: Optional[str] = None,
        status: Optional[str] = None,
        min_priority: Optional[int] = None,
        max_priority: Optional[int] = None,
        tag: Optional[str] = None,
        due_before: Optional[str] = None,
        due_after: Optional[str] = None,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        """
        Filter notes within a workspace by their intelligence metadata.

        Any combination of filters can be supplied; they're ANDed together.

        Args:
            workspace_id: UUID of the workspace to scope the search.
            type: Match notes whose metadata.type equals this value.
            status: Match notes whose metadata.status equals this value.
            min_priority / max_priority: Inclusive bounds on metadata.priority.
            tag: Match notes that contain this tag in metadata.tags.
            due_before / due_after: ISO-8601 bounds on metadata.dueDate.
            limit: Maximum rows to return (1..200).

        Returns:
            Matching notes (id, title, desktop_id, metadata, updated_at).
        """
        check_rate_limit(is_write=False)

        if not workspace_id or len(workspace_id) != 36:
            raise ValueError("workspace_id debe ser un UUID válido")

        limit = min(max(1, limit), 200)

        client = await get_authenticated_client()

        desktops = client.table("desktops") \
            .select("id") \
            .eq("workspace_id", workspace_id) \
            .execute()
        desktop_ids = [d["id"] for d in (desktops.data or [])]
        if not desktop_ids:
            return []

        query = client.table("notes") \
            .select("id, title, desktop_id, metadata, updated_at") \
            .in_("desktop_id", desktop_ids)

        if type is not None:
            if type not in VALID_TYPES:
                raise ValueError(f"type must be one of {sorted(VALID_TYPES)}")
            query = query.eq("metadata->>type", type)
        if status is not None:
            if status not in VALID_STATUSES:
                raise ValueError(f"status must be one of {sorted(VALID_STATUSES)}")
            query = query.eq("metadata->>status", status)
        if min_priority is not None:
            query = query.gte("metadata->>priority", str(min_priority))
        if max_priority is not None:
            query = query.lte("metadata->>priority", str(max_priority))
        if due_before is not None:
            query = query.lte("metadata->>dueDate", due_before)
        if due_after is not None:
            query = query.gte("metadata->>dueDate", due_after)
        if tag is not None:
            # `cs` = JSONB contains. Wrap the tag in JSON-list form so PostgREST
            # produces `metadata->tags @> '["tag"]'`.
            query = query.contains("metadata->tags", [tag])

        result = query.limit(limit).execute()
        return result.data or []
