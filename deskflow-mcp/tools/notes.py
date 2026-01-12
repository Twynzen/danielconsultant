"""
DeskFlow MCP Server - Note Tools
Herramientas para gestionar notas
"""

from typing import Any
from datetime import datetime
from mcp.server.fastmcp import FastMCP
from auth import get_authenticated_client, check_rate_limit


def register_note_tools(mcp: FastMCP):
    """Register all note-related tools"""

    @mcp.tool()
    async def list_notes(desktop_id: str) -> list[dict[str, Any]]:
        """
        Lista todas las notas de un desktop.

        Args:
            desktop_id: UUID del desktop

        Returns:
            Lista de notas (sin contenido completo para eficiencia)
        """
        check_rate_limit(is_write=False)

        if not desktop_id or len(desktop_id) != 36:
            raise ValueError("desktop_id debe ser un UUID válido")

        client = await get_authenticated_client()

        result = client.table("notes") \
            .select("id, title, position_x, position_y, width, height, color, z_index, minimized, created_at, updated_at") \
            .eq("desktop_id", desktop_id) \
            .order("z_index") \
            .execute()

        return result.data or []

    @mcp.tool()
    async def get_note(note_id: str) -> dict[str, Any]:
        """
        Obtiene una nota específica con todo su contenido.

        Args:
            note_id: UUID de la nota

        Returns:
            Nota completa incluyendo contenido
        """
        check_rate_limit(is_write=False)

        if not note_id or len(note_id) != 36:
            raise ValueError("note_id debe ser un UUID válido")

        client = await get_authenticated_client()

        result = client.table("notes") \
            .select("*") \
            .eq("id", note_id) \
            .single() \
            .execute()

        if not result.data:
            raise ValueError(f"Nota {note_id} no encontrada")

        return result.data

    @mcp.tool()
    async def create_note(
        desktop_id: str,
        title: str,
        content: str = "",
        position_x: int = 100,
        position_y: int = 100,
        width: int = 300,
        height: int = 200,
        color: str | None = None
    ) -> dict[str, Any]:
        """
        Crea una nueva nota en un desktop.

        Args:
            desktop_id: UUID del desktop donde crear la nota
            title: Título de la nota
            content: Contenido de la nota (puede ser HTML o texto plano)
            position_x: Posición X en el desktop (default: 100)
            position_y: Posición Y en el desktop (default: 100)
            width: Ancho de la nota (default: 300)
            height: Alto de la nota (default: 200)
            color: Color de la nota en hex (opcional, ej: "#00ff41")

        Returns:
            La nota creada
        """
        check_rate_limit(is_write=True)

        if not desktop_id or len(desktop_id) != 36:
            raise ValueError("desktop_id debe ser un UUID válido")

        if not title or len(title.strip()) == 0:
            raise ValueError("El título de la nota es requerido")

        if len(title) > 200:
            raise ValueError("El título no puede exceder 200 caracteres")

        if len(content) > 100000:
            raise ValueError("El contenido no puede exceder 100,000 caracteres")

        client = await get_authenticated_client()

        # Get max z_index
        existing = client.table("notes") \
            .select("z_index") \
            .eq("desktop_id", desktop_id) \
            .order("z_index", desc=True) \
            .limit(1) \
            .execute()

        max_z = existing.data[0]["z_index"] if existing.data else 0

        note_data = {
            "desktop_id": desktop_id,
            "title": title.strip(),
            "content": content,
            "position_x": position_x,
            "position_y": position_y,
            "width": width,
            "height": height,
            "color": color,
            "z_index": max_z + 1,
            "minimized": False
        }

        result = client.table("notes") \
            .insert(note_data) \
            .execute()

        if not result.data:
            raise ValueError("Error al crear la nota")

        return result.data[0]

    @mcp.tool()
    async def update_note(
        note_id: str,
        title: str | None = None,
        content: str | None = None,
        position_x: int | None = None,
        position_y: int | None = None,
        width: int | None = None,
        height: int | None = None,
        color: str | None = None,
        z_index: int | None = None,
        minimized: bool | None = None
    ) -> dict[str, Any]:
        """
        Actualiza una nota existente.

        Args:
            note_id: UUID de la nota
            title: Nuevo título (opcional)
            content: Nuevo contenido (opcional)
            position_x: Nueva posición X (opcional)
            position_y: Nueva posición Y (opcional)
            width: Nuevo ancho (opcional)
            height: Nuevo alto (opcional)
            color: Nuevo color (opcional)
            z_index: Nuevo z-index (opcional)
            minimized: Si está minimizada (opcional)

        Returns:
            La nota actualizada
        """
        check_rate_limit(is_write=True)

        if not note_id or len(note_id) != 36:
            raise ValueError("note_id debe ser un UUID válido")

        client = await get_authenticated_client()

        updates = {"updated_at": datetime.utcnow().isoformat()}

        if title is not None:
            if len(title.strip()) == 0:
                raise ValueError("El título no puede estar vacío")
            if len(title) > 200:
                raise ValueError("El título no puede exceder 200 caracteres")
            updates["title"] = title.strip()

        if content is not None:
            if len(content) > 100000:
                raise ValueError("El contenido no puede exceder 100,000 caracteres")
            updates["content"] = content

        if position_x is not None:
            updates["position_x"] = position_x

        if position_y is not None:
            updates["position_y"] = position_y

        if width is not None:
            updates["width"] = width

        if height is not None:
            updates["height"] = height

        if color is not None:
            updates["color"] = color if color != "" else None

        if z_index is not None:
            updates["z_index"] = z_index

        if minimized is not None:
            updates["minimized"] = minimized

        result = client.table("notes") \
            .update(updates) \
            .eq("id", note_id) \
            .execute()

        if not result.data:
            raise ValueError(f"Nota {note_id} no encontrada")

        return result.data[0]

    @mcp.tool()
    async def delete_note(note_id: str) -> dict[str, str]:
        """
        Elimina una nota (y sus assets y conexiones por cascade).

        Args:
            note_id: UUID de la nota a eliminar

        Returns:
            Mensaje de confirmación
        """
        check_rate_limit(is_write=True)

        if not note_id or len(note_id) != 36:
            raise ValueError("note_id debe ser un UUID válido")

        client = await get_authenticated_client()

        result = client.table("notes") \
            .delete() \
            .eq("id", note_id) \
            .execute()

        return {"message": f"Nota {note_id} eliminada correctamente"}

    @mcp.tool()
    async def bring_note_to_front(note_id: str) -> dict[str, Any]:
        """
        Trae una nota al frente (máximo z-index).

        Args:
            note_id: UUID de la nota

        Returns:
            La nota actualizada
        """
        check_rate_limit(is_write=True)

        if not note_id or len(note_id) != 36:
            raise ValueError("note_id debe ser un UUID válido")

        client = await get_authenticated_client()

        # Get note's desktop
        note = client.table("notes") \
            .select("desktop_id") \
            .eq("id", note_id) \
            .single() \
            .execute()

        if not note.data:
            raise ValueError(f"Nota {note_id} no encontrada")

        # Get max z_index in desktop
        max_z = client.table("notes") \
            .select("z_index") \
            .eq("desktop_id", note.data["desktop_id"]) \
            .order("z_index", desc=True) \
            .limit(1) \
            .execute()

        new_z = (max_z.data[0]["z_index"] if max_z.data else 0) + 1

        result = client.table("notes") \
            .update({"z_index": new_z, "updated_at": datetime.utcnow().isoformat()}) \
            .eq("id", note_id) \
            .execute()

        return result.data[0]

    @mcp.tool()
    async def duplicate_note(note_id: str, offset_x: int = 30, offset_y: int = 30) -> dict[str, Any]:
        """
        Duplica una nota existente.

        Args:
            note_id: UUID de la nota a duplicar
            offset_x: Desplazamiento X para la copia (default: 30)
            offset_y: Desplazamiento Y para la copia (default: 30)

        Returns:
            La nueva nota duplicada
        """
        check_rate_limit(is_write=True)

        if not note_id or len(note_id) != 36:
            raise ValueError("note_id debe ser un UUID válido")

        client = await get_authenticated_client()

        # Get original note
        original = client.table("notes") \
            .select("*") \
            .eq("id", note_id) \
            .single() \
            .execute()

        if not original.data:
            raise ValueError(f"Nota {note_id} no encontrada")

        # Get max z_index
        max_z = client.table("notes") \
            .select("z_index") \
            .eq("desktop_id", original.data["desktop_id"]) \
            .order("z_index", desc=True) \
            .limit(1) \
            .execute()

        new_z = (max_z.data[0]["z_index"] if max_z.data else 0) + 1

        # Create duplicate
        new_note = {
            "desktop_id": original.data["desktop_id"],
            "title": f"{original.data['title']} (copia)",
            "content": original.data["content"],
            "position_x": original.data["position_x"] + offset_x,
            "position_y": original.data["position_y"] + offset_y,
            "width": original.data["width"],
            "height": original.data["height"],
            "color": original.data["color"],
            "z_index": new_z,
            "minimized": False
        }

        result = client.table("notes") \
            .insert(new_note) \
            .execute()

        if not result.data:
            raise ValueError("Error al duplicar la nota")

        return result.data[0]
