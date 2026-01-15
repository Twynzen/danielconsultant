"""
DeskFlow MCP Server - Search Tools
Herramientas de búsqueda en notas y workspaces
"""

from typing import Any
from mcp.server.fastmcp import FastMCP
from auth import get_authenticated_client, check_rate_limit


def register_search_tools(mcp: FastMCP):
    """Register all search-related tools"""

    @mcp.tool()
    async def search_notes(
        workspace_id: str,
        query: str,
        limit: int = 20,
        include_content: bool = False
    ) -> list[dict[str, Any]]:
        """
        Busca notas por título o contenido en un workspace.

        Args:
            workspace_id: UUID del workspace donde buscar
            query: Texto a buscar
            limit: Número máximo de resultados (default: 20, max: 100)
            include_content: Si incluir el contenido completo (default: False)

        Returns:
            Lista de notas que coinciden con la búsqueda
        """
        check_rate_limit(is_write=False)

        if not workspace_id or len(workspace_id) != 36:
            raise ValueError("workspace_id debe ser un UUID válido")

        if not query or len(query.strip()) == 0:
            raise ValueError("El término de búsqueda es requerido")

        if len(query) > 500:
            raise ValueError("El término de búsqueda no puede exceder 500 caracteres")

        limit = min(max(1, limit), 100)

        client = await get_authenticated_client()

        # First get all desktops in the workspace
        desktops = client.table("desktops") \
            .select("id") \
            .eq("workspace_id", workspace_id) \
            .execute()

        if not desktops.data:
            return []

        desktop_ids = [d["id"] for d in desktops.data]

        # Search in title and content using ilike
        fields = "id, title, desktop_id, position_x, position_y, created_at, updated_at"
        if include_content:
            fields += ", content"

        # Search by title
        title_results = client.table("notes") \
            .select(fields) \
            .in_("desktop_id", desktop_ids) \
            .ilike("title", f"%{query}%") \
            .limit(limit) \
            .execute()

        # Search by content
        content_results = client.table("notes") \
            .select(fields) \
            .in_("desktop_id", desktop_ids) \
            .ilike("content", f"%{query}%") \
            .limit(limit) \
            .execute()

        # Merge results, remove duplicates
        seen_ids = set()
        results = []

        for note in (title_results.data or []) + (content_results.data or []):
            if note["id"] not in seen_ids:
                seen_ids.add(note["id"])
                note["match_type"] = "title" if note in (title_results.data or []) else "content"
                results.append(note)

        return results[:limit]

    @mcp.tool()
    async def search_notes_in_desktop(
        desktop_id: str,
        query: str,
        limit: int = 20
    ) -> list[dict[str, Any]]:
        """
        Busca notas dentro de un desktop específico.

        Args:
            desktop_id: UUID del desktop donde buscar
            query: Texto a buscar
            limit: Número máximo de resultados (default: 20)

        Returns:
            Lista de notas que coinciden
        """
        check_rate_limit(is_write=False)

        if not desktop_id or len(desktop_id) != 36:
            raise ValueError("desktop_id debe ser un UUID válido")

        if not query or len(query.strip()) == 0:
            raise ValueError("El término de búsqueda es requerido")

        limit = min(max(1, limit), 100)

        client = await get_authenticated_client()

        # Search by title or content
        results = client.table("notes") \
            .select("id, title, content, position_x, position_y, created_at") \
            .eq("desktop_id", desktop_id) \
            .or_(f"title.ilike.%{query}%,content.ilike.%{query}%") \
            .limit(limit) \
            .execute()

        return results.data or []

    @mcp.tool()
    async def get_recent_notes(
        workspace_id: str,
        limit: int = 10
    ) -> list[dict[str, Any]]:
        """
        Obtiene las notas más recientemente modificadas de un workspace.

        Args:
            workspace_id: UUID del workspace
            limit: Número de notas a obtener (default: 10)

        Returns:
            Lista de notas ordenadas por fecha de modificación
        """
        check_rate_limit(is_write=False)

        if not workspace_id or len(workspace_id) != 36:
            raise ValueError("workspace_id debe ser un UUID válido")

        limit = min(max(1, limit), 50)

        client = await get_authenticated_client()

        # Get all desktops in the workspace
        desktops = client.table("desktops") \
            .select("id") \
            .eq("workspace_id", workspace_id) \
            .execute()

        if not desktops.data:
            return []

        desktop_ids = [d["id"] for d in desktops.data]

        # Get recent notes
        results = client.table("notes") \
            .select("id, title, desktop_id, updated_at, created_at") \
            .in_("desktop_id", desktop_ids) \
            .order("updated_at", desc=True) \
            .limit(limit) \
            .execute()

        return results.data or []

    @mcp.tool()
    async def get_workspace_stats(workspace_id: str) -> dict[str, Any]:
        """
        Obtiene estadísticas de un workspace.

        Args:
            workspace_id: UUID del workspace

        Returns:
            Estadísticas: total de desktops, notas, folders, conexiones, assets
        """
        check_rate_limit(is_write=False)

        if not workspace_id or len(workspace_id) != 36:
            raise ValueError("workspace_id debe ser un UUID válido")

        client = await get_authenticated_client()

        # Get desktops
        desktops = client.table("desktops") \
            .select("id") \
            .eq("workspace_id", workspace_id) \
            .execute()

        desktop_count = len(desktops.data or [])

        if desktop_count == 0:
            return {
                "workspace_id": workspace_id,
                "desktops": 0,
                "notes": 0,
                "folders": 0,
                "connections": 0,
                "assets": 0
            }

        desktop_ids = [d["id"] for d in desktops.data]

        # Count notes
        notes = client.table("notes") \
            .select("id", count="exact") \
            .in_("desktop_id", desktop_ids) \
            .execute()

        # Count folders
        folders = client.table("folders") \
            .select("id", count="exact") \
            .in_("desktop_id", desktop_ids) \
            .execute()

        # Count connections
        connections = client.table("connections") \
            .select("id", count="exact") \
            .in_("desktop_id", desktop_ids) \
            .execute()

        # Get note IDs for asset count
        note_ids_result = client.table("notes") \
            .select("id") \
            .in_("desktop_id", desktop_ids) \
            .execute()

        note_ids = [n["id"] for n in (note_ids_result.data or [])]

        asset_count = 0
        if note_ids:
            assets = client.table("assets") \
                .select("id", count="exact") \
                .in_("note_id", note_ids) \
                .execute()
            asset_count = assets.count or 0

        return {
            "workspace_id": workspace_id,
            "desktops": desktop_count,
            "notes": notes.count or 0,
            "folders": folders.count or 0,
            "connections": connections.count or 0,
            "assets": asset_count
        }

    @mcp.tool()
    async def find_connected_notes(
        note_id: str,
        depth: int = 2
    ) -> dict[str, Any]:
        """
        Encuentra todas las notas conectadas a una nota dada.

        Args:
            note_id: UUID de la nota inicial
            depth: Profundidad de búsqueda (default: 2, max: 5)

        Returns:
            Grafo de notas conectadas
        """
        check_rate_limit(is_write=False)

        if not note_id or len(note_id) != 36:
            raise ValueError("note_id debe ser un UUID válido")

        depth = min(max(1, depth), 5)

        client = await get_authenticated_client()

        # Get starting note
        start_note = client.table("notes") \
            .select("id, title, desktop_id") \
            .eq("id", note_id) \
            .single() \
            .execute()

        if not start_note.data:
            raise ValueError(f"Nota {note_id} no encontrada")

        visited = {note_id}
        result = {
            "root": start_note.data,
            "connected_notes": [],
            "connections": []
        }

        current_level = [note_id]

        for _ in range(depth):
            if not current_level:
                break

            # Get all connections involving current level notes
            outgoing = client.table("connections") \
                .select("id, from_note_id, to_note_id, color") \
                .in_("from_note_id", current_level) \
                .execute()

            incoming = client.table("connections") \
                .select("id, from_note_id, to_note_id, color") \
                .in_("to_note_id", current_level) \
                .execute()

            all_connections = (outgoing.data or []) + (incoming.data or [])

            # Collect new note IDs
            new_note_ids = set()
            for conn in all_connections:
                result["connections"].append(conn)
                for field in ["from_note_id", "to_note_id"]:
                    nid = conn[field]
                    if nid not in visited:
                        new_note_ids.add(nid)
                        visited.add(nid)

            # Get new note details
            if new_note_ids:
                notes = client.table("notes") \
                    .select("id, title, desktop_id") \
                    .in_("id", list(new_note_ids)) \
                    .execute()

                result["connected_notes"].extend(notes.data or [])

            current_level = list(new_note_ids)

        # Remove duplicate connections
        seen_conn = set()
        unique_connections = []
        for conn in result["connections"]:
            if conn["id"] not in seen_conn:
                seen_conn.add(conn["id"])
                unique_connections.append(conn)
        result["connections"] = unique_connections

        return result

    @mcp.tool()
    async def get_workspace_index(
        workspace_id: str,
        include_note_content: bool = False
    ) -> dict[str, Any]:
        """
        Obtiene el índice COMPLETO de un workspace en UNA sola llamada.
        Incluye todos los desktops, notas, carpetas y sus relaciones.

        Esta herramienta es MUCHO más eficiente que llamar get_desktop_contents
        múltiples veces. Úsala cuando necesites ver la estructura completa.

        Args:
            workspace_id: UUID del workspace
            include_note_content: Si incluir el contenido completo de las notas (default: False)

        Returns:
            Índice completo con:
            - workspace: información del workspace
            - tree: árbol jerárquico de desktops con sus notas y carpetas
            - flat_notes: lista plana de todas las notas (para búsqueda rápida)
            - flat_folders: lista plana de todas las carpetas
            - stats: estadísticas totales
        """
        check_rate_limit(is_write=False)

        if not workspace_id or len(workspace_id) != 36:
            raise ValueError("workspace_id debe ser un UUID válido")

        client = await get_authenticated_client()

        # 1. Get workspace info
        workspace = client.table("workspaces") \
            .select("id, name, description, is_default, created_at") \
            .eq("id", workspace_id) \
            .is_("deleted_at", "null") \
            .single() \
            .execute()

        if not workspace.data:
            raise ValueError(f"Workspace {workspace_id} no encontrado")

        # 2. Get ALL desktops
        desktops = client.table("desktops") \
            .select("id, name, parent_id, position_order, created_at") \
            .eq("workspace_id", workspace_id) \
            .order("position_order") \
            .execute()

        desktop_list = desktops.data or []
        desktop_ids = [d["id"] for d in desktop_list]

        if not desktop_ids:
            return {
                "workspace": workspace.data,
                "tree": [],
                "flat_notes": [],
                "flat_folders": [],
                "stats": {"desktops": 0, "notes": 0, "folders": 0, "connections": 0}
            }

        # 3. Get ALL notes
        note_fields = "id, title, desktop_id, position_x, position_y, color, z_index, created_at, updated_at"
        if include_note_content:
            note_fields += ", content"

        notes = client.table("notes") \
            .select(note_fields) \
            .in_("desktop_id", desktop_ids) \
            .order("z_index") \
            .execute()

        all_notes = notes.data or []

        # 4. Get ALL folders
        folders = client.table("folders") \
            .select("id, name, desktop_id, target_desktop_id, position_x, position_y, icon, color, created_at") \
            .in_("desktop_id", desktop_ids) \
            .execute()

        all_folders = folders.data or []

        # 5. Get ALL connections
        connections = client.table("connections") \
            .select("id, from_note_id, to_note_id, desktop_id, color") \
            .in_("desktop_id", desktop_ids) \
            .execute()

        all_connections = connections.data or []

        # 6. Build hierarchical tree
        # Create lookup maps
        notes_by_desktop = {}
        for note in all_notes:
            did = note["desktop_id"]
            if did not in notes_by_desktop:
                notes_by_desktop[did] = []
            notes_by_desktop[did].append({
                "id": note["id"],
                "title": note["title"],
                "color": note.get("color"),
                "updated_at": note.get("updated_at"),
                "content": note.get("content") if include_note_content else None
            })

        folders_by_desktop = {}
        for folder in all_folders:
            did = folder["desktop_id"]
            if did not in folders_by_desktop:
                folders_by_desktop[did] = []
            # Find target desktop name
            target_name = None
            for d in desktop_list:
                if d["id"] == folder.get("target_desktop_id"):
                    target_name = d["name"]
                    break
            folders_by_desktop[did].append({
                "id": folder["id"],
                "name": folder["name"],
                "target_desktop_id": folder.get("target_desktop_id"),
                "target_desktop_name": target_name,
                "icon": folder.get("icon"),
                "color": folder.get("color")
            })

        # Build tree recursively
        def build_tree(parent_id, level=0):
            children = []
            for d in desktop_list:
                if d.get("parent_id") == parent_id:
                    desktop_node = {
                        "id": d["id"],
                        "name": d["name"],
                        "level": level,
                        "notes": notes_by_desktop.get(d["id"], []),
                        "folders": folders_by_desktop.get(d["id"], []),
                        "note_count": len(notes_by_desktop.get(d["id"], [])),
                        "folder_count": len(folders_by_desktop.get(d["id"], [])),
                        "children": build_tree(d["id"], level + 1)
                    }
                    children.append(desktop_node)
            return children

        tree = build_tree(None)

        # 7. Build stats
        stats = {
            "desktops": len(desktop_list),
            "notes": len(all_notes),
            "folders": len(all_folders),
            "connections": len(all_connections)
        }

        return {
            "workspace": workspace.data,
            "tree": tree,
            "flat_notes": [{"id": n["id"], "title": n["title"], "desktop_id": n["desktop_id"]} for n in all_notes],
            "flat_folders": [{"id": f["id"], "name": f["name"], "desktop_id": f["desktop_id"]} for f in all_folders],
            "stats": stats
        }
