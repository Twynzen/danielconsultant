/**
 * Binary Character Matrix Configuration v3.0
 * FOCUS: Clarity and Separation
 * - Clear humanoid silhouette
 * - VISIBLE gap between legs
 * - Arms separated from torso
 * - Walk animation with REAL movement
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

/**
 * Character shape v3.0 - CLEAR SEPARATION
 * Legend:
 * . = empty space (RENDERED as invisible, maintains structure)
 * 0, 1 = binary digits
 * E = eye (bright white)
 * S = smile
 * C = core (brightest)
 * L = limb (medium)
 * X = edge (dimmest)
 */
const CHARACTER_BODY = `
.......000.......
.....0000000.....
....00.E.E.00....
....000.S.000....
......00000......
.......000.......
......00000......
.....0000000.....
....000000000....
...00.00000.00...
..00..00000..00..
..0...00000...0..
......00000......
.......000.......
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
 * Get the body grid (without legs)
 */
export function getBodyGrid(): BinaryDigit[][] {
  return parseShape(CHARACTER_BODY);
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
