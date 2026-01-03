// src/app/core/interfaces/game-state.interfaces.ts
// Interfaces TypeScript para el estado del juego Dungeon

export type FacingDirection = 'up' | 'down' | 'left' | 'right';
export type DoorType = 'external' | 'internal' | 'modal';
export type GamePhase = 'loading' | 'igniting' | 'playing' | 'transitioning';

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface BoundingBox extends Position, Size {}

export interface Player {
  position: Position;
  facing: FacingDirection;
  isMoving: boolean;
  flameIntensity: number;  // 0 a 1, para animación de encendido
}

export interface Door {
  id: string;
  label: string;
  position: Position;
  size: Size;
  type: DoorType;
  destination: string;
  color: string;
  description?: string;
  isHighlighted: boolean;
  isInteractable: boolean;
}

export interface DoorConfig {
  id: string;
  label: string;
  position: Position;
  size: Size;
  type: DoorType;
  destination: string;
  color: string;
  description?: string;
}

export interface GameState {
  phase: GamePhase;
  player: Player;
  doors: Door[];
  activeDoorId: string | null;
  lightPosition: Position;
}

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;    // Space, W, or ArrowUp (side-scroller)
  action: boolean;  // Enter (pillar interaction)
}

// Interfaces para servicios de consultoría
export interface ConsultingService {
  id: string;
  title: string;
  shortDescription: string;
  fullDescription: string;
  features: string[];
  technologies: string[];
  color: string;
}

export interface ProcessStep {
  duration: string;
  description: string;
  deliverable: string;
}

export interface ConsultationProcess {
  discovery: ProcessStep;
  pilot: ProcessStep;
  scale: ProcessStep;
}
