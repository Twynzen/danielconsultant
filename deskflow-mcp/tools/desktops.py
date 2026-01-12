"""
DeskFlow MCP Server - Desktop Tools
Herramientas para gestionar desktops (escritorios virtuales)
"""

from typing import Any
from datetime import datetime
from mcp.server.fastmcp import FastMCP
from auth import get_authenticated_client, check_rate_limit


def register_desktop_tools(mcp: FastMCP):
    """Register all desktop-related tools"""

    @mcp.tool()
    async def list_desktops(workspace_id: str) -> list[dict[str, Any]]:
        """
        Lista todos los desktops de un workspace.

        Args:
            workspace_id: UUID del workspace

        Returns:
            Lista de desktops con su jerarquía
        """
        check_rate_limit(is_write=False)

        if not workspace_id or len(workspace_id) != 36:
            raise ValueError("workspace_id debe ser un UUID válido")

        client = await get_authenticated_client()

        result = client.table("desktops") \
            .select("id, name, parent_id, position_order, created_at, updated_at") \
            .eq("workspace_id", workspace_id) \
            .order("position_order") \
            .execute()

        return result.data or []

    @mcp.tool()
    async def get_desktop(desktop_id: str) -> dict[str, Any]:
        """
        Obtiene los detalles de un desktop específico.

        Args:
            desktop_id: UUID del desktop

        Returns:
            Detalles del desktop
        """
        check_rate_limit(is_write=False)

        if not desktop_id or len(desktop_id) != 36:
            raise ValueError("desktop_id debe ser un UUID válido")

        client = await get_authenticated_client()

        result = client.table("desktops") \
            .select("*") \
            .eq("id", desktop_id) \
            .single() \
            .execute()

        if not result.data:
            raise ValueError(f"Desktop {desktop_id} no encontrado")

        return result.data

    @mcp.tool()
    async def get_root_desktop(workspace_id: str) -> dict[str, Any]:
        """
        Obtiene el desktop raíz de un workspace.

        Args:
            workspace_id: UUID del workspace

        Returns:
            El desktop raíz (sin parent)
        """
        check_rate_limit(is_write=False)

        if not workspace_id or len(workspace_id) != 36:
            raise ValueError("workspace_id debe ser un UUID válido")

        client = await get_authenticated_client()

        result = client.table("desktops") \
            .select("*") \
            .eq("workspace_id", workspace_id) \
            .is_("parent_id", "null") \
            .single() \
            .execute()

        if not result.data:
            raise ValueError(f"Desktop raíz no encontrado en workspace {workspace_id}")

        return result.data

    @mcp.tool()
    async def get_desktop_hierarchy(
        workspace_id: str,
        max_depth: int = 10
    ) -> list[dict[str, Any]]:
        """
        Obtiene la jerarquía completa de desktops de un workspace.

        Args:
            workspace_id: UUID del workspace
            max_depth: Profundidad máxima (default: 10)

        Returns:
            Lista de desktops con información de nivel y padre
        """
        check_rate_limit(is_write=False)

        if not workspace_id or len(workspace_id) != 36:
            raise ValueError("workspace_id debe ser un UUID válido")

        client = await get_authenticated_client()

        # Get all desktops
        result = client.table("desktops") \
            .select("id, name, parent_id, position_order, created_at") \
            .eq("workspace_id", workspace_id) \
            .order("position_order") \
            .execute()

        desktops = result.data or []

        # Build hierarchy with levels
        def add_level(desktop_list, parent_id, level):
            items = []
            for d in desktop_list:
                if d.get("parent_id") == parent_id and level <= max_depth:
                    d["level"] = level
                    items.append(d)
                    # Add children
                    items.extend(add_level(desktop_list, d["id"], level + 1))
            return items

        return add_level(desktops, None, 0)

    @mcp.tool()
    async def get_desktop_contents(
        desktop_id: str,
        include_note_content: bool = False
    ) -> dict[str, Any]:
        """
        Obtiene todo el contenido de un desktop (notas, folders, conexiones).

        Args:
            desktop_id: UUID del desktop
            include_note_content: Si incluir el contenido completo de las notas

        Returns:
            Diccionario con notes, folders, connections del desktop
        """
        check_rate_limit(is_write=False)

        if not desktop_id or len(desktop_id) != 36:
            raise ValueError("desktop_id debe ser un UUID válido")

        client = await get_authenticated_client()

        # Get desktop info
        desktop = client.table("desktops") \
            .select("id, name, parent_id, workspace_id") \
            .eq("id", desktop_id) \
            .single() \
            .execute()

        if not desktop.data:
            raise ValueError(f"Desktop {desktop_id} no encontrado")

        # Get notes
        note_fields = "id, title, position_x, position_y, width, height, color, z_index, minimized, created_at, updated_at"
        if include_note_content:
            note_fields += ", content"

        notes = client.table("notes") \
            .select(note_fields) \
            .eq("desktop_id", desktop_id) \
            .order("z_index") \
            .execute()

        # Get folders
        folders = client.table("folders") \
            .select("id, name, target_desktop_id, position_x, position_y, icon, color, created_at") \
            .eq("desktop_id", desktop_id) \
            .execute()

        # Get connections
        connections = client.table("connections") \
            .select("id, from_note_id, to_note_id, color, created_at") \
            .eq("desktop_id", desktop_id) \
            .execute()

        return {
            "desktop": desktop.data,
            "notes": notes.data or [],
            "folders": folders.data or [],
            "connections": connections.data or [],
            "counts": {
                "notes": len(notes.data or []),
                "folders": len(folders.data or []),
                "connections": len(connections.data or [])
            }
        }

    @mcp.tool()
    async def create_desktop(
        workspace_id: str,
        name: str,
        parent_id: str | None = None
    ) -> dict[str, Any]:
        """
        Crea un nuevo desktop en un workspace.

        Args:
            workspace_id: UUID del workspace
            name: Nombre del desktop
            parent_id: UUID del desktop padre (opcional, null para root)

        Returns:
            El desktop creado
        """
        check_rate_limit(is_write=True)

        if not workspace_id or len(workspace_id) != 36:
            raise ValueError("workspace_id debe ser un UUID válido")

        if not name or len(name.strip()) == 0:
            raise ValueError("El nombre del desktop es requerido")

        if parent_id and len(parent_id) != 36:
            raise ValueError("parent_id debe ser un UUID válido")

        client = await get_authenticated_client()

        # Get max position order
        existing = client.table("desktops") \
            .select("position_order") \
            .eq("workspace_id", workspace_id) \
            .order("position_order", desc=True) \
            .limit(1) \
            .execute()

        max_order = existing.data[0]["position_order"] if existing.data else 0

        desktop_data = {
            "workspace_id": workspace_id,
            "name": name.strip(),
            "parent_id": parent_id,
            "position_order": max_order + 1
        }

        result = client.table("desktops") \
            .insert(desktop_data) \
            .execute()

        if not result.data:
            raise ValueError("Error al crear el desktop")

        return result.data[0]

    @mcp.tool()
    async def update_desktop(
        desktop_id: str,
        name: str | None = None,
        parent_id: str | None = None,
        position_order: int | None = None
    ) -> dict[str, Any]:
        """
        Actualiza un desktop existente.

        Args:
            desktop_id: UUID del desktop
            name: Nuevo nombre (opcional)
            parent_id: Nuevo padre (opcional, usar "null" para raíz)
            position_order: Nueva posición (opcional)

        Returns:
            El desktop actualizado
        """
        check_rate_limit(is_write=True)

        if not desktop_id or len(desktop_id) != 36:
            raise ValueError("desktop_id debe ser un UUID válido")

        client = await get_authenticated_client()

        updates = {"updated_at": datetime.utcnow().isoformat()}

        if name is not None:
            if len(name.strip()) == 0:
                raise ValueError("El nombre no puede estar vacío")
            updates["name"] = name.strip()

        if parent_id is not None:
            updates["parent_id"] = None if parent_id == "null" else parent_id

        if position_order is not None:
            updates["position_order"] = position_order

        result = client.table("desktops") \
            .update(updates) \
            .eq("id", desktop_id) \
            .execute()

        if not result.data:
            raise ValueError(f"Desktop {desktop_id} no encontrado")

        return result.data[0]

    @mcp.tool()
    async def delete_desktop(desktop_id: str) -> dict[str, str]:
        """
        Elimina un desktop y todo su contenido (cascade).

        Args:
            desktop_id: UUID del desktop a eliminar

        Returns:
            Mensaje de confirmación
        """
        check_rate_limit(is_write=True)

        if not desktop_id or len(desktop_id) != 36:
            raise ValueError("desktop_id debe ser un UUID válido")

        client = await get_authenticated_client()

        # Delete (cascade will handle notes, folders, connections)
        result = client.table("desktops") \
            .delete() \
            .eq("id", desktop_id) \
            .execute()

        return {"message": f"Desktop {desktop_id} y su contenido eliminados correctamente"}
