"""
DeskFlow MCP Server - Tools Module
Herramientas para interactuar con DeskFlow via MCP
"""

from .workspaces import register_workspace_tools
from .desktops import register_desktop_tools
from .notes import register_note_tools
from .folders import register_folder_tools
from .connections import register_connection_tools
from .assets import register_asset_tools
from .search import register_search_tools
from .metadata import register_metadata_tools
from .intelligence import register_intelligence_tools
from .views import register_view_tools
from .agent_api import register_agent_api_tools
from .connectors import register_connector_tools
from .calendar import register_calendar_tools

__all__ = [
    "register_workspace_tools",
    "register_desktop_tools",
    "register_note_tools",
    "register_folder_tools",
    "register_connection_tools",
    "register_asset_tools",
    "register_search_tools",
    "register_metadata_tools",
    "register_intelligence_tools",
    "register_view_tools",
    "register_agent_api_tools",
    "register_connector_tools",
    "register_calendar_tools",
]
