"""
DeskFlow MCP Server - Connection Tools
Herramientas para gestionar conexiones entre notas
"""

from typing import Any
from datetime import datetime
from mcp.server.fastmcp import FastMCP
from auth import get_authenticated_client, check_rate_limit


def register_connection_tools(mcp: FastMCP):
    """Register all connection-related tools"""

    @mcp.tool()
    async def list_connections(desktop_id: str) -> list[dict[str, Any]]:
        """
        Lista todas las conexiones de un desktop.

        Args:
            desktop_id: UUID del desktop

        Returns:
            Lista de conexiones con from/to note IDs
        """
        check_rate_limit(is_write=False)

        if not desktop_id or len(desktop_id) != 36:
            raise ValueError("desktop_id debe ser un UUID válido")

        client = await get_authenticated_client()

        result = client.table("connections") \
            .select("id, from_note_id, to_note_id, color, created_at") \
            .eq("desktop_id", desktop_id) \
            .execute()

        return result.data or []

    @mcp.tool()
    async def get_connection(connection_id: str) -> dict[str, Any]:
        """
        Obtiene una conexión específica.

        Args:
            connection_id: UUID de la conexión

        Returns:
            Detalles de la conexión
        """
        check_rate_limit(is_write=False)

        if not connection_id or len(connection_id) != 36:
            raise ValueError("connection_id debe ser un UUID válido")

        client = await get_authenticated_client()

        result = client.table("connections") \
            .select("*") \
            .eq("id", connection_id) \
            .single() \
            .execute()

        if not result.data:
            raise ValueError(f"Conexión {connection_id} no encontrada")

        return result.data

    @mcp.tool()
    async def get_note_connections(note_id: str) -> dict[str, list[dict[str, Any]]]:
        """
        Obtiene todas las conexiones de una nota (entrantes y salientes).

        Args:
            note_id: UUID de la nota

        Returns:
            Diccionario con conexiones 'outgoing' y 'incoming'
        """
        check_rate_limit(is_write=False)

        if not note_id or len(note_id) != 36:
            raise ValueError("note_id debe ser un UUID válido")

        client = await get_authenticated_client()

        # Outgoing connections (from this note)
        outgoing = client.table("connections") \
            .select("id, to_note_id, color, created_at") \
            .eq("from_note_id", note_id) \
            .execute()

        # Incoming connections (to this note)
        incoming = client.table("connections") \
            .select("id, from_note_id, color, created_at") \
            .eq("to_note_id", note_id) \
            .execute()

        return {
            "outgoing": outgoing.data or [],
            "incoming": incoming.data or [],
            "total": len(outgoing.data or []) + len(incoming.data or [])
        }

    @mcp.tool()
    async def create_connection(
        desktop_id: str,
        from_note_id: str,
        to_note_id: str,
        color: str | None = None
    ) -> dict[str, Any]:
        """
        Crea una conexión entre dos notas.

        Args:
            desktop_id: UUID del desktop donde están las notas
            from_note_id: UUID de la nota origen
            to_note_id: UUID de la nota destino
            color: Color de la línea en hex (opcional, default: verde)

        Returns:
            La conexión creada
        """
        check_rate_limit(is_write=True)

        if not desktop_id or len(desktop_id) != 36:
            raise ValueError("desktop_id debe ser un UUID válido")

        if not from_note_id or len(from_note_id) != 36:
            raise ValueError("from_note_id debe ser un UUID válido")

        if not to_note_id or len(to_note_id) != 36:
            raise ValueError("to_note_id debe ser un UUID válido")

        if from_note_id == to_note_id:
            raise ValueError("Una nota no puede conectarse consigo misma")

        client = await get_authenticated_client()

        # Verify both notes exist in the desktop
        notes = client.table("notes") \
            .select("id") \
            .eq("desktop_id", desktop_id) \
            .in_("id", [from_note_id, to_note_id]) \
            .execute()

        if len(notes.data or []) != 2:
            raise ValueError("Ambas notas deben existir en el mismo desktop")

        # Check if connection already exists
        existing = client.table("connections") \
            .select("id") \
            .eq("from_note_id", from_note_id) \
            .eq("to_note_id", to_note_id) \
            .execute()

        if existing.data:
            raise ValueError("Ya existe una conexión entre estas notas")

        connection_data = {
            "desktop_id": desktop_id,
            "from_note_id": from_note_id,
            "to_note_id": to_note_id,
            "color": color or "#00ff41"  # Default Matrix green
        }

        result = client.table("connections") \
            .insert(connection_data) \
            .execute()

        if not result.data:
            raise ValueError("Error al crear la conexión")

        return result.data[0]

    @mcp.tool()
    async def update_connection(
        connection_id: str,
        color: str | None = None
    ) -> dict[str, Any]:
        """
        Actualiza una conexión existente.

        Args:
            connection_id: UUID de la conexión
            color: Nuevo color en hex

        Returns:
            La conexión actualizada
        """
        check_rate_limit(is_write=True)

        if not connection_id or len(connection_id) != 36:
            raise ValueError("connection_id debe ser un UUID válido")

        if color is None:
            raise ValueError("Debe especificar al menos un campo a actualizar")

        client = await get_authenticated_client()

        updates = {"updated_at": datetime.utcnow().isoformat()}

        if color is not None:
            updates["color"] = color

        result = client.table("connections") \
            .update(updates) \
            .eq("id", connection_id) \
            .execute()

        if not result.data:
            raise ValueError(f"Conexión {connection_id} no encontrada")

        return result.data[0]

    @mcp.tool()
    async def delete_connection(connection_id: str) -> dict[str, str]:
        """
        Elimina una conexión entre notas.

        Args:
            connection_id: UUID de la conexión a eliminar

        Returns:
            Mensaje de confirmación
        """
        check_rate_limit(is_write=True)

        if not connection_id or len(connection_id) != 36:
            raise ValueError("connection_id debe ser un UUID válido")

        client = await get_authenticated_client()

        result = client.table("connections") \
            .delete() \
            .eq("id", connection_id) \
            .execute()

        return {"message": f"Conexión {connection_id} eliminada correctamente"}

    @mcp.tool()
    async def delete_note_connections(note_id: str) -> dict[str, Any]:
        """
        Elimina todas las conexiones de una nota (entrantes y salientes).

        Args:
            note_id: UUID de la nota

        Returns:
            Cantidad de conexiones eliminadas
        """
        check_rate_limit(is_write=True)

        if not note_id or len(note_id) != 36:
            raise ValueError("note_id debe ser un UUID válido")

        client = await get_authenticated_client()

        # Delete outgoing
        outgoing = client.table("connections") \
            .delete() \
            .eq("from_note_id", note_id) \
            .execute()

        # Delete incoming
        incoming = client.table("connections") \
            .delete() \
            .eq("to_note_id", note_id) \
            .execute()

        deleted_count = len(outgoing.data or []) + len(incoming.data or [])

        return {
            "message": f"Eliminadas {deleted_count} conexiones",
            "deleted_count": deleted_count
        }
