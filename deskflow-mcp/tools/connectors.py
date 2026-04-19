"""
DeskFlow MCP Server - Connector Registry
=========================================
CRUD over the `connectors` table created by the intelligence-engine
migration. A connector row represents one external data source for one user
(e.g. the user's Google Calendar, a GitHub org, a Slack workspace).

The registry is deliberately minimal: we store the connector name, an
arbitrary JSONB config, the target desktop to ingest into, and sync state.
Actually pulling data from the external service lives in separate
ingestion paths (see server_remote.py /api/agent/ingest and the ICS
endpoint) so each integration can be implemented independently.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from mcp.server.fastmcp import FastMCP

from auth import check_rate_limit, get_authenticated_client


KNOWN_CONNECTORS = {"gmail", "calendar", "github", "slack", "generic"}


def register_connector_tools(mcp: FastMCP):
    """Register connector-registry MCP tools."""

    @mcp.tool()
    async def list_connectors() -> list[dict[str, Any]]:
        """
        List every connector configured for the current user.

        Returns one row per (user, connector name) pair, with config,
        target desktop id, and last sync status.
        """
        check_rate_limit(is_write=False)
        client = await get_authenticated_client()
        result = client.table("connectors") \
            .select("id, name, enabled, target_desktop_id, config, "
                    "last_sync_at, last_sync_status, created_at") \
            .order("created_at", desc=True) \
            .execute()
        return result.data or []

    @mcp.tool()
    async def upsert_connector(
        name: str,
        enabled: bool = True,
        target_desktop_id: Optional[str] = None,
        config: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """
        Create or update a connector configuration.

        Args:
            name: Connector identifier (gmail, calendar, github, slack, generic...).
            enabled: Whether the connector should be called by sync jobs.
            target_desktop_id: Desktop to ingest into. Required for anything
                meaningful — the ingestion path needs a destination.
            config: Arbitrary JSON configuration (feed URL, repo name, filters...).

        Returns:
            The resulting connectors row.
        """
        check_rate_limit(is_write=True)

        if not name or not name.strip():
            raise ValueError("name is required")
        if target_desktop_id is not None and len(target_desktop_id) != 36:
            raise ValueError("target_desktop_id must be a UUID")

        client = await get_authenticated_client()

        # Resolve the current user id — required because the connectors row
        # needs user_id set and supabase-py doesn't auto-inject it.
        me = client.auth.get_user()
        if not me or not me.user:
            raise ValueError("Could not resolve authenticated user")
        user_id = me.user.id

        existing = client.table("connectors") \
            .select("id") \
            .eq("user_id", user_id) \
            .eq("name", name) \
            .execute()

        payload: dict[str, Any] = {
            "user_id": user_id,
            "name": name,
            "enabled": enabled,
            "target_desktop_id": target_desktop_id,
            "config": config or {},
        }

        if existing.data:
            connector_id = existing.data[0]["id"]
            result = client.table("connectors") \
                .update(payload) \
                .eq("id", connector_id) \
                .execute()
        else:
            result = client.table("connectors") \
                .insert(payload) \
                .execute()

        if not result.data:
            raise ValueError("Failed to upsert connector")
        return result.data[0]

    @mcp.tool()
    async def delete_connector(connector_id: str) -> dict[str, str]:
        """
        Remove a connector registration.
        Does NOT delete notes already ingested by the connector.
        """
        check_rate_limit(is_write=True)
        if not connector_id or len(connector_id) != 36:
            raise ValueError("connector_id must be a UUID")

        client = await get_authenticated_client()
        me = client.auth.get_user()
        if not me or not me.user:
            raise ValueError("Could not resolve authenticated user")
        result = client.table("connectors") \
            .delete() \
            .eq("id", connector_id) \
            .eq("user_id", me.user.id) \
            .execute()
        if not result.data:
            raise ValueError(f"Connector {connector_id} not found or not owned by you")
        return {"message": f"Connector {connector_id} eliminado"}

    @mcp.tool()
    async def mark_connector_synced(
        connector_id: str,
        status: str = "ok",
    ) -> dict[str, Any]:
        """
        Update a connector's last-sync timestamp. Call this from ingestion
        jobs after they finish so the UI can show "last synced: 5 min ago".
        """
        check_rate_limit(is_write=True)
        if not connector_id or len(connector_id) != 36:
            raise ValueError("connector_id must be a UUID")

        client = await get_authenticated_client()
        me = client.auth.get_user()
        if not me or not me.user:
            raise ValueError("Could not resolve authenticated user")
        result = client.table("connectors") \
            .update({
                "last_sync_at": datetime.now(timezone.utc).isoformat(),
                "last_sync_status": status,
            }) \
            .eq("id", connector_id) \
            .eq("user_id", me.user.id) \
            .execute()
        if not result.data:
            raise ValueError(f"Connector {connector_id} not found or not owned by you")
        return result.data[0]
