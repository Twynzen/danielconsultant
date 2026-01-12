"""
DeskFlow MCP Server - Schema Resources
Expone información del esquema de datos de DeskFlow
"""

from mcp.server.fastmcp import FastMCP


def register_resources(mcp: FastMCP):
    """Register schema and configuration resources"""

    @mcp.resource("schema://deskflow")
    def get_deskflow_schema() -> str:
        """
        Modelo de datos completo de DeskFlow.

        Describe la estructura jerárquica de workspaces, desktops, notas,
        folders, conexiones y assets.
        """
        return """
# DeskFlow - Modelo de Datos

## Jerarquía Principal

```
Usuario (profile)
└── Workspaces (contenedores principales)
    └── Desktops (escritorios virtuales, pueden anidarse)
        ├── Notes (notas con contenido)
        │   └── Assets (imágenes adjuntas)
        ├── Folders (enlaces a otros desktops)
        └── Connections (líneas entre notas)
```

## Tablas

### profiles
Información del usuario (extiende auth.users de Supabase)
- id: UUID (PK, ref auth.users.id)
- email: string
- display_name: string (opcional)
- avatar_url: string (opcional)
- created_at: timestamp
- updated_at: timestamp

### workspaces
Contenedor principal de un usuario
- id: UUID (PK)
- user_id: UUID (FK profiles.id)
- name: string (max 100)
- description: string (opcional)
- is_default: boolean
- theme_config: JSON
  - primaryColor: string (hex)
  - glowIntensity: number (0-1)
  - particlesEnabled: boolean
  - animationsEnabled: boolean
- created_at: timestamp
- updated_at: timestamp
- deleted_at: timestamp (soft delete)

### desktops
Escritorios virtuales dentro de un workspace
- id: UUID (PK)
- workspace_id: UUID (FK workspaces.id)
- parent_id: UUID (FK desktops.id, null=root)
- name: string (max 100)
- position_order: integer
- created_at: timestamp
- updated_at: timestamp

### notes
Notas dentro de un desktop
- id: UUID (PK)
- desktop_id: UUID (FK desktops.id)
- title: string (max 200)
- content: text (puede ser HTML)
- position_x: integer
- position_y: integer
- width: integer
- height: integer
- color: string (hex, opcional)
- z_index: integer
- minimized: boolean
- created_at: timestamp
- updated_at: timestamp

### assets
Imágenes adjuntas a notas (almacenadas en Supabase Storage)
- id: UUID (PK)
- note_id: UUID (FK notes.id)
- storage_path: string (ruta en bucket 'assets')
- original_name: string
- mime_type: string
- width: integer
- height: integer
- position_x: integer
- position_y: integer
- created_at: timestamp
- updated_at: timestamp

### folders
Enlaces visuales entre desktops
- id: UUID (PK)
- desktop_id: UUID (FK desktops.id, donde aparece)
- target_desktop_id: UUID (FK desktops.id, a donde lleva)
- name: string (max 100)
- position_x: integer
- position_y: integer
- icon: string (opcional)
- color: string (hex, opcional)
- created_at: timestamp
- updated_at: timestamp

### connections
Líneas visuales entre notas
- id: UUID (PK)
- desktop_id: UUID (FK desktops.id)
- from_note_id: UUID (FK notes.id)
- to_note_id: UUID (FK notes.id)
- color: string (hex, default #00ff41)
- created_at: timestamp
- updated_at: timestamp

### versions
Snapshots de estado del workspace
- id: UUID (PK)
- workspace_id: UUID (FK workspaces.id)
- version_number: integer
- snapshot: JSON (estado completo)
- change_summary: string
- created_at: timestamp

## Relaciones y Cascade

- workspaces → desktops: ON DELETE CASCADE
- desktops → notes: ON DELETE CASCADE
- desktops → folders: ON DELETE CASCADE
- desktops → connections: ON DELETE CASCADE
- notes → assets: ON DELETE CASCADE
- notes → connections (from/to): ON DELETE CASCADE

## Row Level Security (RLS)

Todas las tablas tienen RLS habilitado:
- Los usuarios solo pueden acceder a sus propios datos
- La jerarquía se valida a través de workspace.user_id
- Las políticas están configuradas en Supabase
"""

    @mcp.resource("schema://tables/workspaces")
    def get_workspaces_schema() -> str:
        """Schema de la tabla workspaces"""
        return """
# workspaces

Contenedor principal de datos de un usuario.

## Columnas
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| id | UUID | Auto | Primary key |
| user_id | UUID | Sí | Dueño del workspace |
| name | varchar(100) | Sí | Nombre del workspace |
| description | text | No | Descripción opcional |
| is_default | boolean | Sí | Si es el workspace principal |
| theme_config | jsonb | No | Configuración de tema |
| created_at | timestamptz | Auto | Fecha de creación |
| updated_at | timestamptz | Auto | Última modificación |
| deleted_at | timestamptz | No | Soft delete timestamp |

## Índices
- PRIMARY KEY (id)
- INDEX (user_id)
- UNIQUE (user_id, name) WHERE deleted_at IS NULL
"""

    @mcp.resource("schema://tables/notes")
    def get_notes_schema() -> str:
        """Schema de la tabla notes"""
        return """
# notes

Notas con contenido de texto/HTML dentro de desktops.

## Columnas
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| id | UUID | Auto | Primary key |
| desktop_id | UUID | Sí | Desktop contenedor |
| title | varchar(200) | Sí | Título de la nota |
| content | text | No | Contenido (texto/HTML) |
| position_x | integer | Sí | Posición X en el canvas |
| position_y | integer | Sí | Posición Y en el canvas |
| width | integer | Sí | Ancho de la nota |
| height | integer | Sí | Alto de la nota |
| color | varchar(7) | No | Color hex (#RRGGBB) |
| z_index | integer | Sí | Orden de apilamiento |
| minimized | boolean | Sí | Si está minimizada |
| created_at | timestamptz | Auto | Fecha de creación |
| updated_at | timestamptz | Auto | Última modificación |

## Índices
- PRIMARY KEY (id)
- INDEX (desktop_id)
- INDEX (updated_at)

## Cascade
- ON DELETE de desktop → CASCADE elimina notas
- ON DELETE de note → CASCADE elimina assets y connections
"""

    @mcp.resource("config://app")
    def get_app_config() -> str:
        """Configuración de la aplicación DeskFlow"""
        return """
# DeskFlow - Configuración

## Información de la Aplicación
- Nombre: DeskFlow (antes MultiDesktopFlow)
- Versión: 1.0.0
- Framework: Angular 21
- Backend: Supabase (PostgreSQL + Auth + Storage)

## URLs
- Web App: danielconsultant.dev/deskflow
- API: Supabase REST (via supabase-js)

## Límites
- Tamaño máximo de nota: 100,000 caracteres
- Tamaño máximo de asset: 5MB
- Profundidad máxima de desktops: Sin límite (recomendado < 10)
- Notas por desktop: Sin límite

## Tema por Defecto (Matrix)
```json
{
  "primaryColor": "#00ff41",
  "glowIntensity": 0.5,
  "particlesEnabled": true,
  "animationsEnabled": true
}
```

## Storage Buckets
- `assets`: Imágenes de notas (público con políticas RLS)

## Funcionalidades MCP Disponibles

### Tools (38 herramientas)
- Workspaces: list, get, get_default, create, update, delete
- Desktops: list, get, get_root, get_hierarchy, get_contents, create, update, delete
- Notes: list, get, create, update, delete, bring_to_front, duplicate
- Folders: list, get, create, update, delete
- Connections: list, get, get_note_connections, create, update, delete, delete_note_connections
- Assets: list_note, get, get_url, upload, update_position, delete, delete_note_assets
- Search: search_notes, search_in_desktop, get_recent, get_stats, find_connected

### Resources (4 recursos)
- schema://deskflow - Modelo de datos completo
- schema://tables/workspaces - Schema de workspaces
- schema://tables/notes - Schema de notes
- config://app - Configuración de la app

### Prompts (4 plantillas)
- summarize_workspace - Resumen de workspace
- organize_desktop - Sugerencias de organización
- find_related - Buscar notas relacionadas
- create_note_from_conversation - Crear nota desde conversación
"""
