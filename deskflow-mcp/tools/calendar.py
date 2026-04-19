"""
DeskFlow MCP Server — Calendar Tools
====================================
Calendars, events (single + recurring) and event ↔ note linking.

Designed so any agent (Claude Desktop, Sendell, Gemini, n8n, custom) can
read and write the user's calendar through the same authenticated channel
as the rest of DeskFlow. Recurring events use RFC 5545 RRULE strings and
are expanded server-side on `list_events` so callers never have to deal
with iCal arithmetic.
"""

from typing import Any, Optional
from datetime import datetime, timezone

from dateutil.rrule import rrulestr
from mcp.server.fastmcp import FastMCP

from auth import get_authenticated_client, check_rate_limit


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _is_uuid(value: str) -> bool:
    return bool(value) and len(value) == 36 and value.count("-") == 4


def _parse_iso(value: str) -> datetime:
    """Parse an ISO-8601 string. Raises ValueError on bad input."""
    if not value:
        raise ValueError("ISO datetime is required")
    # fromisoformat handles "Z" since Python 3.11; older runtimes need a swap.
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"
    dt = datetime.fromisoformat(value)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _serialize_event(row: dict[str, Any]) -> dict[str, Any]:
    """Drop internal columns we don't want to expose."""
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


def _expand_recurring(
    row: dict[str, Any],
    window_start: datetime,
    window_end: datetime,
) -> list[dict[str, Any]]:
    """
    Expand a single recurring event row into instance dicts that fall
    within [window_start, window_end]. The original row's id is reused for
    every instance with `instance_start` describing which occurrence it is —
    callers can use (id, instance_start) as a stable composite key.
    """
    base = _serialize_event(row)
    if not row.get("rrule"):
        # Single event: include if it overlaps the window.
        starts = _parse_iso(row["starts_at"])
        ends = _parse_iso(row["ends_at"])
        if ends < window_start or starts > window_end:
            return []
        base["instance_start"] = base["starts_at"]
        return [base]

    duration = _parse_iso(row["ends_at"]) - _parse_iso(row["starts_at"])
    dtstart = _parse_iso(row["starts_at"])
    rule = rrulestr(row["rrule"], dtstart=dtstart)

    exdates = {_parse_iso(d).isoformat() for d in (row.get("rrule_exdates") or [])}

    out: list[dict[str, Any]] = []
    # `between` is inclusive at both ends with inc=True.
    for occurrence in rule.between(window_start, window_end, inc=True):
        starts_iso = occurrence.isoformat()
        if starts_iso in exdates:
            continue
        instance = dict(base)
        instance["starts_at"] = starts_iso
        instance["ends_at"] = (occurrence + duration).isoformat()
        instance["instance_start"] = starts_iso
        out.append(instance)
    return out


# ---------------------------------------------------------------------------
# Tool registration
# ---------------------------------------------------------------------------

