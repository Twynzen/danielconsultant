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

__all__ = [
    "register_workspace_tools",
    "register_desktop_tools",
    "register_note_tools",
    "register_folder_tools",
    "register_connection_tools",
    "register_asset_tools",
    "register_search_tools",
]
