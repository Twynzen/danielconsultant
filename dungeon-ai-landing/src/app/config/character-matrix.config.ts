/**
 * Binary Character Matrix Configuration v4.1
 * FOCUS: Advanced Animations
 * - Separate arm animation from body
 * - Directional body poses (front, left, right)
 * - Mouth animation frames
 * - Walk cycle with arm swing
 */

export interface BinaryDigit {
  char: string;              // '0', '1', ' ' (space), or special chars
  row: number;
  col: number;
  type: DigitType;
  isEmpty: boolean;          // True for spacing characters
}

export enum DigitType {
  EMPTY = 'empty',     // Rendered as invisible space (for structure)
  NORMAL = 'normal',   // Regular digit
  CORE = 'core',       // Center body - brightest
  LIMB = 'limb',       // Arms/legs - medium brightness
  EDGE = 'edge',       // Outer edges - dimmest
  EYE = 'eye',         // Eyes - white bright
  SMILE = 'smile',     // Smile
}

export type FacingDirection = 'front' | 'left' | 'right';

/**
 * Character shape v4.1 - TORSO (without arms, they're separate now)
 * Legend:
 * . = empty space (RENDERED as invisible, maintains structure)
 * 0, 1 = binary digits
 * E = eye (bright white)
 * S = smile
 */

// TORSO FRONT - Default pose, looking at viewer (v4.3 COMPACT ROBOT HEAD)
const TORSO_FRONT = `
....000000000....
....00.E.E.00....
....00..S..00....
....000000000....
.......000.......
......00000......
.....0000000.....
....000000000....
......00000......
......00000......
......00000......
......00000......
.......000.......
`;

// TORSO RIGHT - Looking/walking to the right (v4.3 COMPACT ROBOT HEAD)
const TORSO_RIGHT = `
....000000000....
....00..E.E.0....
....00...S.00....
....000000000....
.......000.......
......00000......
.....0000000.....
....000000000....
......00000......
......00000......
......00000......
......00000......
.......000.......
`;

// TORSO LEFT - Looking/walking to the left (v4.3 COMPACT ROBOT HEAD)
const TORSO_LEFT = `
....000000000....
....0.E.E..00....
....00.S...00....
....000000000....
.......000.......
......00000......
.....0000000.....
....000000000....
......00000......
......00000......
......00000......
......00000......
.......000.......
`;

// ============================================
// ARM FRAMES - Animated separately, overlaid on torso
// ============================================

// Arms at rest (neutral stance) - v4.3 adjusted for 13-row torso
const ARMS_NEUTRAL = `
.................
.................
.................
.................
.................
.................
.................
.................
...00.......00...
..00.........00..
..0...........0..
.................
.................
`;

// Arms - Right arm forward, Left arm back - v4.3 adjusted
const ARMS_RIGHT_FORWARD = `
.................
.................
.................
.................
.................
.................
.................
.................
....0.......00...
...00........00..
...0..........0..
.................
.................
`;

// Arms - Left arm forward, Right arm back - v4.3 adjusted
const ARMS_LEFT_FORWARD = `
.................
.................
.................
.................
.................
.................
.................
.................
...00.......0....
..00........00...
..0..........0...
.................
.................
`;

// Legs - NEUTRAL stance (standing)
const LEGS_NEUTRAL = `
......0...0......
.....00...00.....
.....0.....0.....
.....0.....0.....
....00.....00....
`;

// Legs - Frame 1 (left forward, right back)
const LEGS_FRAME_1 = `
....0.......0....
...00.......00...
...0.........0...
..00.........00..
..0...........0..
`;

// Legs - Frame 2 (right forward, left back)
const LEGS_FRAME_2 = `
.......0...0.....
......00...00....
.......0...0.....
.......00.00.....
........0.0......
`;

/**
 * Parse a shape string into BinaryDigit array
 * IMPORTANT: Empty spaces (.) are KEPT and rendered as invisible spans
 */
export function parseShape(shape: string): BinaryDigit[][] {
  const lines = shape.trim().split('\n');
  const matrix: BinaryDigit[][] = [];

  // Find center for brightness calculation
  const totalRows = lines.length;
  const maxCols = Math.max(...lines.map(l => l.length));
  const centerRow = totalRows / 2;
  const centerCol = maxCols / 2;

  lines.forEach((line, rowIndex) => {
    const row: BinaryDigit[] = [];

    // Pad line to max width for consistent spacing
    const paddedLine = line.padEnd(maxCols, '.');

    paddedLine.split('').forEach((char, colIndex) => {
      const isEmpty = char === '.';
      let type = DigitType.NORMAL;
      let displayChar = char;

      if (isEmpty) {
        type = DigitType.EMPTY;
        displayChar = ' ';
      } else if (char === 'E') {
        type = DigitType.EYE;
        displayChar = '0';
      } else if (char === 'S') {
        type = DigitType.SMILE;
        displayChar = '_';
      } else {
        // Calculate type based on distance from center
        const distFromCenter = Math.sqrt(
          Math.pow(rowIndex - centerRow, 2) +
          Math.pow(colIndex - centerCol, 2)
        );
        const maxDist = Math.sqrt(Math.pow(totalRows, 2) + Math.pow(maxCols / 2, 2));
        const normalizedDist = distFromCenter / maxDist;

        if (normalizedDist < 0.3) {
          type = DigitType.CORE;
        } else if (normalizedDist < 0.6) {
          type = DigitType.LIMB;
        } else {
          type = DigitType.EDGE;
        }
      }

      row.push({
        char: displayChar,
        row: rowIndex,
        col: colIndex,
        type,
        isEmpty
      });
    });

    matrix.push(row);
  });

  return matrix;
}

