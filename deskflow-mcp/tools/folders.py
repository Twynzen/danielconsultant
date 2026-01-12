"""
DeskFlow MCP Server - Folder Tools
Herramientas para gestionar folders (enlaces entre desktops)
"""

from typing import Any
from datetime import datetime
from mcp.server.fastmcp import FastMCP
from auth import get_authenticated_client, check_rate_limit


def register_folder_tools(mcp: FastMCP):
    """Register all folder-related tools"""

    @mcp.tool()
    async def list_folders(desktop_id: str) -> list[dict[str, Any]]:
        """
        Lista todos los folders de un desktop.

        Args:
            desktop_id: UUID del desktop

        Returns:
            Lista de folders con sus propiedades
        """
        check_rate_limit(is_write=False)

        if not desktop_id or len(desktop_id) != 36:
            raise ValueError("desktop_id debe ser un UUID válido")

        client = await get_authenticated_client()

        result = client.table("folders") \
            .select("id, name, target_desktop_id, position_x, position_y, icon, color, created_at") \
            .eq("desktop_id", desktop_id) \
            .execute()

        return result.data or []

    @mcp.tool()
    async def get_folder(folder_id: str) -> dict[str, Any]:
        """
        Obtiene un folder específico.

        Args:
            folder_id: UUID del folder

        Returns:
            Detalles del folder
        """
        check_rate_limit(is_write=False)

        if not folder_id or len(folder_id) != 36:
            raise ValueError("folder_id debe ser un UUID válido")

        client = await get_authenticated_client()

        result = client.table("folders") \
            .select("*") \
            .eq("id", folder_id) \
            .single() \
            .execute()

        if not result.data:
            raise ValueError(f"Folder {folder_id} no encontrado")

        return result.data

    @mcp.tool()
    async def create_folder(
        desktop_id: str,
        target_desktop_id: str,
        name: str,
        position_x: int = 100,
        position_y: int = 100,
        icon: str | None = None,
        color: str | None = None
    ) -> dict[str, Any]:
        """
        Crea un nuevo folder (enlace a otro desktop).

        Args:
            desktop_id: UUID del desktop donde crear el folder
            target_desktop_id: UUID del desktop destino al abrir el folder
            name: Nombre del folder
            position_x: Posición X (default: 100)
            position_y: Posición Y (default: 100)
            icon: Icono del folder (opcional)
            color: Color del folder en hex (opcional)

        Returns:
            El folder creado
        """
        check_rate_limit(is_write=True)

        if not desktop_id or len(desktop_id) != 36:
            raise ValueError("desktop_id debe ser un UUID válido")

        if not target_desktop_id or len(target_desktop_id) != 36:
            raise ValueError("target_desktop_id debe ser un UUID válido")

        if not name or len(name.strip()) == 0:
            raise ValueError("El nombre del folder es requerido")

        if len(name) > 100:
            raise ValueError("El nombre no puede exceder 100 caracteres")

        client = await get_authenticated_client()

        folder_data = {
            "desktop_id": desktop_id,
            "target_desktop_id": target_desktop_id,
            "name": name.strip(),
            "position_x": position_x,
            "position_y": position_y,
            "icon": icon,
            "color": color
        }

        result = client.table("folders") \
            .insert(folder_data) \
            .execute()

        if not result.data:
            raise ValueError("Error al crear el folder")

        return result.data[0]

    @mcp.tool()
    async def update_folder(
        folder_id: str,
        name: str | None = None,
        target_desktop_id: str | None = None,
        position_x: int | None = None,
        position_y: int | None = None,
        icon: str | None = None,
        color: str | None = None
    ) -> dict[str, Any]:
        """
        Actualiza un folder existente.

        Args:
            folder_id: UUID del folder
            name: Nuevo nombre (opcional)
            target_desktop_id: Nuevo desktop destino (opcional)
            position_x: Nueva posición X (opcional)
            position_y: Nueva posición Y (opcional)
            icon: Nuevo icono (opcional)
            color: Nuevo color (opcional)

        Returns:
            El folder actualizado
        """
        check_rate_limit(is_write=True)

        if not folder_id or len(folder_id) != 36:
            raise ValueError("folder_id debe ser un UUID válido")

        client = await get_authenticated_client()

        updates = {"updated_at": datetime.utcnow().isoformat()}

        if name is not None:
            if len(name.strip()) == 0:
                raise ValueError("El nombre no puede estar vacío")
            updates["name"] = name.strip()

        if target_desktop_id is not None:
            if len(target_desktop_id) != 36:
                raise ValueError("target_desktop_id debe ser un UUID válido")
            updates["target_desktop_id"] = target_desktop_id

        if position_x is not None:
            updates["position_x"] = position_x

        if position_y is not None:
            updates["position_y"] = position_y

        if icon is not None:
            updates["icon"] = icon if icon != "" else None

        if color is not None:
            updates["color"] = color if color != "" else None

        result = client.table("folders") \
            .update(updates) \
            .eq("id", folder_id) \
            .execute()

        if not result.data:
            raise ValueError(f"Folder {folder_id} no encontrado")

        return result.data[0]

    @mcp.tool()
    async def delete_folder(folder_id: str) -> dict[str, str]:
        """
        Elimina un folder.

        Args:
            folder_id: UUID del folder a eliminar

        Returns:
            Mensaje de confirmación
        """
        check_rate_limit(is_write=True)

        if not folder_id or len(folder_id) != 36:
            raise ValueError("folder_id debe ser un UUID válido")

        client = await get_authenticated_client()

        result = client.table("folders") \
            .delete() \
            .eq("id", folder_id) \
            .execute()

        return {"message": f"Folder {folder_id} eliminado correctamente"}
