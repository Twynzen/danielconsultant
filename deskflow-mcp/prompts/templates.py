"""
DeskFlow MCP Server - Prompt Templates
Plantillas para operaciones comunes con DeskFlow
"""

from mcp.server.fastmcp import FastMCP


def register_prompts(mcp: FastMCP):
    """Register user-invocable prompt templates"""

    @mcp.prompt()
    def summarize_workspace(workspace_name: str) -> str:
        """
        Genera un resumen detallado de un workspace.

        Args:
            workspace_name: Nombre del workspace a analizar
        """
        return f"""Analiza el workspace "{workspace_name}" de DeskFlow y proporciona:

1. **Visión General**
   - Estructura del workspace (cuántos desktops, niveles de profundidad)
   - Cantidad total de notas, folders y conexiones
   - Fecha de última actividad

2. **Análisis de Contenido**
   - Temas principales identificados en las notas
   - Notas más extensas o importantes
   - Patrones en los títulos de las notas

3. **Análisis de Conexiones**
   - Notas más conectadas (hubs)
   - Clusters o grupos de notas relacionadas
   - Conexiones que podrían faltar

4. **Recomendaciones**
   - Sugerencias de organización
   - Notas que podrían fusionarse o separarse
   - Áreas que podrían beneficiarse de más documentación

Usa las herramientas disponibles para obtener la información necesaria:
- list_workspaces() para encontrar el workspace
- get_workspace_stats() para estadísticas
- get_desktop_hierarchy() para estructura
- search_notes() para analizar contenido
- find_connected_notes() para analizar conexiones"""

    @mcp.prompt()
    def organize_desktop(desktop_name: str) -> str:
        """
        Sugiere mejoras de organización para un desktop.

        Args:
            desktop_name: Nombre del desktop a organizar
        """
        return f"""Analiza el desktop "{desktop_name}" y sugiere mejoras de organización:

1. **Análisis Actual**
   - Lista todas las notas y sus posiciones
   - Identifica notas que se solapan o están muy juntas
   - Revisa las conexiones existentes

2. **Propuesta de Reorganización**
   - Agrupa notas por tema/categoría
   - Sugiere posiciones óptimas para cada nota
   - Propón nuevas conexiones que tengan sentido

3. **Acciones Sugeridas**
   - Notas que podrían moverse a sub-desktops
   - Folders que podrían crearse
   - Títulos que podrían mejorarse

4. **Implementación** (si el usuario lo aprueba)
   - Ejecuta los cambios de posición con update_note()
   - Crea las conexiones nuevas con create_connection()
   - Crea folders si es necesario con create_folder()

Usa get_desktop_contents() con include_note_content=true para analizar el contenido."""

    @mcp.prompt()
    def find_related_notes(note_title: str) -> str:
        """
        Encuentra notas relacionadas a una nota específica.

        Args:
            note_title: Título de la nota base
        """
        return f"""Busca notas relacionadas con "{note_title}":

1. **Búsqueda por Contenido**
   - Usa search_notes() para buscar términos clave del título
   - Extrae palabras importantes del contenido de la nota original
   - Busca notas con temas similares

2. **Análisis de Conexiones Existentes**
   - Usa get_note_connections() para ver conexiones actuales
   - Usa find_connected_notes() para explorar el grafo

3. **Conexiones Sugeridas**
   - Lista notas que deberían estar conectadas pero no lo están
   - Explica por qué cada conexión tendría sentido
   - Prioriza por relevancia

4. **Acción** (si el usuario lo aprueba)
   - Crea las conexiones con create_connection()

Primero busca la nota con search_notes() y luego analiza su contenido."""

    @mcp.prompt()
    def create_note_from_conversation(
        desktop_name: str,
        topic: str
    ) -> str:
        """
        Crea una nota en DeskFlow basada en la conversación actual.

        Args:
            desktop_name: Nombre del desktop donde crear la nota
            topic: Tema o título sugerido para la nota
        """
        return f"""Crea una nota en el desktop "{desktop_name}" sobre "{topic}":

1. **Preparación**
   - Busca el desktop con list_desktops() en el workspace actual
   - Obtén el contenido del desktop con get_desktop_contents()
   - Determina una buena posición que no se solape con notas existentes

2. **Contenido de la Nota**
   - Resume los puntos clave de nuestra conversación sobre "{topic}"
   - Estructura el contenido con secciones claras
   - Incluye código si es relevante (formateado)

3. **Creación**
   - Usa create_note() con:
     - Título descriptivo basado en "{topic}"
     - Contenido resumido y organizado
     - Posición calculada para no solapar
     - Color apropiado si aplica

4. **Conexiones** (opcional)
   - Si hay notas relacionadas, sugiere conexiones
   - Crea las conexiones si el usuario aprueba

El formato del contenido debe ser legible tanto como texto plano como HTML simple."""

    @mcp.prompt()
    def backup_workspace(workspace_name: str) -> str:
        """
        Genera un backup completo de un workspace.

        Args:
            workspace_name: Nombre del workspace a respaldar
        """
        return f"""Genera un backup del workspace "{workspace_name}":

1. **Recolección de Datos**
   - Obtén el workspace con get_workspace()
   - Lista todos los desktops con get_desktop_hierarchy()
   - Para cada desktop, obtén el contenido con get_desktop_contents(include_note_content=true)
   - Lista assets de cada nota con list_note_assets()

2. **Generación del Backup**
   - Estructura los datos en formato JSON legible
   - Incluye metadata (fecha, versión, usuario)
   - Preserva todas las relaciones (IDs)

3. **Resumen**
   - Total de elementos respaldados
   - Tamaño aproximado
   - Notas sobre assets (URLs, no datos binarios)

4. **Entrega**
   - Muestra el JSON estructurado
   - O guárdalo como una nota especial "BACKUP_[fecha]"

Este proceso es de solo lectura y no modifica datos."""
