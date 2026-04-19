"""
API Key authentication for DeskFlow REST endpoints.

Each user can mint multiple keys (one per agent / integration). Keys are
stored hashed (SHA-256 hex). The plaintext is shown only once, when the key
is created. Calls supply the key in the `X-API-Key` header.

This module is independent of the Supabase user-token auth used by Claude
Desktop — the two coexist: user tokens for the human-facing app, API keys
for autonomous agents.
"""

from __future__ import annotations

import hashlib
import os
import secrets
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, Header
from supabase import Client, create_client


SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")

KEY_PREFIX = "dfk_"   # "DeskFlow Key" — easy to identify in logs


def _service_client() -> Client:
    """
    Server-side client used to read api_keys without an end-user token.
    Falls back to the anon key when SUPABASE_SERVICE_KEY is not configured —
    in that case the api_keys/api_logs tables must allow the relevant policy.
    """
    key = SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY
    if not SUPABASE_URL or not key:
        raise RuntimeError("SUPABASE_URL and a service/anon key are required for api_keys")
    return create_client(SUPABASE_URL, key)


def hash_key(plaintext: str) -> str:
    """SHA-256 hex of the API key. Stored in api_keys.key_hash."""
    return hashlib.sha256(plaintext.encode("utf-8")).hexdigest()


def generate_key() -> tuple[str, str, str]:
    """
    Mint a new API key. Returns (plaintext, prefix, hash).
    Plaintext is `dfk_` + 40 random url-safe chars.
    """
    body = secrets.token_urlsafe(32)
    plaintext = f"{KEY_PREFIX}{body}"
    return plaintext, plaintext[:8], hash_key(plaintext)


def verify_api_key(
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    required_scope: Optional[str] = None,
) -> dict:
    """
    Validate an incoming API key. Returns the api_keys row on success.
    Raises 401/403 otherwise.

    Use as a FastAPI dependency:

        def endpoint(key=Depends(verify_api_key)): ...
    """
    if not x_api_key:
        raise HTTPException(status_code=401, detail="Missing X-API-Key header")

    digest = hash_key(x_api_key)
    client = _service_client()
    result = client.table("api_keys") \
        .select("id, user_id, name, scopes, rate_limit, revoked") \
        .eq("key_hash", digest) \
        .single() \
        .execute()

    if not result.data:
        raise HTTPException(status_code=401, detail="Invalid API key")
    row = result.data
    if row.get("revoked"):
        raise HTTPException(status_code=403, detail="API key revoked")

    scopes = row.get("scopes") or []
    if required_scope and required_scope not in scopes and "admin" not in scopes:
        raise HTTPException(
            status_code=403,
            detail=f"API key missing required scope: {required_scope}",
        )

    # TODO: Enforce rate_limit per API key (row["rate_limit"] requests/min).
    # Currently stored but not checked — implement with a sliding window
    # counter (Redis or in-memory) when traffic justifies it.

    # Touch last_used_at; intentionally fire-and-forget.
    try:
        client.table("api_keys") \
            .update({"last_used_at": datetime.now(timezone.utc).isoformat()}) \
            .eq("id", row["id"]) \
            .execute()
    except Exception:
        pass

    return row


def require_scope(scope: str):
    """Dependency factory for endpoints that require a specific scope."""
    def _dep(x_api_key: Optional[str] = Header(None, alias="X-API-Key")) -> dict:
        return verify_api_key(x_api_key=x_api_key, required_scope=scope)
    return _dep


def log_api_call(
    api_key_row: dict,
    action: str,
    tool_name: Optional[str] = None,
    resource_id: Optional[str] = None,
    status: int = 200,
) -> None:
    """Append an audit-log entry. Best-effort; never raises."""
    try:
        _service_client().table("api_logs").insert({
            "api_key_id": api_key_row["id"],
            "user_id": api_key_row["user_id"],
            "action": action,
            "tool_name": tool_name,
            "resource_id": resource_id,
            "status": status,
        }).execute()
    except Exception:
        pass


def supabase_for_user(user_id: str) -> Client:
    """
    Get a Supabase client scoped to a specific user, bypassing RLS via the
    service role. Required so an agent's API key (which represents a user)
    can read/write that user's data.
    """
    if not SUPABASE_SERVICE_KEY:
        raise HTTPException(
            status_code=500,
            detail="SUPABASE_SERVICE_KEY is not configured for agent operations",
        )
    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    # When using the service role, each query must constrain by user_id /
    # workspace ownership manually. The endpoints in server_remote.py do this.
    return client
