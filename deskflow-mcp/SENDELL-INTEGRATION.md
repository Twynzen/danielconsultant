# Integración de Sendell con DeskFlow MCP

## Arquitectura

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Sendell   │ ──► │  DeskFlow   │ ──► │  Supabase   │
│    (RAG)    │     │  MCP API    │     │    (DB)     │
│             │     │  (Render)   │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
```

## Configuración

### Variables de entorno para Sendell:

```env
DESKFLOW_MCP_URL=https://deskflow-mcp.onrender.com
DESKFLOW_USER_TOKEN=tu-refresh-token-de-deskflow
```

## Ejemplos de Código

### Python - Obtener Índice del Workspace

```python
import httpx

MCP_URL = "https://deskflow-mcp.onrender.com"
USER_TOKEN = "tu-token"

async def get_workspace_index():
    """Obtiene toda la estructura del workspace del usuario."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{MCP_URL}/api/workspace-index",
            json={
                "user_token": USER_TOKEN,
                "include_content": False  # True si quieres el contenido de las notas
            }
        )
        return response.json()

# Resultado:
# {
#     "workspace": {"id": "...", "name": "Mi Workspace"},
#     "desktops": [...],
#     "notes": [{"id": "...", "title": "Núvariz"}, ...],
#     "folders": [...],
#     "stats": {"desktops": 11, "notes": 14, "folders": 10}
# }
```

### Python - Buscar Notas

```python
async def search_notes(query: str, workspace_id: str):
    """Busca notas por título o contenido."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{MCP_URL}/api/search",
            json={
                "user_token": USER_TOKEN,
                "workspace_id": workspace_id,
                "query": query,
                "limit": 10
            }
        )
        return response.json()

# Ejemplo:
# results = await search_notes("Núvariz", "workspace-id")
# Devuelve notas que mencionan "Núvariz"
```

### Python - Obtener Notas Recientes

```python
async def get_recent_notes(limit: int = 5):
    """Obtiene las notas más recientemente editadas."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{MCP_URL}/api/recent-notes",
            params={
                "user_token": USER_TOKEN,
                "limit": limit
            }
        )
        return response.json()

# Útil para: "¿En qué está trabajando el usuario?"
```

### Python - Crear Nota desde Sendell

```python
async def create_note(desktop_id: str, title: str, content: str):
    """Crea una nota nueva (ej: guardar resumen de conversación)."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{MCP_URL}/api/note",
            json={
                "user_token": USER_TOKEN,
                "desktop_id": desktop_id,
                "title": title,
                "content": content,
                "color": "#00ff41"
            }
        )
        return response.json()

# Ejemplo:
# await create_note(
#     desktop_id="...",
#     title="Resumen Conversación - 15 Ene 2026",
#     content="El usuario preguntó sobre MCPs y cómo integrar Sendell..."
# )
```

### Python - Obtener Contenido de una Nota

```python
async def get_note(note_id: str):
    """Obtiene el contenido completo de una nota."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{MCP_URL}/api/note/{note_id}",
            params={"user_token": USER_TOKEN}
        )
        return response.json()
```

## Casos de Uso para Sendell

### 1. Contexto de Proyectos

```python
async def get_project_context():
    """Sendell obtiene contexto de los proyectos del usuario."""
    index = await get_workspace_index()

    # Extraer títulos de notas como contexto
    projects = [note["title"] for note in index["notes"]]

    return f"El usuario tiene estos proyectos/notas: {', '.join(projects)}"
```

### 2. Responder Preguntas sobre Proyectos

```python
async def answer_project_question(question: str):
    """
    Usuario: "¿Qué es Núvariz?"
    Sendell busca en DeskFlow y responde.
    """
    # Buscar notas relevantes
    results = await search_notes("Núvariz", workspace_id)

    if results["results"]:
        note = results["results"][0]
        content = await get_note(note["id"])
        return f"Según tus notas: {content['content'][:500]}..."

    return "No encontré información sobre Núvariz en tus notas."
```

### 3. Guardar Insights de Conversaciones

```python
async def save_conversation_summary(summary: str):
    """Guarda un resumen de la conversación en DeskFlow."""
    from datetime import datetime

    # Obtener el desktop principal
    index = await get_workspace_index()
    main_desktop = index["desktops"][0]["id"]

    await create_note(
        desktop_id=main_desktop,
        title=f"Sendell - {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        content=summary
    )
```

### 4. Feed de Actividad

```python
async def get_user_activity():
    """Saber en qué está trabajando el usuario."""
    recent = await get_recent_notes(limit=5)

    activities = [
        f"- {note['title']} (editado: {note['updated_at'][:10]})"
        for note in recent["notes"]
    ]

    return "Actividad reciente:\n" + "\n".join(activities)
```

## Integración con RAG

### Agregar DeskFlow como Fuente de Conocimiento

```python
from langchain.schema import Document

async def load_deskflow_documents():
    """Carga notas de DeskFlow como documentos para RAG."""
    index = await get_workspace_index()
    index["include_content"] = True  # Necesitamos el contenido

    # Re-fetch con contenido
    full_index = await get_workspace_index_with_content()

    documents = []
    for note in full_index["notes"]:
        if note.get("content"):
            documents.append(Document(
                page_content=note["content"],
                metadata={
                    "source": "deskflow",
                    "title": note["title"],
                    "note_id": note["id"],
                    "updated_at": note.get("updated_at")
                }
            ))

    return documents

# Luego indexar con tu vector store favorito
# vectorstore.add_documents(documents)
```

## Manejo de Errores

```python
async def safe_api_call(func, *args, **kwargs):
    """Wrapper para manejar errores de la API."""
    try:
        return await func(*args, **kwargs)
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 401:
            return {"error": "Token inválido o expirado"}
        elif e.response.status_code == 404:
            return {"error": "Recurso no encontrado"}
        else:
            return {"error": f"Error HTTP: {e.response.status_code}"}
    except Exception as e:
        return {"error": str(e)}
```

## Rate Limits

El MCP tiene rate limiting para proteger la cuenta:

| Operación | Límite |
|-----------|--------|
| Lectura | 100/min |
| Escritura | 30/min |

Sendell debería cachear resultados cuando sea posible.

---

## Resumen

Con esta integración, Sendell puede:
- ✅ Conocer los proyectos del usuario
- ✅ Buscar información específica
- ✅ Responder preguntas basadas en notas
- ✅ Guardar conversaciones importantes
- ✅ Alimentar su RAG con conocimiento personal

**El MCP es el puente entre tu conocimiento en DeskFlow y tu robot personal Sendell.**
