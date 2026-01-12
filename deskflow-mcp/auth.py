"""
DeskFlow MCP Server - Authentication Module
Maneja la autenticación con Supabase usando refresh tokens
"""

import os
import sys
import time
from typing import Optional
from dataclasses import dataclass
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Logging to stderr (MCP requirement - stdout is for JSON-RPC only)
def log(message: str, level: str = "INFO"):
    """Log message to stderr"""
    print(f"[{level}] {message}", file=sys.stderr)


@dataclass
class AuthConfig:
    """Configuration for Supabase authentication"""
    supabase_url: str
    supabase_anon_key: str
    user_refresh_token: str
    rate_limit_read: int = 100
    rate_limit_write: int = 30


@dataclass
class AuthenticatedUser:
    """Authenticated user information"""
    user_id: str
    email: str
    access_token: str
    refresh_token: str
    expires_at: int


class AuthManager:
    """
    Manages Supabase authentication for the MCP server.
    Uses refresh tokens to maintain user sessions.
    """

    def __init__(self, config: Optional[AuthConfig] = None):
        self.config = config or self._load_config_from_env()
        self._supabase: Optional[Client] = None
        self._current_user: Optional[AuthenticatedUser] = None
        self._token_expires_at: int = 0

        # Rate limiting
        self._request_timestamps: list[float] = []

    def _load_config_from_env(self) -> AuthConfig:
        """Load configuration from environment variables"""
        url = os.getenv("SUPABASE_URL", "")
        anon_key = os.getenv("SUPABASE_ANON_KEY", "")
        refresh_token = os.getenv("USER_REFRESH_TOKEN", "")

        if not url or not anon_key:
            raise ValueError(
                "SUPABASE_URL y SUPABASE_ANON_KEY son requeridos. "
                "Configura tu archivo .env"
            )

        if not refresh_token:
            raise ValueError(
                "USER_REFRESH_TOKEN es requerido. "
                "Obtén tu token desde DeskFlow web (botón 'Copiar Token MCP')"
            )

        return AuthConfig(
            supabase_url=url,
            supabase_anon_key=anon_key,
            user_refresh_token=refresh_token,
            rate_limit_read=int(os.getenv("RATE_LIMIT_READ", "100")),
            rate_limit_write=int(os.getenv("RATE_LIMIT_WRITE", "30")),
        )

    @property
    def supabase(self) -> Client:
        """Get or create Supabase client"""
        if self._supabase is None:
            self._supabase = create_client(
                self.config.supabase_url,
                self.config.supabase_anon_key
            )
        return self._supabase

    async def authenticate(self) -> AuthenticatedUser:
        """
        Authenticate using the refresh token.
        Returns the authenticated user information.
        """
        # Check if we have a valid session
        if self._current_user and time.time() < self._token_expires_at - 60:
            return self._current_user

        log("Refreshing authentication token...")

        try:
            # Use refresh token to get new session
            response = self.supabase.auth.refresh_session(
                self.config.user_refresh_token
            )

            if not response.session:
                raise ValueError("No se pudo obtener sesión con el refresh token")

            session = response.session
            user = response.user

            self._current_user = AuthenticatedUser(
                user_id=user.id,
                email=user.email or "",
                access_token=session.access_token,
                refresh_token=session.refresh_token,
                expires_at=session.expires_at or 0
            )

            self._token_expires_at = session.expires_at or 0

            # Update the refresh token in case it was rotated
            if session.refresh_token != self.config.user_refresh_token:
                log("Refresh token was rotated. Update your .env file with the new token.")
                log(f"New refresh token: {session.refresh_token[:20]}...", "WARNING")

            log(f"Authenticated as: {self._current_user.email}")
            return self._current_user

        except Exception as e:
            log(f"Authentication failed: {str(e)}", "ERROR")
            raise ValueError(
                f"Error de autenticación: {str(e)}. "
                "Verifica tu USER_REFRESH_TOKEN en el archivo .env"
            )

    def get_authenticated_client(self) -> Client:
        """
        Get a Supabase client authenticated as the current user.
        The client will use the user's access token for RLS.
        """
        if not self._current_user:
            raise ValueError("Not authenticated. Call authenticate() first.")

        # Set the access token for subsequent requests
        self.supabase.postgrest.auth(self._current_user.access_token)
        return self.supabase

    @property
    def user_id(self) -> str:
        """Get current user ID"""
        if not self._current_user:
            raise ValueError("Not authenticated")
        return self._current_user.user_id

    @property
    def user_email(self) -> str:
        """Get current user email"""
        if not self._current_user:
            raise ValueError("Not authenticated")
        return self._current_user.email

    def check_rate_limit(self, is_write: bool = False) -> None:
        """
        Check if the request is within rate limits.
        Raises ValueError if rate limit exceeded.
        """
        now = time.time()
        window = 60  # 1 minute window

        # Clean old timestamps
        self._request_timestamps = [
            ts for ts in self._request_timestamps
            if ts > now - window
        ]

        limit = self.config.rate_limit_write if is_write else self.config.rate_limit_read

        if len(self._request_timestamps) >= limit:
            raise ValueError(
                f"Rate limit exceeded. Maximum {limit} requests per minute for "
                f"{'write' if is_write else 'read'} operations."
            )

        self._request_timestamps.append(now)


# Global auth manager instance
_auth_manager: Optional[AuthManager] = None


def get_auth_manager() -> AuthManager:
    """Get or create the global auth manager"""
    global _auth_manager
    if _auth_manager is None:
        _auth_manager = AuthManager()
    return _auth_manager


async def get_authenticated_client() -> Client:
    """
    Convenience function to get an authenticated Supabase client.
    Handles authentication automatically.
    """
    auth = get_auth_manager()
    await auth.authenticate()
    return auth.get_authenticated_client()


def check_rate_limit(is_write: bool = False) -> None:
    """Convenience function to check rate limits"""
    get_auth_manager().check_rate_limit(is_write)
