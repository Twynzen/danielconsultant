# DeskFlow MCP Server

Servidor MCP (Model Context Protocol) para interactuar con **DeskFlow** desde Claude Desktop.

Con este servidor puedes usar Claude para:
- Buscar en tus notas
- Crear, editar y eliminar notas
- Organizar tus workspaces
- Generar conexiones entre notas
- Y mucho más...

---

## Requisitos

- **Python 3.10+** instalado en tu computadora
- **pip** (gestor de paquetes de Python)
- **Claude Desktop** instalado ([descargar aquí](https://claude.ai/download))
- Una cuenta en **DeskFlow** con datos sincronizados en la nube

---

## Instalación Paso a Paso

### Paso 1: Verificar Python

Abre una terminal y verifica que tienes Python 3.10 o superior:

```bash
python --version
# o en algunos sistemas:
python3 --version
```

Si no tienes Python, descárgalo desde [python.org](https://www.python.org/downloads/)

### Paso 2: Navegar al directorio del MCP server

```bash
cd /ruta/a/danielconsultant/deskflow-mcp
```

### Paso 3: Crear entorno virtual (recomendado)

```bash
# Crear entorno virtual
python -m venv venv

# Activar entorno virtual
# En Windows:
venv\Scripts\activate

# En macOS/Linux:
source venv/bin/activate
```

### Paso 4: Instalar dependencias

```bash
pip install -r requirements.txt
```

### Paso 5: Configurar credenciales

1. Copia el archivo de ejemplo:

```bash
cp .env.example .env
```

2. Edita el archivo `.env` con tus credenciales:

```env
# URL de tu proyecto Supabase
SUPABASE_URL=https://mzgwipdaveyzgscnxlhj.supabase.co

# Tu Anon Key de Supabase (está en el frontend, no es secreto)
SUPABASE_ANON_KEY=eyJ...

# Tu refresh token (ver siguiente sección)
USER_REFRESH_TOKEN=tu-token-aqui
```

### Paso 6: Obtener tu Refresh Token

1. Abre DeskFlow en tu navegador: [danielconsultant.dev/deskflow](https://danielconsultant.dev/deskflow)
2. Inicia sesión con tu cuenta
3. Haz clic en tu nombre de usuario (esquina superior derecha)
4. Haz clic en **"Copiar Token MCP"**
5. Pega el token en tu archivo `.env` en la línea `USER_REFRESH_TOKEN=`

### Paso 7: Probar el servidor

```bash
python server.py
```

Deberías ver algo como:
```
[INFO] ==================================================
[INFO] DeskFlow MCP Server Starting...
[INFO] ==================================================
[INFO] Refreshing authentication token...
[INFO] Authenticated as: tu-email@ejemplo.com
[INFO] Registering workspace tools...
[INFO] ...
[INFO] Server configured successfully!
[INFO] Starting MCP server on stdio...
[INFO] Ready to accept connections from Claude Desktop
[INFO] ==================================================
```

Presiona `Ctrl+C` para detener el servidor.

---

## Configurar Claude Desktop

### Paso 1: Localizar el archivo de configuración

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Si el archivo no existe, créalo.

### Paso 2: Agregar la configuración del MCP server

Edita el archivo `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "deskflow": {
      "command": "python",
      "args": ["/ruta/completa/a/deskflow-mcp/server.py"],
      "env": {
        "PYTHONUNBUFFERED": "1"
      }
    }
  }
}
```

**Importante**: Reemplaza `/ruta/completa/a/deskflow-mcp/server.py` con la ruta real en tu sistema.

#### Ejemplos de rutas:

**macOS**:
```json
"args": ["/Users/tuusuario/proyectos/danielconsultant/deskflow-mcp/server.py"]
```

**Windows**:
```json
"args": ["C:\\Users\\tuusuario\\proyectos\\danielconsultant\\deskflow-mcp\\server.py"]
```

**Linux**:
```json
"args": ["/home/tuusuario/proyectos/danielconsultant/deskflow-mcp/server.py"]
```

### Paso 3: Si usas entorno virtual

Si creaste un entorno virtual, usa el Python del entorno:

**macOS/Linux**:
```json
{
  "mcpServers": {
    "deskflow": {
      "command": "/ruta/a/deskflow-mcp/venv/bin/python",
      "args": ["/ruta/a/deskflow-mcp/server.py"],
      "env": {
        "PYTHONUNBUFFERED": "1"
      }
    }
  }
}
```

**Windows**:
```json
{
  "mcpServers": {
    "deskflow": {
      "command": "C:\\ruta\\a\\deskflow-mcp\\venv\\Scripts\\python.exe",
      "args": ["C:\\ruta\\a\\deskflow-mcp\\server.py"],
      "env": {
        "PYTHONUNBUFFERED": "1"
      }
    }
  }
}
```

### Paso 4: Reiniciar Claude Desktop

1. Cierra completamente Claude Desktop
2. Vuelve a abrirlo
3. En una nueva conversación, deberías ver el icono de herramientas (martillo) indicando que el MCP está conectado

---

## Usar el MCP Server

Una vez configurado, puedes pedirle a Claude cosas como:

### Consultas
- "Muéstrame mis workspaces"
- "¿Qué notas tengo en el desktop principal?"
- "Busca notas que mencionen 'Angular'"
- "Dame las estadísticas de mi workspace"

### Crear contenido
- "Crea una nota con el resumen de nuestra conversación"
- "Crea un folder llamado 'Proyectos 2026'"
- "Conecta la nota X con la nota Y"

### Organizar
- "¿Qué notas están relacionadas con 'MCP'?"
- "Sugiere cómo organizar mejor mi desktop"

---

## Herramientas Disponibles

### Workspaces
| Herramienta | Descripción |
|-------------|-------------|
| `list_workspaces` | Lista todos tus workspaces |
| `get_workspace` | Obtiene detalles de un workspace |
| `get_default_workspace` | Obtiene el workspace por defecto |
| `create_workspace` | Crea un nuevo workspace |
| `update_workspace` | Actualiza un workspace |
| `delete_workspace` | Elimina un workspace |

### Desktops
| Herramienta | Descripción |
|-------------|-------------|
| `list_desktops` | Lista desktops de un workspace |
| `get_desktop` | Obtiene un desktop específico |
| `get_root_desktop` | Obtiene el desktop raíz |
| `get_desktop_hierarchy` | Obtiene árbol de desktops |
| `get_desktop_contents` | Obtiene notas, folders, conexiones |
| `create_desktop` | Crea un nuevo desktop |
| `update_desktop` | Actualiza un desktop |
| `delete_desktop` | Elimina un desktop |

### Notas
| Herramienta | Descripción |
|-------------|-------------|
| `list_notes` | Lista notas de un desktop |
| `get_note` | Obtiene una nota con su contenido |
| `create_note` | Crea una nueva nota |
| `update_note` | Actualiza una nota |
| `delete_note` | Elimina una nota |
| `bring_note_to_front` | Trae nota al frente |
| `duplicate_note` | Duplica una nota |

### Folders
| Herramienta | Descripción |
|-------------|-------------|
| `list_folders` | Lista folders de un desktop |
| `get_folder` | Obtiene un folder |
| `create_folder` | Crea un folder (enlace a desktop) |
| `update_folder` | Actualiza un folder |
| `delete_folder` | Elimina un folder |

### Conexiones
| Herramienta | Descripción |
|-------------|-------------|
| `list_connections` | Lista conexiones de un desktop |
| `get_note_connections` | Conexiones de una nota |
| `create_connection` | Conecta dos notas |
| `update_connection` | Actualiza color de conexión |
| `delete_connection` | Elimina una conexión |

### Assets (Imágenes)
| Herramienta | Descripción |
|-------------|-------------|
| `list_note_assets` | Lista imágenes de una nota |
| `get_asset` | Obtiene info de un asset |
| `get_asset_url` | Obtiene URL de imagen |
| `upload_asset` | Sube una imagen |
| `delete_asset` | Elimina una imagen |

### Búsqueda
| Herramienta | Descripción |
|-------------|-------------|
| `search_notes` | Busca en todo el workspace |
| `search_notes_in_desktop` | Busca en un desktop |
| `get_recent_notes` | Notas recientes |
| `get_workspace_stats` | Estadísticas del workspace |
| `find_connected_notes` | Encuentra notas conectadas |

---

## Solución de Problemas

### Error: "SUPABASE_URL y SUPABASE_ANON_KEY son requeridos"

Asegúrate de haber creado el archivo `.env` correctamente:
```bash
cp .env.example .env
# Edita .env con tus credenciales
```

### Error: "USER_REFRESH_TOKEN es requerido"

1. Abre DeskFlow en el navegador
2. Inicia sesión
3. Click en tu usuario → "Copiar Token MCP"
4. Pega el token en `.env`

### Error: "No se pudo obtener sesión con el refresh token"

Tu token puede haber expirado. Repite el proceso de obtener un nuevo token desde DeskFlow.

### Claude Desktop no detecta el MCP

1. Verifica que la ruta en `claude_desktop_config.json` sea correcta
2. Asegúrate de que Python esté en el PATH
3. Reinicia Claude Desktop completamente
4. Revisa los logs de Claude Desktop para errores

### El servidor no inicia

Verifica las dependencias:
```bash
pip install -r requirements.txt
```

---

## Notas Importantes

### Sincronización

El MCP server trabaja directamente con Supabase (la nube). Los cambios hechos via MCP **no aparecen automáticamente** en la app web.

Para ver los cambios en la app web:
1. Abre DeskFlow
2. Ve al menú → "Cargar desde nube"

### Seguridad

- Tu refresh token es como una contraseña temporal
- **No compartas tu token** con nadie
- El token se usa para autenticarte como tú mismo
- Solo puedes acceder a tus propios datos (RLS de Supabase lo garantiza)

### Rate Limiting

Para proteger tu cuenta:
- Máximo 100 operaciones de lectura por minuto
- Máximo 30 operaciones de escritura por minuto

---

## Estructura del Proyecto

```
deskflow-mcp/
├── server.py           # Punto de entrada principal
├── auth.py             # Autenticación con Supabase
├── tools/              # Herramientas MCP
│   ├── workspaces.py
│   ├── desktops.py
│   ├── notes.py
│   ├── folders.py
│   ├── connections.py
│   ├── assets.py
│   └── search.py
├── resources/          # Recursos MCP (schema, config)
│   └── schema.py
├── prompts/            # Plantillas de prompts
│   └── templates.py
├── requirements.txt    # Dependencias Python
├── .env.example        # Plantilla de configuración
└── README.md           # Este archivo
```

---

## Futuras Mejoras

- [ ] Deployment en Railway/Fly.io para acceso remoto
- [ ] Autenticación OAuth para mayor seguridad
- [ ] Subscripciones en tiempo real
- [ ] Más prompts predefinidos

---

## Soporte

Si tienes problemas o preguntas:
1. Revisa la sección de Solución de Problemas
2. Verifica que DeskFlow funcione correctamente en el navegador
3. Asegúrate de que tus datos estén sincronizados en la nube

---

**Desarrollado para DeskFlow** | Enero 2026
