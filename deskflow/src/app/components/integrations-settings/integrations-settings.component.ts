import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  ApiKeyScope,
  ApiKeysService,
  NewApiKey,
} from '../../services/api-keys.service';

@Component({
  selector: 'app-integrations-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, DatePipe],
  templateUrl: './integrations-settings.component.html',
  styleUrl: './integrations-settings.component.scss',
})
export class IntegrationsSettingsComponent implements OnInit {
  private apiKeys = inject(ApiKeysService);

  readonly keys = this.apiKeys.keys;
  readonly loading = this.apiKeys.loading;
  readonly serviceError = this.apiKeys.error;

  readonly newKeyName = signal('');
  readonly scopeRead = signal(true);
  readonly scopeWrite = signal(false);
  readonly scopeAdmin = signal(false);
  readonly rateLimit = signal(60);

  readonly justMinted = signal<NewApiKey | null>(null);
  readonly copyFeedback = signal<string | null>(null);
  readonly creating = signal(false);
  readonly createError = signal<string | null>(null);

  readonly activeKeys = computed(() => this.keys().filter(k => !k.revoked));
  readonly revokedKeys = computed(() => this.keys().filter(k => k.revoked));

  async ngOnInit(): Promise<void> {
    await this.apiKeys.list();
  }

  async create(): Promise<void> {
    this.createError.set(null);
    const name = this.newKeyName().trim();
    if (!name) {
      this.createError.set('Dale un nombre a la key (ej: "Sendell Bot", "n8n workflow").');
      return;
    }

    const scopes: ApiKeyScope[] = [];
    if (this.scopeRead()) scopes.push('read');
    if (this.scopeWrite()) scopes.push('write');
    if (this.scopeAdmin()) scopes.push('admin');
    if (scopes.length === 0) {
      this.createError.set('Selecciona al menos un scope.');
      return;
    }

    this.creating.set(true);
    try {
      const minted = await this.apiKeys.create({
        name,
        scopes,
        rateLimit: this.rateLimit(),
      });
      this.justMinted.set(minted);
      this.newKeyName.set('');
    } catch (e: any) {
      this.createError.set(e?.message ?? 'Error creando API key');
    } finally {
      this.creating.set(false);
    }
  }

  async revoke(id: string): Promise<void> {
    if (!confirm('¿Revocar esta key? No se puede deshacer (la key deja de funcionar).')) {
      return;
    }
    try {
      await this.apiKeys.revoke(id);
    } catch (e: any) {
      alert(e?.message ?? 'No se pudo revocar');
    }
  }

  async copy(value: string, label: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      this.copyFeedback.set(label);
      setTimeout(() => this.copyFeedback.set(null), 1600);
    } catch {
      this.copyFeedback.set('No se pudo copiar — selecciona y copia a mano.');
    }
  }

  dismissJustMinted(): void {
    this.justMinted.set(null);
  }
}