/**
 * Get the torso grid based on facing direction
 */
export function getTorsoGrid(facing: FacingDirection = 'front'): BinaryDigit[][] {
  switch (facing) {
    case 'left': return parseShape(TORSO_LEFT);
    case 'right': return parseShape(TORSO_RIGHT);
    default: return parseShape(TORSO_FRONT);
  }
}

/**
 * Get the body grid (without legs) - backward compatible
 */
export function getBodyGrid(facing: FacingDirection = 'front'): BinaryDigit[][] {
  return getTorsoGrid(facing);
}

/**
 * Get arm frames for walking animation (synced opposite to legs)
 */
export function getArmFrames(): BinaryDigit[][][] {
  return [
    parseShape(ARMS_NEUTRAL),        // Frame 0: Standing - arms neutral
    parseShape(ARMS_RIGHT_FORWARD),  // Frame 1: Left leg forward -> RIGHT arm forward
    parseShape(ARMS_NEUTRAL),        // Frame 2: Standing (transition)
    parseShape(ARMS_LEFT_FORWARD),   // Frame 3: Right leg forward -> LEFT arm forward
  ];
}

/**
 * Get leg frames for walking animation
 */
export function getLegFrames(): BinaryDigit[][][] {
  return [
    parseShape(LEGS_NEUTRAL),   // Frame 0: Standing
    parseShape(LEGS_FRAME_1),   // Frame 1: Left forward
    parseShape(LEGS_NEUTRAL),   // Frame 2: Standing (transition)
    parseShape(LEGS_FRAME_2),   // Frame 3: Right forward
  ];
}

/**
 * Character configuration
 */
export const CHARACTER_CONFIG = {
  // Dimensions
  WIDTH: 180,
  HEIGHT: 220,
  FONT_SIZE: 11,
  LINE_HEIGHT: 1.0,
  CHAR_WIDTH: 10,  // Width of each character cell

  // Animation timing
  BLINK_INTERVAL_MIN: 3000,
  BLINK_INTERVAL_MAX: 6000,
  BLINK_DURATION: 120,
  WALK_FRAME_DURATION: 150,  // Faster walk

  // Brightness levels
  BRIGHTNESS: {
    CORE: 1.0,
    LIMB: 0.6,
    EDGE: 0.35,
    EYE: 1.0,
    SMILE: 0.9,
  },

  // Colors
  DIGIT_COLOR: '#00ff44',
  EYE_COLOR: '#ffffff',
};

/**
 * v5.0 - ASSEMBLY ANIMATION CONFIG
 * Spring physics parameters for digital materialization effect
 */
export const ASSEMBLY_CONFIG = {
  // Spawn Assembly
  SPAWN_DURATION: 2000,        // ms total para ensamblaje
  SPAWN_STAGGER_MAX: 500,      // ms máximo delay entre partículas
  SPAWN_STIFFNESS: 0.08,       // Fuerza del spring
  SPAWN_DAMPING: 0.88,         // Fricción
  SPAWN_SPREAD: 1.5,           // Multiplicador de dispersión inicial (x viewport)

  // Landing Disassemble
  LANDING_SCATTER_DURATION: 150,   // ms de dispersión
  LANDING_REASSEMBLE_DURATION: 250, // ms de reagrupación
  LANDING_MAX_SCATTER: 40,          // px máximo de dispersión
  LANDING_SPRING_DAMPING: 0.72,     // Damping ratio para bounce

  // Type-based mass (affects scatter distance)
  TYPE_MASS: {
    core: 1.0,
    limb: 0.85,
    edge: 0.7,
    eye: 0.6,
    smile: 0.8,
    empty: 0,
    normal: 0.75,
  } as Record<string, number>,

  // v5.0: Crash animation (high fall)
  CRASH_SCATTER_MAGNITUDE: 120,     // Much larger scatter than landing
  CRASH_SCATTER_DURATION: 300,      // Longer scatter phase
  CRASH_DISASSEMBLED_DURATION: 1500, // Stay disassembled for 1.5 seconds
  CRASH_REASSEMBLE_DURATION: 800,   // Slower reassembly
  CRASH_MIN_FALL_HEIGHT: 200,       // Minimum fall height to trigger crash
};
