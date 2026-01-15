#!/usr/bin/env python3
"""
DeskFlow MCP Server
==================
Servidor MCP para interactuar con DeskFlow desde Claude Desktop.

Uso:
    python server.py

Requiere configurar las variables de entorno en .env:
    - SUPABASE_URL
    - SUPABASE_ANON_KEY
    - USER_REFRESH_TOKEN

Documentación: Ver README.md
"""

import sys
import asyncio
from mcp.server.fastmcp import FastMCP

# Import tool registration functions
from tools import (
    register_workspace_tools,
    register_desktop_tools,
    register_note_tools,
    register_folder_tools,
    register_connection_tools,
    register_asset_tools,
    register_search_tools,
)
from resources import register_resources
from prompts import register_prompts
from auth import get_auth_manager, log


def create_server() -> FastMCP:
    """
    Create and configure the MCP server with all tools, resources, and prompts.
    """
    # Create MCP server instance
    mcp = FastMCP(
        name="DeskFlow"
    )

    # Register all tools
    log("Registering workspace tools...")
    register_workspace_tools(mcp)

    log("Registering desktop tools...")
    register_desktop_tools(mcp)

    log("Registering note tools...")
    register_note_tools(mcp)

    log("Registering folder tools...")
    register_folder_tools(mcp)

    log("Registering connection tools...")
    register_connection_tools(mcp)

    log("Registering asset tools...")
    register_asset_tools(mcp)

    log("Registering search tools...")
    register_search_tools(mcp)

    # Register resources
    log("Registering resources...")
    register_resources(mcp)

    # Register prompts
    log("Registering prompts...")
    register_prompts(mcp)

    log("Server configured successfully!")
    return mcp


async def validate_auth():
    """
    Validate authentication on startup.
    """
    try:
        auth = get_auth_manager()
        user = await auth.authenticate()
        log(f"Authentication successful: {user.email}")
        return True
    except Exception as e:
        log(f"Authentication failed: {e}", "ERROR")
        log("Please check your .env configuration", "ERROR")
        return False


def main():
    """
    Main entry point for the MCP server.
    """
    log("=" * 50)
    log("DeskFlow MCP Server Starting...")
    log("=" * 50)

    # Validate environment and auth
    try:
        # Run auth validation
        if not asyncio.run(validate_auth()):
            log("Exiting due to authentication failure", "ERROR")
            sys.exit(1)
    except Exception as e:
        log(f"Startup error: {e}", "ERROR")
        log("Make sure .env is configured correctly", "ERROR")
        sys.exit(1)

    # Create and run server
    mcp = create_server()

    log("Starting MCP server on stdio...")
    log("Ready to accept connections from Claude Desktop")
    log("=" * 50)

    # Run the server (stdio transport by default)
    mcp.run()


if __name__ == "__main__":
    main()
