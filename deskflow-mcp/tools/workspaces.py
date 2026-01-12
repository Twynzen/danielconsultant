"""
DeskFlow MCP Server - Workspace Tools
Herramientas para gestionar workspaces
"""

from typing import Any
from datetime import datetime
from mcp.server.fastmcp import FastMCP
from auth import get_authenticated_client, check_rate_limit, get_auth_manager


def register_workspace_tools(mcp: FastMCP):
    """Register all workspace-related tools"""

    @mcp.tool()
    async def list_workspaces() -> list[dict[str, Any]]:
        """
        Lista todos los workspaces del usuario actual.

        Returns:
            Lista de workspaces con id, name, description, is_default, created_at
        """
        check_rate_limit(is_write=False)
        client = await get_authenticated_client()

        result = client.table("workspaces") \
            .select("id, name, description, is_default, theme_config, created_at, updated_at") \
            .is_("deleted_at", "null") \
            .order("name") \
            .execute()

        return result.data or []

    @mcp.tool()
    async def get_workspace(workspace_id: str) -> dict[str, Any]:
        """
        Obtiene los detalles de un workspace específico.

        Args:
            workspace_id: UUID del workspace

        Returns:
            Detalles del workspace incluyendo configuración de tema
        """
        check_rate_limit(is_write=False)

        if not workspace_id or len(workspace_id) != 36:
            raise ValueError("workspace_id debe ser un UUID válido (36 caracteres)")

        client = await get_authenticated_client()

        result = client.table("workspaces") \
            .select("*") \
            .eq("id", workspace_id) \
            .is_("deleted_at", "null") \
            .single() \
            .execute()

        if not result.data:
            raise ValueError(f"Workspace {workspace_id} no encontrado")

        return result.data

    @mcp.tool()
    async def get_default_workspace() -> dict[str, Any]:
        """
        Obtiene el workspace por defecto del usuario.

        Returns:
            Detalles del workspace por defecto
        """
        check_rate_limit(is_write=False)
        client = await get_authenticated_client()

        result = client.table("workspaces") \
            .select("*") \
            .eq("is_default", True) \
            .is_("deleted_at", "null") \
            .single() \
            .execute()

        if not result.data:
            raise ValueError("No se encontró workspace por defecto")

        return result.data

    @mcp.tool()
    async def create_workspace(
        name: str,
        description: str = "",
        is_default: bool = False
    ) -> dict[str, Any]:
        """
        Crea un nuevo workspace.

        Args:
            name: Nombre del workspace (requerido)
            description: Descripción opcional
            is_default: Si es el workspace por defecto

        Returns:
            El workspace creado
        """
        check_rate_limit(is_write=True)

        if not name or len(name.strip()) == 0:
            raise ValueError("El nombre del workspace es requerido")

        if len(name) > 100:
            raise ValueError("El nombre no puede exceder 100 caracteres")

        auth = get_auth_manager()
        client = await get_authenticated_client()

        # Default theme config
        default_theme = {
            "primaryColor": "#00ff41",
            "glowIntensity": 0.5,
            "particlesEnabled": True,
            "animationsEnabled": True
        }

        workspace_data = {
            "user_id": auth.user_id,
            "name": name.strip(),
            "description": description.strip() if description else None,
            "is_default": is_default,
            "theme_config": default_theme,
        }

        result = client.table("workspaces") \
            .insert(workspace_data) \
            .execute()

        if not result.data:
            raise ValueError("Error al crear el workspace")

        return result.data[0]

    @mcp.tool()
    async def update_workspace(
        workspace_id: str,
        name: str | None = None,
        description: str | None = None,
        is_default: bool | None = None,
        theme_config: dict | None = None
    ) -> dict[str, Any]:
        """
        Actualiza un workspace existente.

        Args:
            workspace_id: UUID del workspace a actualizar
            name: Nuevo nombre (opcional)
            description: Nueva descripción (opcional)
            is_default: Nuevo valor de is_default (opcional)
            theme_config: Nueva configuración de tema (opcional)

        Returns:
            El workspace actualizado
        """
        check_rate_limit(is_write=True)

        if not workspace_id or len(workspace_id) != 36:
            raise ValueError("workspace_id debe ser un UUID válido")

        client = await get_authenticated_client()

        updates = {"updated_at": datetime.utcnow().isoformat()}

        if name is not None:
            if len(name.strip()) == 0:
                raise ValueError("El nombre no puede estar vacío")
            updates["name"] = name.strip()

        if description is not None:
            updates["description"] = description.strip() if description else None

        if is_default is not None:
            updates["is_default"] = is_default

        if theme_config is not None:
            updates["theme_config"] = theme_config

        result = client.table("workspaces") \
            .update(updates) \
            .eq("id", workspace_id) \
            .execute()

        if not result.data:
            raise ValueError(f"Workspace {workspace_id} no encontrado o no se pudo actualizar")

        return result.data[0]

    @mcp.tool()
    async def delete_workspace(workspace_id: str) -> dict[str, str]:
        """
        Elimina un workspace (soft delete).

        Args:
            workspace_id: UUID del workspace a eliminar

        Returns:
            Mensaje de confirmación
        """
        check_rate_limit(is_write=True)

        if not workspace_id or len(workspace_id) != 36:
            raise ValueError("workspace_id debe ser un UUID válido")

        client = await get_authenticated_client()

        # Soft delete - set deleted_at
        result = client.table("workspaces") \
            .update({"deleted_at": datetime.utcnow().isoformat()}) \
            .eq("id", workspace_id) \
            .execute()

        if not result.data:
            raise ValueError(f"Workspace {workspace_id} no encontrado")

        return {"message": f"Workspace {workspace_id} eliminado correctamente"}
