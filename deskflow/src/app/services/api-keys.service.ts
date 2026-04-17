import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';

export type ApiKeyScope = 'read' | 'write' | 'admin';

export interface ApiKeyRow {
  id: string;
  name: string;
  key_prefix: string;
  scopes: ApiKeyScope[];
  rate_limit: number;
  revoked: boolean;
  created_at: string;
  last_used_at: string | null;
}

export interface NewApiKey extends ApiKeyRow {
  /** Plaintext — shown once, then discarded from memory. */
  key: string;
}

const KEY_PREFIX = 'dfk_';

/**
 * Manages per-user API keys directly against Supabase using RLS.
 *
 * Plaintext keys are generated and hashed in the browser (WebCrypto SHA-256).
 * The server only ever sees the hash — this matches the schema in the
 * intelligence engine migration and works identically whether the caller is
 * this UI or the MCP remote's `/api/agent/keys` endpoint.
 */
@Injectable({ providedIn: 'root' })
export class ApiKeysService {
  private supabase = inject(SupabaseService);
  private auth = inject(AuthService);

  readonly keys = signal<ApiKeyRow[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  async list(): Promise<ApiKeyRow[]> {
    if (!this.supabase.isConfigured()) {
      this.error.set('Supabase no está configurado.');
      return [];
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      const { data, error } = await this.supabase.from('api_keys')
        .select('id, name, key_prefix, scopes, rate_limit, revoked, created_at, last_used_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as ApiKeyRow[];
      this.keys.set(rows);
      return rows;
    } catch (e: any) {
      this.error.set(e?.message ?? 'Error cargando API keys');
      return [];
    } finally {
      this.loading.set(false);
    }
  }

  async create(input: {
    name: string;
    scopes: ApiKeyScope[];
    rateLimit?: number;
  }): Promise<NewApiKey> {
    if (!this.supabase.isConfigured()) {
      throw new Error('Supabase no está configurado.');
    }
    const user = this.auth.currentUser();
    if (!user) throw new Error('No hay sesión activa.');

    const plaintext = this.generatePlaintext();
    const hash = await this.sha256Hex(plaintext);
    const prefix = plaintext.slice(0, 8);

    const { data, error } = await this.supabase.from('api_keys')
      .insert({
        user_id: user.id,
        name: input.name.trim(),
        key_prefix: prefix,
        key_hash: hash,
        scopes: input.scopes,
        rate_limit: Math.max(1, Math.min(input.rateLimit ?? 60, 1000)),
      })
      .select('id, name, key_prefix, scopes, rate_limit, revoked, created_at, last_used_at')
      .single();

    if (error) throw error;

    const row = data as ApiKeyRow;
    this.keys.update(current => [{ ...row }, ...current]);
    return { ...row, key: plaintext };
  }

  async revoke(id: string): Promise<void> {
    const { error } = await this.supabase.from('api_keys')
      .update({ revoked: true })
      .eq('id', id);
    if (error) throw error;
    this.keys.update(rows => rows.map(r => r.id === id ? { ...r, revoked: true } : r));
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.from('api_keys')
      .delete()
      .eq('id', id);
    if (error) throw error;
    this.keys.update(rows => rows.filter(r => r.id !== id));
  }

  // ---------------------------------------------------------------------------
  // Crypto helpers
  // ---------------------------------------------------------------------------

  private generatePlaintext(): string {
    // 32 random bytes → url-safe base64 → 43 chars. Final length ~47.
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    let base = '';
    for (const b of bytes) base += String.fromCharCode(b);
    const b64 = btoa(base)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    return KEY_PREFIX + b64;
  }

  private async sha256Hex(value: string): Promise<string> {
    const buf = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(value),
    );
    return Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}
