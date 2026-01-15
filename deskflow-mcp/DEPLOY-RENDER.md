# Deploy DeskFlow MCP en Render (GRATIS)

## Paso 1: Subir a GitHub

```bash
git add .
git commit -m "feat: Add remote MCP server for Render"
git push origin main
```

## Paso 2: Crear cuenta en Render

1. Ve a [render.com](https://render.com)
2. Crea cuenta (puedes usar GitHub)

## Paso 3: Deploy

### Opción A: Deploy Automático (Blueprint)

1. Click en "New" → "Blueprint"
2. Conecta tu repo de GitHub
3. Selecciona la carpeta `deskflow-mcp/`
4. Render detectará el `render.yaml` automáticamente

### Opción B: Deploy Manual

1. Click en "New" → "Web Service"
2. Conecta tu repo de GitHub
3. Configura:
   - **Name**: `deskflow-mcp`
   - **Root Directory**: `deskflow-mcp`
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn server_remote:app --host 0.0.0.0 --port $PORT`
   - **Plan**: Free

## Paso 4: Variables de Entorno

En el dashboard de Render, ve a "Environment" y agrega:

| Variable | Valor |
|----------|-------|
| `SUPABASE_URL` | `https://mzgwipdaveyzgscnxlhj.supabase.co` |
| `SUPABASE_ANON_KEY` | Tu anon key de Supabase |
| `API_SECRET_KEY` | Una clave secreta para la API (genera una aleatoria) |

## Paso 5: UptimeRobot (Mantener Vivo)

El plan gratis de Render duerme el servidor después de 15 min de inactividad.

1. Crea cuenta en [uptimerobot.com](https://uptimerobot.com) (gratis)
2. Crea monitor:
   - **Type**: HTTP(s)
   - **URL**: `https://tu-app.onrender.com/health`
   - **Interval**: 5 minutes
3. Esto hace ping cada 5 min y mantiene el servidor activo

## Paso 6: Probar

Tu servidor estará en: `https://deskflow-mcp.onrender.com`

### Endpoints disponibles:

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/` | GET | Info del servidor |
| `/health` | GET | Health check |
| `/docs` | GET | Documentación Swagger |
| `/api/workspace-index` | POST | Índice completo del workspace |
| `/api/search` | POST | Buscar notas |
| `/api/recent-notes` | GET | Notas recientes |
| `/api/note` | POST | Crear nota |
| `/api/note/{id}` | GET | Obtener nota |
| `/mcp/sse` | GET | SSE para Claude Desktop |

## Usar con Claude Desktop (Remoto)

Edita `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "deskflow-remote": {
      "url": "https://deskflow-mcp.onrender.com/mcp/sse?user_token=TU_TOKEN"
    }
  }
}
```

## Usar con Sendell (REST API)

Ver `SENDELL-INTEGRATION.md` para ejemplos de código.

---

**Tiempo estimado de deploy**: 5-10 minutos
**Costo**: $0 (gratis)
