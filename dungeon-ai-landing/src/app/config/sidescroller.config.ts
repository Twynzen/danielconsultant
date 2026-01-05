/**
 * Side-Scroller Configuration - AI Habitat
 * Mario-style horizontal level with physics
 */

export const SIDESCROLLER_CONFIG = {
  // Level dimensions
  LEVEL_WIDTH: 6600,                              // v4.8.1: Extended to accommodate shifted pillars
  LEVEL_HEIGHT: () => window.innerHeight,         // Screen height (no vertical scroll)

  // Ground configuration
  GROUND_Y: () => window.innerHeight - 60,        // Ground surface position (v4.8.2: 120→60)
  GROUND_HEIGHT: 60,                              // Ground visual height (v4.8.2: halved)

  // Physics constants
  GRAVITY: 1800,                                  // px/s² - downward acceleration
  JUMP_VELOCITY: -650,                            // Initial jump velocity (negative = up)
  MAX_FALL_SPEED: 1200,                           // Terminal velocity
  MOVE_SPEED: 300,                                // Horizontal movement speed px/s

  // Camera configuration
  CAMERA_LOOK_AHEAD: 150,                         // Pixels ahead based on direction
  CAMERA_LERP: 0.08,                              // Smooth follow factor
  CAMERA_DEADZONE: 2,                             // Pixels before camera reacts

  // Pillar configuration for horizontal layout
  PILLAR_SPACING: 700,                            // Approximate spacing between pillars
  PILLAR_Y_OFFSET: 80,                            // Height above ground for pillar base

  // Interaction radii
  PILLAR_HIGHLIGHT_RADIUS: 200,                   // Distance to illuminate pillar
  PILLAR_HOLOGRAM_RADIUS: 100,                    // v5.1: Reduced from 150 - hologram only when very close
  PILLAR_INTERACT_RADIUS: 100,                    // Distance to activate with Enter

  // Circuit system
  CIRCUIT_LIGHT_RADIUS: 300,                      // Distance to light up circuits
  CIRCUIT_TIMEOUT_MIN: 3000,                      // Min ms before circuit fades
  CIRCUIT_TIMEOUT_MAX: 5000,                      // Max ms before circuit fades
  CIRCUIT_FADE_DURATION: 1000,                    // Fade out duration ms

  // World wrap (circular level)
  WRAP_MARGIN: 100,                               // Teleport margin at edges

  // Helper methods
  getGroundY: () => window.innerHeight - 60,      // v4.8.2: 120→60
  getLevelHeight: () => window.innerHeight,
};

/**
 * Pillar positions distributed horizontally across the level
 * v5.1: 8 pillars - removed FinOps AI & Process Automation, added MultiDesktopFlow
 * NOTE: Actual positions are defined in pillar.config.ts PILLARS array
 */
export const SIDESCROLLER_PILLAR_POSITIONS = [
  { x: 1000, service: 'about-daniel' },
  { x: 1600, service: 'local-llms' },
  { x: 2200, service: 'rag-systems' },
  { x: 2800, service: 'agent-orchestration' },
  { x: 3400, service: 'custom-integrations' },
  { x: 4000, service: 'calendly' },
  { x: 4600, service: 'nuvaris' },
  { x: 5200, service: 'multidesktopflow' },
];

/**
 * Get pillar Y position (bottom of pillar at ground level)
 * With translate(-50%, -100%), worldY is where the pillar bottom sits
 */
export function getPillarY(): number {
  return SIDESCROLLER_CONFIG.getGroundY();
}
