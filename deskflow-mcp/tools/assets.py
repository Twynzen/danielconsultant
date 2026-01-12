"""
DeskFlow MCP Server - Asset Tools
Herramientas para gestionar assets (imágenes) de las notas
"""

import base64
from typing import Any
from datetime import datetime
from mcp.server.fastmcp import FastMCP
from auth import get_authenticated_client, check_rate_limit, get_auth_manager


def register_asset_tools(mcp: FastMCP):
    """Register all asset-related tools"""

    @mcp.tool()
    async def list_note_assets(note_id: str) -> list[dict[str, Any]]:
        """
        Lista todos los assets (imágenes) de una nota.

        Args:
            note_id: UUID de la nota

        Returns:
            Lista de assets con metadata
        """
        check_rate_limit(is_write=False)

        if not note_id or len(note_id) != 36:
            raise ValueError("note_id debe ser un UUID válido")

        client = await get_authenticated_client()

        result = client.table("assets") \
            .select("id, storage_path, original_name, mime_type, width, height, position_x, position_y, created_at") \
            .eq("note_id", note_id) \
            .execute()

        return result.data or []

    @mcp.tool()
    async def get_asset(asset_id: str) -> dict[str, Any]:
        """
        Obtiene información de un asset específico.

        Args:
            asset_id: UUID del asset

        Returns:
            Metadata del asset (sin el archivo en sí)
        """
        check_rate_limit(is_write=False)

        if not asset_id or len(asset_id) != 36:
            raise ValueError("asset_id debe ser un UUID válido")

        client = await get_authenticated_client()

        result = client.table("assets") \
            .select("*") \
            .eq("id", asset_id) \
            .single() \
            .execute()

        if not result.data:
            raise ValueError(f"Asset {asset_id} no encontrado")

        return result.data

    @mcp.tool()
    async def get_asset_url(asset_id: str) -> dict[str, str]:
        """
        Obtiene la URL pública de un asset para visualizarlo.

        Args:
            asset_id: UUID del asset

        Returns:
            URL pública del asset
        """
        check_rate_limit(is_write=False)

        if not asset_id or len(asset_id) != 36:
            raise ValueError("asset_id debe ser un UUID válido")

        client = await get_authenticated_client()

        # Get storage path
        result = client.table("assets") \
            .select("storage_path") \
            .eq("id", asset_id) \
            .single() \
            .execute()

        if not result.data:
            raise ValueError(f"Asset {asset_id} no encontrado")

        storage_path = result.data["storage_path"]

        # Get public URL from storage
        url_data = client.storage.from_("assets").get_public_url(storage_path)

        return {
            "asset_id": asset_id,
            "url": url_data
        }

    @mcp.tool()
    async def upload_asset(
        note_id: str,
        file_data: str,
        original_name: str,
        mime_type: str,
        width: int,
        height: int,
        position_x: int = 0,
        position_y: int = 0
    ) -> dict[str, Any]:
        """
        Sube un nuevo asset (imagen) a una nota.

        Args:
            note_id: UUID de la nota
            file_data: Datos del archivo en Base64
            original_name: Nombre original del archivo
            mime_type: Tipo MIME (ej: "image/png", "image/jpeg")
            width: Ancho de la imagen
            height: Alto de la imagen
            position_x: Posición X dentro de la nota (default: 0)
            position_y: Posición Y dentro de la nota (default: 0)

        Returns:
            El asset creado con su URL
        """
        check_rate_limit(is_write=True)

        if not note_id or len(note_id) != 36:
            raise ValueError("note_id debe ser un UUID válido")

        if not file_data:
            raise ValueError("file_data es requerido (Base64)")

        if not original_name:
            raise ValueError("original_name es requerido")

        if not mime_type or not mime_type.startswith("image/"):
            raise ValueError("mime_type debe ser un tipo de imagen válido")

        # Validate base64
        try:
            file_bytes = base64.b64decode(file_data)
        except Exception:
            raise ValueError("file_data no es Base64 válido")

        # Limit file size (5MB)
        if len(file_bytes) > 5 * 1024 * 1024:
            raise ValueError("El archivo no puede exceder 5MB")

        auth = get_auth_manager()
        client = await get_authenticated_client()

        # Generate storage path
        import uuid
        file_ext = original_name.split(".")[-1] if "." in original_name else "png"
        storage_path = f"{auth.user_id}/{note_id}/{uuid.uuid4()}.{file_ext}"

        # Upload to storage
        upload_result = client.storage.from_("assets").upload(
            storage_path,
            file_bytes,
            {"content-type": mime_type}
        )

        # Create asset record
        asset_data = {
            "note_id": note_id,
            "storage_path": storage_path,
            "original_name": original_name,
            "mime_type": mime_type,
            "width": width,
            "height": height,
            "position_x": position_x,
            "position_y": position_y
        }

        result = client.table("assets") \
            .insert(asset_data) \
            .execute()

        if not result.data:
            raise ValueError("Error al crear el registro del asset")

        asset = result.data[0]

        # Get public URL
        url = client.storage.from_("assets").get_public_url(storage_path)

        return {
            **asset,
            "url": url
        }

    @mcp.tool()
    async def update_asset_position(
        asset_id: str,
        position_x: int,
        position_y: int
    ) -> dict[str, Any]:
        """
        Actualiza la posición de un asset dentro de la nota.

        Args:
            asset_id: UUID del asset
            position_x: Nueva posición X
            position_y: Nueva posición Y

        Returns:
            El asset actualizado
        """
        check_rate_limit(is_write=True)

        if not asset_id or len(asset_id) != 36:
            raise ValueError("asset_id debe ser un UUID válido")

        client = await get_authenticated_client()

        result = client.table("assets") \
            .update({
                "position_x": position_x,
                "position_y": position_y,
                "updated_at": datetime.utcnow().isoformat()
            }) \
            .eq("id", asset_id) \
            .execute()

        if not result.data:
            raise ValueError(f"Asset {asset_id} no encontrado")

        return result.data[0]

    @mcp.tool()
    async def delete_asset(asset_id: str) -> dict[str, str]:
        """
        Elimina un asset (imagen).

        Args:
            asset_id: UUID del asset a eliminar

        Returns:
            Mensaje de confirmación
        """
        check_rate_limit(is_write=True)

        if not asset_id or len(asset_id) != 36:
            raise ValueError("asset_id debe ser un UUID válido")

        client = await get_authenticated_client()

        # Get storage path first
        asset = client.table("assets") \
            .select("storage_path") \
            .eq("id", asset_id) \
            .single() \
            .execute()

        if not asset.data:
            raise ValueError(f"Asset {asset_id} no encontrado")

        storage_path = asset.data["storage_path"]

        # Delete from storage
        try:
            client.storage.from_("assets").remove([storage_path])
        except Exception:
            # Continue even if storage delete fails
            pass

        # Delete from database
        client.table("assets") \
            .delete() \
            .eq("id", asset_id) \
            .execute()

        return {"message": f"Asset {asset_id} eliminado correctamente"}

    @mcp.tool()
    async def delete_note_assets(note_id: str) -> dict[str, Any]:
        """
        Elimina todos los assets de una nota.

        Args:
            note_id: UUID de la nota

        Returns:
            Cantidad de assets eliminados
        """
        check_rate_limit(is_write=True)

        if not note_id or len(note_id) != 36:
            raise ValueError("note_id debe ser un UUID válido")

        client = await get_authenticated_client()

        # Get all storage paths
        assets = client.table("assets") \
            .select("id, storage_path") \
            .eq("note_id", note_id) \
            .execute()

        if not assets.data:
            return {"message": "No hay assets para eliminar", "deleted_count": 0}

        # Delete from storage
        paths = [a["storage_path"] for a in assets.data]
        try:
            client.storage.from_("assets").remove(paths)
        except Exception:
            pass

        # Delete from database
        result = client.table("assets") \
            .delete() \
            .eq("note_id", note_id) \
            .execute()

        return {
            "message": f"Eliminados {len(assets.data)} assets",
            "deleted_count": len(assets.data)
        }
