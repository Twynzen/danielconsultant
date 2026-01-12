/**
 * Sendell Memory Service
 * v1.0: Sistema de memoria para Sendell (Short-term + Long-term)
 *
 * Este servicio proporciona memoria persistente para Sendell:
 *
 * SHORT-TERM MEMORY:
 * - Pilares visitados en la sesión actual
 * - Temas discutidos
 * - Contexto de la conversación actual
 *
 * LONG-TERM MEMORY (localStorage):
 * - Historial de visitas previas
 * - Intereses detectados del usuario
 * - Pilares favoritos/más visitados
 * - Preferencias de interacción
 *
 * BENEFICIOS:
 * - Conversaciones más coherentes ("Ya te mostré RAG antes...")
 * - Personalización ("Veo que te interesa automatización...")
 * - Evita repeticiones innecesarias
 * - Respuestas más rápidas para patrones conocidos
 */

import { Injectable, signal, computed } from '@angular/core';

// Interfaces
export interface VisitedPillar {
  pillarId: string;
  timestamp: number;
  wasExplained: boolean;
}

export interface DetectedInterest {
  topic: string;
  score: number; // 0-1, incrementa con cada mención
  lastMentioned: number;
}

export interface UserSession {
  sessionId: string;
  startTime: number;
  visitedPillars: VisitedPillar[];
  queryCount: number;
  lastActivity: number;
}

export interface LongTermMemory {
  userId: string; // Generado aleatoriamente, almacenado en localStorage
  firstVisit: number;
  totalVisits: number;
  totalQueries: number;
  interests: DetectedInterest[];
  pillarVisitCounts: Record<string, number>;
  lastVisit: number;
  preferredLanguage: 'es' | 'en';
  hasCompletedTour: boolean;
  hasBookedConsultation: boolean;
}

// Temas de interés detectables
const INTEREST_TOPICS: Record<string, string[]> = {
  'automatizacion': ['automatizar', 'automatización', 'workflow', 'proceso', 'flujo'],
  'privacidad': ['privacidad', 'privado', 'local', 'offline', 'datos sensibles', 'compliance'],
  'documentos': ['documento', 'pdf', 'buscar', 'búsqueda', 'conocimiento'],
  'integracion': ['integrar', 'integración', 'api', 'conectar', 'sistema'],
  'agentes': ['agente', 'multi-agent', 'orquestación', 'colaborar'],
  'consulta': ['agendar', 'sesión', 'consulta', 'hablar', 'contacto', 'precio']
};

const STORAGE_KEY = 'sendell_memory';
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutos

@Injectable({
  providedIn: 'root'
})
export class SendellMemoryService {

  // Estado de sesión actual (short-term)
  private _currentSession = signal<UserSession | null>(null);

  // Memoria a largo plazo
  private _longTermMemory = signal<LongTermMemory | null>(null);

  // Señales públicas
  readonly currentSession = computed(() => this._currentSession());
  readonly longTermMemory = computed(() => this._longTermMemory());

  readonly visitedPillarsInSession = computed(() =>
    this._currentSession()?.visitedPillars.map(v => v.pillarId) || []
  );

  readonly topInterests = computed(() => {
    const memory = this._longTermMemory();
    if (!memory) return [];
    return [...memory.interests]
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  });

  constructor() {
    this.loadFromStorage();
    this.initSession();
  }