def register_calendar_tools(mcp: FastMCP):
    """Register every calendar-related MCP tool."""

    # ===== Calendars =========================================================

    @mcp.tool()
    async def list_calendars() -> list[dict[str, Any]]:
        """Lista los calendarios del usuario autenticado."""
        check_rate_limit(is_write=False)
        client = await get_authenticated_client()
        result = client.table("calendars") \
            .select("id, name, color, visible, is_default, source, created_at") \
            .order("is_default", desc=True) \
            .order("name") \
            .execute()
        return result.data or []

    @mcp.tool()
    async def create_calendar(
        name: str,
        color: str = "#00ff41",
        is_default: bool = False,
    ) -> dict[str, Any]:
        """
        Crea un calendario nuevo.

        Args:
            name: Nombre del calendario (1–80 chars).
            color: Color hex con # (default verde Matrix).
            is_default: Si es el calendario default para nuevos eventos.
        """
        check_rate_limit(is_write=True)
        if not name or not name.strip():
            raise ValueError("name es requerido")
        if len(name) > 80:
            raise ValueError("name no puede exceder 80 caracteres")
        if not color.startswith("#") or len(color) not in (4, 7, 9):
            raise ValueError("color debe ser un hex con #")

        client = await get_authenticated_client()
        me = client.auth.get_user()
        if not me or not me.user:
            raise ValueError("No se pudo resolver el usuario autenticado")

        if is_default:
            # Only one default per user — clear the others first.
            client.table("calendars") \
                .update({"is_default": False}) \
                .eq("user_id", me.user.id) \
                .eq("is_default", True) \
                .execute()

        result = client.table("calendars").insert({
            "user_id": me.user.id,
            "name": name.strip(),
            "color": color,
            "is_default": is_default,
        }).execute()

        if not result.data:
            raise ValueError("No se pudo crear el calendario")
        return result.data[0]

    @mcp.tool()
    async def update_calendar(
        calendar_id: str,
        name: Optional[str] = None,
        color: Optional[str] = None,
        visible: Optional[bool] = None,
        is_default: Optional[bool] = None,
    ) -> dict[str, Any]:
        """Actualiza un calendario existente."""
        check_rate_limit(is_write=True)
        if not _is_uuid(calendar_id):
            raise ValueError("calendar_id debe ser UUID")

        client = await get_authenticated_client()
        me = client.auth.get_user()
        if not me or not me.user:
            raise ValueError("No se pudo resolver el usuario autenticado")

        patch: dict[str, Any] = {}
        if name is not None:
            if not name.strip():
                raise ValueError("name no puede estar vacío")
            patch["name"] = name.strip()
        if color is not None:
            patch["color"] = color
        if visible is not None:
            patch["visible"] = visible
        if is_default is True:
            client.table("calendars") \
                .update({"is_default": False}) \
                .eq("user_id", me.user.id) \
                .eq("is_default", True) \
                .execute()
            patch["is_default"] = True
        elif is_default is False:
            patch["is_default"] = False

        if not patch:
            raise ValueError("Nada que actualizar")

        result = client.table("calendars") \
            .update(patch) \
            .eq("id", calendar_id) \
            .eq("user_id", me.user.id) \
            .execute()

        if not result.data:
            raise ValueError(f"Calendar {calendar_id} no encontrado")
        return result.data[0]

    @mcp.tool()
    async def delete_calendar(calendar_id: str) -> dict[str, str]:
        """Elimina un calendario y todos sus eventos (cascada)."""
        check_rate_limit(is_write=True)
        if not _is_uuid(calendar_id):
            raise ValueError("calendar_id debe ser UUID")

        client = await get_authenticated_client()
        me = client.auth.get_user()
        if not me or not me.user:
            raise ValueError("No se pudo resolver el usuario autenticado")

        result = client.table("calendars") \
            .delete() \
            .eq("id", calendar_id) \
            .eq("user_id", me.user.id) \
            .execute()
        if not result.data:
            raise ValueError(f"Calendar {calendar_id} no encontrado")
        return {"message": f"Calendar {calendar_id} eliminado"}

    # ===== Events ============================================================

    @mcp.tool()
    async def list_events(
        start: str,
        end: str,
        calendar_ids: Optional[list[str]] = None,
    ) -> list[dict[str, Any]]:
        """
        Lista eventos en el rango [start, end] (ISO 8601). Los eventos
        recurrentes se expanden en el servidor — recibes una entrada por
        cada instancia, todas con el mismo `id` pero distinto `instance_start`.

        Args:
            start: ISO start of the window (inclusive).
            end: ISO end of the window (inclusive).
            calendar_ids: Filtra a uno o más calendarios. None = todos.
        """
        check_rate_limit(is_write=False)
        window_start = _parse_iso(start)
        window_end = _parse_iso(end)
        if window_end < window_start:
            raise ValueError("end debe ser >= start")

        client = await get_authenticated_client()

        # Pull every event whose series MIGHT intersect the window. For
        # non-recurring events we filter by overlap directly. For recurring
        # ones we have to fetch all and let the expander decide; in practice
        # users keep counts manageable (few hundreds) so this stays fast.
        query = client.table("calendar_events") \
            .select("*")
        if calendar_ids:
            for cid in calendar_ids:
                if not _is_uuid(cid):
                    raise ValueError("calendar_ids debe contener UUIDs válidos")
            query = query.in_("calendar_id", calendar_ids)

        result = query.execute()
        rows = result.data or []

        # Filter by visible calendars unless the caller asked for specific ones.
        if not calendar_ids:
            cal_q = client.table("calendars") \
                .select("id, visible") \
                .execute()
            visible = {c["id"] for c in (cal_q.data or []) if c.get("visible", True)}
            rows = [r for r in rows if r["calendar_id"] in visible]

        out: list[dict[str, Any]] = []
        for row in rows:
            out.extend(_expand_recurring(row, window_start, window_end))
        out.sort(key=lambda e: e["starts_at"])
        return out

    @mcp.tool()
    async def get_event(event_id: str) -> dict[str, Any]:
        """Devuelve un evento por id (sin expansión de RRULE)."""
        check_rate_limit(is_write=False)
        if not _is_uuid(event_id):
            raise ValueError("event_id debe ser UUID")
        client = await get_authenticated_client()
        result = client.table("calendar_events") \
            .select("*") \
            .eq("id", event_id) \
            .single() \
            .execute()
        if not result.data:
            raise ValueError(f"Event {event_id} no encontrado")
        return _serialize_event(result.data)

    @mcp.tool()
    async def create_event(
        calendar_id: str,
        title: str,
        starts_at: str,
        ends_at: str,
        all_day: bool = False,
        description: Optional[str] = None,
        location: Optional[str] = None,
        rrule: Optional[str] = None,
        linked_note_id: Optional[str] = None,
        reminders: Optional[list[dict[str, Any]]] = None,
    ) -> dict[str, Any]:
        """
        Crea un evento. Para eventos recurrentes pasa un `rrule` en formato
        RFC 5545 (ej: "FREQ=WEEKLY;BYDAY=MO,WE").

        `reminders` es opcional, formato: [{minutes_before:int, channel:str}].
        """
        check_rate_limit(is_write=True)
        if not _is_uuid(calendar_id):
            raise ValueError("calendar_id debe ser UUID")
        if not title or not title.strip():
            raise ValueError("title es requerido")
        if linked_note_id and not _is_uuid(linked_note_id):
            raise ValueError("linked_note_id debe ser UUID")

        starts = _parse_iso(starts_at)
        ends = _parse_iso(ends_at)
        if ends < starts:
            raise ValueError("ends_at debe ser >= starts_at")

        if rrule:
            # Validate by attempting to parse — raises if malformed.
            rrulestr(rrule, dtstart=starts)

        client = await get_authenticated_client()
        me = client.auth.get_user()
        if not me or not me.user:
            raise ValueError("No se pudo resolver el usuario autenticado")

        # Verify calendar belongs to the user (defense in depth — RLS already
        # enforces this but a clear error beats a generic 403).
        cal = client.table("calendars") \
            .select("id") \
            .eq("id", calendar_id) \
            .eq("user_id", me.user.id) \
            .execute()
        if not cal.data:
            raise ValueError("calendar_id no pertenece al usuario")

        row = {
            "user_id": me.user.id,
            "calendar_id": calendar_id,
            "title": title.strip()[:200],
            "description": description,
            "location": location,
            "starts_at": starts.isoformat(),
            "ends_at": ends.isoformat(),
            "all_day": all_day,
            "rrule": rrule,
            "linked_note_id": linked_note_id,
        }
        result = client.table("calendar_events").insert(row).execute()
        if not result.data:
            raise ValueError("No se pudo crear el evento")
        event = result.data[0]

        # Materialize reminders if any.
        if reminders:
            for r in reminders:
                minutes = int(r.get("minutes_before", 0))
                channel = r.get("channel", "whatsapp")
                if channel not in ("whatsapp", "toast", "both"):
                    raise ValueError("channel inválido")
                fire_at = (starts.timestamp() - minutes * 60)
                fire_at_iso = datetime.fromtimestamp(fire_at, tz=timezone.utc).isoformat()
                client.table("event_reminders").insert({
                    "user_id": me.user.id,
                    "event_id": event["id"],
                    "minutes_before": minutes,
                    "channel": channel,
                    "fire_at": fire_at_iso,
                }).execute()

        return _serialize_event(event)

    @mcp.tool()
    async def update_event(
        event_id: str,
        scope: str = "this",
        title: Optional[str] = None,
        starts_at: Optional[str] = None,
        ends_at: Optional[str] = None,
        all_day: Optional[bool] = None,
        description: Optional[str] = None,
        location: Optional[str] = None,
        rrule: Optional[str] = None,
        linked_note_id: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        Actualiza un evento.

        scope:
          - "this":   solo esta instancia (añade EXDATE + crea evento aislado)
          - "future": esta y las siguientes (parte la serie)
          - "all":    toda la serie

        Para eventos no-recurrentes, scope se ignora (todos los modos hacen
        lo mismo).
        """
        check_rate_limit(is_write=True)
        if not _is_uuid(event_id):
            raise ValueError("event_id debe ser UUID")
        if scope not in ("this", "future", "all"):
            raise ValueError("scope debe ser 'this', 'future' o 'all'")

        client = await get_authenticated_client()
        me = client.auth.get_user()
        if not me or not me.user:
            raise ValueError("No se pudo resolver el usuario autenticado")

        existing = client.table("calendar_events") \
            .select("*") \
            .eq("id", event_id) \
            .eq("user_id", me.user.id) \
            .single() \
            .execute()
        if not existing.data:
            raise ValueError(f"Event {event_id} no encontrado")
        row = existing.data
        is_recurring = bool(row.get("rrule"))

        patch: dict[str, Any] = {"updated_at": datetime.now(timezone.utc).isoformat()}
        if title is not None:
            patch["title"] = title.strip()[:200]
        if starts_at is not None:
            patch["starts_at"] = _parse_iso(starts_at).isoformat()
        if ends_at is not None:
            patch["ends_at"] = _parse_iso(ends_at).isoformat()
        if all_day is not None:
            patch["all_day"] = all_day
        if description is not None:
            patch["description"] = description
        if location is not None:
            patch["location"] = location
        if rrule is not None:
            if rrule:
                rrulestr(rrule, dtstart=_parse_iso(patch.get("starts_at") or row["starts_at"]))
            patch["rrule"] = rrule or None
        if linked_note_id is not None:
            if linked_note_id and not _is_uuid(linked_note_id):
                raise ValueError("linked_note_id debe ser UUID")
            patch["linked_note_id"] = linked_note_id or None

        if not is_recurring or scope == "all":
            client.table("calendar_events") \
                .update(patch) \
                .eq("id", event_id) \
                .execute()
            return _serialize_event({**row, **patch})

        if scope == "this":
            # Add the original starts_at to the parent's exdates and create
            # an isolated event with the patched values.
            instance_start = patch.get("starts_at") or row["starts_at"]
            exdates = list(row.get("rrule_exdates") or [])
            exdates.append(row["starts_at"])  # parent series exception
            client.table("calendar_events") \
                .update({"rrule_exdates": exdates}) \
                .eq("id", event_id) \
                .execute()
            isolated = {
                "user_id": me.user.id,
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
            ins = client.table("calendar_events").insert(isolated).execute()
            return _serialize_event(ins.data[0])

        # scope == "future": end the parent series at this instance and
        # start a new series from the patched values.
        # Truncating the parent: append UNTIL to its RRULE so it stops
        # before the cutoff date.
        cutoff = _parse_iso(patch.get("starts_at") or row["starts_at"])
        until_str = cutoff.strftime("%Y%m%dT%H%M%SZ")
        old_rrule = row["rrule"] or ""
        new_parent_rrule = ";".join(
            p for p in old_rrule.split(";") if not p.upper().startswith("UNTIL=")
        )
        new_parent_rrule += f";UNTIL={until_str}" if new_parent_rrule else f"UNTIL={until_str}"
        client.table("calendar_events") \
            .update({"rrule": new_parent_rrule}) \
            .eq("id", event_id) \
            .execute()
        new_series = {
            "user_id": me.user.id,
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
        ins = client.table("calendar_events").insert(new_series).execute()
        return _serialize_event(ins.data[0])

    @mcp.tool()
    async def delete_event(event_id: str, scope: str = "this") -> dict[str, str]:
        """
        Borra un evento.

        scope (solo aplica a eventos recurrentes):
          - "this":   esta instancia (EXDATE)
          - "future": esta y las siguientes (UNTIL)
          - "all":    toda la serie
        """
        check_rate_limit(is_write=True)
        if not _is_uuid(event_id):
            raise ValueError("event_id debe ser UUID")
        if scope not in ("this", "future", "all"):
            raise ValueError("scope debe ser 'this', 'future' o 'all'")

        client = await get_authenticated_client()
        me = client.auth.get_user()
        if not me or not me.user:
            raise ValueError("No se pudo resolver el usuario autenticado")

        existing = client.table("calendar_events") \
            .select("*") \
            .eq("id", event_id) \
            .eq("user_id", me.user.id) \
            .single() \
            .execute()
        if not existing.data:
            raise ValueError(f"Event {event_id} no encontrado")
        row = existing.data
        is_recurring = bool(row.get("rrule"))

        if not is_recurring or scope == "all":
            client.table("calendar_events") \
                .delete() \
                .eq("id", event_id) \
                .execute()
            return {"message": f"Event {event_id} eliminado"}

        if scope == "this":
            exdates = list(row.get("rrule_exdates") or [])
            exdates.append(row["starts_at"])
            client.table("calendar_events") \
                .update({"rrule_exdates": exdates}) \
                .eq("id", event_id) \
                .execute()
            return {"message": "Instancia excluida de la serie"}

        # scope == "future"
        cutoff = _parse_iso(row["starts_at"])
        until_str = cutoff.strftime("%Y%m%dT%H%M%SZ")
        old_rrule = row["rrule"] or ""
        new_rrule = ";".join(
            p for p in old_rrule.split(";") if not p.upper().startswith("UNTIL=")
        )
        new_rrule += f";UNTIL={until_str}" if new_rrule else f"UNTIL={until_str}"
        client.table("calendar_events") \
            .update({"rrule": new_rrule}) \
            .eq("id", event_id) \
            .execute()
        return {"message": "Serie truncada en esta fecha"}

    @mcp.tool()
    async def link_event_to_note(event_id: str, note_id: str) -> dict[str, Any]:
        """
        Conecta un evento con una nota de DeskFlow. Ambos quedan
        bidireccionalmente accesibles desde el dashboard y la nota.
        """
        check_rate_limit(is_write=True)
        if not _is_uuid(event_id) or not _is_uuid(note_id):
            raise ValueError("event_id y note_id deben ser UUIDs")
        client = await get_authenticated_client()
        result = client.table("calendar_events") \
            .update({"linked_note_id": note_id}) \
            .eq("id", event_id) \
            .execute()
        if not result.data:
            raise ValueError(f"Event {event_id} no encontrado")
        return _serialize_event(result.data[0])