  /**
   * Cargar memoria desde localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const memory = JSON.parse(stored) as LongTermMemory;
        this._longTermMemory.set(memory);
        console.log('[SendellMemory] Loaded long-term memory:', {
          totalVisits: memory.totalVisits,
          interests: memory.interests.length
        });
      }
    } catch (error) {
      console.warn('[SendellMemory] Failed to load from storage:', error);
    }
  }

  /**
   * Guardar memoria en localStorage
   */
  private saveToStorage(): void {
    const memory = this._longTermMemory();
    if (memory) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
      } catch (error) {
        console.warn('[SendellMemory] Failed to save to storage:', error);
      }
    }
  }

  /**
   * Inicializar sesión (crear nueva o resumir)
   */
  private initSession(): void {
    const sessionId = this.generateSessionId();
    const now = Date.now();

    // Crear nueva sesión
    this._currentSession.set({
      sessionId,
      startTime: now,
      visitedPillars: [],
      queryCount: 0,
      lastActivity: now
    });

    // Inicializar o actualizar memoria a largo plazo
    let memory = this._longTermMemory();
    if (!memory) {
      memory = {
        userId: this.generateUserId(),
        firstVisit: now,
        totalVisits: 1,
        totalQueries: 0,
        interests: [],
        pillarVisitCounts: {},
        lastVisit: now,
        preferredLanguage: 'es',
        hasCompletedTour: false,
        hasBookedConsultation: false
      };
    } else {
      memory = {
        ...memory,
        totalVisits: memory.totalVisits + 1,
        lastVisit: now
      };
    }

    this._longTermMemory.set(memory);
    this.saveToStorage();

    console.log('[SendellMemory] Session initialized:', sessionId);
  }

  /**
   * Registrar visita a un pilar
   */
  recordPillarVisit(pillarId: string, wasExplained: boolean = false): void {
    const session = this._currentSession();
    if (!session) return;

    const now = Date.now();

    // Actualizar sesión
    const existingVisit = session.visitedPillars.find(v => v.pillarId === pillarId);
    if (existingVisit) {
      existingVisit.timestamp = now;
      existingVisit.wasExplained = existingVisit.wasExplained || wasExplained;
    } else {
      session.visitedPillars.push({
        pillarId,
        timestamp: now,
        wasExplained
      });
    }
    session.lastActivity = now;
    this._currentSession.set({ ...session });

    // Actualizar memoria a largo plazo
    const memory = this._longTermMemory();
    if (memory) {
      memory.pillarVisitCounts[pillarId] = (memory.pillarVisitCounts[pillarId] || 0) + 1;
      this._longTermMemory.set({ ...memory });
      this.saveToStorage();
    }

    console.log(`[SendellMemory] Recorded pillar visit: ${pillarId}`);
  }

  /**
   * Registrar una query del usuario
   * Analiza intereses y actualiza contadores
   */
  recordQuery(query: string): void {
    const session = this._currentSession();
    const memory = this._longTermMemory();
    if (!session || !memory) return;

    const now = Date.now();
    const normalizedQuery = query.toLowerCase();

    // Incrementar contadores
    session.queryCount++;
    session.lastActivity = now;
    memory.totalQueries++;

    // Detectar intereses
    for (const [topic, keywords] of Object.entries(INTEREST_TOPICS)) {
      const hasKeyword = keywords.some(k => normalizedQuery.includes(k));
      if (hasKeyword) {
        this.updateInterest(topic);
      }
    }

    this._currentSession.set({ ...session });
    this._longTermMemory.set({ ...memory });
    this.saveToStorage();
  }

  /**
   * Actualizar score de interés
   */
  private updateInterest(topic: string): void {
    const memory = this._longTermMemory();
    if (!memory) return;

    const existing = memory.interests.find(i => i.topic === topic);
    if (existing) {
      existing.score = Math.min(1, existing.score + 0.1);
      existing.lastMentioned = Date.now();
    } else {
      memory.interests.push({
        topic,
        score: 0.2,
        lastMentioned: Date.now()
      });
    }

    console.log(`[SendellMemory] Interest updated: ${topic}`);
  }

  /**
   * Verificar si un pilar ya fue visitado en esta sesión
   */
  wasPillarVisited(pillarId: string): boolean {
    const session = this._currentSession();
    return session?.visitedPillars.some(v => v.pillarId === pillarId) || false;
  }

  /**
   * Verificar si un pilar ya fue explicado en esta sesión
   */
  wasPillarExplained(pillarId: string): boolean {
    const session = this._currentSession();
    return session?.visitedPillars.some(v => v.pillarId === pillarId && v.wasExplained) || false;
  }

  /**
   * Obtener pilares más visitados históricamente
   */
  getMostVisitedPillars(limit: number = 3): Array<{ pillarId: string; count: number }> {
    const memory = this._longTermMemory();
    if (!memory) return [];

    return Object.entries(memory.pillarVisitCounts)
      .map(([pillarId, count]) => ({ pillarId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Obtener contexto de memoria para incluir en prompts
   * Formato optimizado para acción rápida
   */
  getMemoryContext(): string {
    const session = this._currentSession();
    const memory = this._longTermMemory();

    const lines: string[] = ['## Contexto de Memoria'];

    // Sesión actual
    if (session && session.visitedPillars.length > 0) {
      const visited = session.visitedPillars.map(v => v.pillarId).join(', ');
      lines.push(`Pilares visitados esta sesión: ${visited}`);
    }

    // Intereses detectados
    if (memory && memory.interests.length > 0) {
      const topInterests = memory.interests
        .sort((a, b) => b.score - a.score)
        .slice(0, 2)
        .map(i => i.topic)
        .join(', ');
      lines.push(`Intereses detectados: ${topInterests}`);
    }

    // Usuario recurrente
    if (memory && memory.totalVisits > 1) {
      lines.push(`Visitante recurrente (visita #${memory.totalVisits})`);
    }

    // Tour completado
    if (memory?.hasCompletedTour) {
      lines.push('Ya completó el tour guiado.');
    }

    return lines.join('\n');
  }

  /**
   * Marcar que el tour fue completado
   */
  markTourCompleted(): void {
    const memory = this._longTermMemory();
    if (memory) {
      memory.hasCompletedTour = true;
      this._longTermMemory.set({ ...memory });
      this.saveToStorage();
    }
  }

  /**
   * Marcar que agendó consulta
   */
  markConsultationBooked(): void {
    const memory = this._longTermMemory();
    if (memory) {
      memory.hasBookedConsultation = true;
      this._longTermMemory.set({ ...memory });
      this.saveToStorage();
    }
  }

  /**
   * Verificar si es un usuario nuevo
   */
  isNewUser(): boolean {
    const memory = this._longTermMemory();
    return !memory || memory.totalVisits <= 1;
  }

  /**
   * Verificar si ya completó el tour
   */
  hasCompletedTour(): boolean {
    return this._longTermMemory()?.hasCompletedTour || false;
  }

  /**
   * Limpiar toda la memoria (para testing/debug)
   */
  clearAllMemory(): void {
    localStorage.removeItem(STORAGE_KEY);
    this._longTermMemory.set(null);
    this._currentSession.set(null);
    this.initSession();
    console.log('[SendellMemory] All memory cleared');
  }

  /**
   * Generar ID de sesión único
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Generar ID de usuario único
   */
  private generateUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Obtener estadísticas de memoria
   */
  getStats(): {
    sessionDuration: number;
    pillarsVisitedThisSession: number;
    totalVisits: number;
    totalQueries: number;
    topInterests: string[];
  } {
    const session = this._currentSession();
    const memory = this._longTermMemory();

    return {
      sessionDuration: session ? Date.now() - session.startTime : 0,
      pillarsVisitedThisSession: session?.visitedPillars.length || 0,
      totalVisits: memory?.totalVisits || 0,
      totalQueries: memory?.totalQueries || 0,
      topInterests: memory?.interests
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(i => i.topic) || []
    };
  }
}
