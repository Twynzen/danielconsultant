/**
 * Onboarding Configuration - Sendell Welcome System
 * v1.0: First visitor experience with progressive illumination
 */

export interface DialogMessage {
  id: string;
  text: string;
  requiresInput?: boolean;
  inputType: 'continue' | 'choice';
  validInputs?: string[];
  triggerWord?: string;  // Word that triggers illumination callback
}

/**
 * Phase 1: Pre-Spawn Dialogs (centered, no robot visible)
 */
export const PRE_SPAWN_DIALOGS: DialogMessage[] = [
  {
    id: 'greeting',
    text: '¡Hola! Veo que hay alguien nuevo por aquí.',
    inputType: 'continue'
  },
  {
    id: 'lights',
    text: 'Déjame encender las luces...',
    inputType: 'continue'
  }
];

/**
 * Phase 3: Presentation Dialogs (robot visible, attached dialog)
 */
export const PRESENTATION_DIALOGS: DialogMessage[] = [
  {
    id: 'welcome',
    text: '¡Bienvenidos al hábitat!',
    inputType: 'continue'
  },
  {
    id: 'intro-daniel',
    text: 'Esta es la web de Daniel Castiblanco.',
    inputType: 'continue',
    triggerWord: 'Daniel'  // Triggers title illumination
  },
  {
    id: 'intro-sendell',
    text: 'Yo soy Sendell, su asistente.',
    inputType: 'continue'
  }
];

/**
 * Phase 4: Choice Dialog (Y/N input)
 */
export const CHOICE_DIALOG: DialogMessage = {
  id: 'choice',
  text: '¿Deseas que te guíe en este lugar o prefieres explorarlo tú mismo?',
  requiresInput: true,
  inputType: 'choice',
  validInputs: ['Y', 'N', 'S', 'SI', 'NO', 'YES']
};

/**
 * Phase 5A: Tour Mode Dialogs (placeholder until AI integration)
 */
export const TOUR_MODE_DIALOGS: DialogMessage[] = [
  {
    id: 'tour-great',
    text: '¡Excelente elección!',
    inputType: 'continue'
  },
  {
    id: 'tour-wip',
    text: 'El tour guiado está en desarrollo. Por ahora, explora libremente.',
    inputType: 'continue'
  },
  {
    id: 'controls',
    text: 'Puedes controlarme con A ← y D →. ESPACIO para saltar.',
    inputType: 'continue'
  },
  {
    id: 'interact',
    text: 'Acércate a los pilares y presiona ENTER para descubrir más.',
    inputType: 'continue'
  }
];

/**
 * Phase 5B: Free Mode Dialogs
 */
export const FREE_MODE_DIALOGS: DialogMessage[] = [
  {
    id: 'perfect',
    text: '¡Perfecto!',
    inputType: 'continue'
  },
  {
    id: 'controls',
    text: 'Puedes controlarme con A ← y D →. ESPACIO para saltar.',
    inputType: 'continue'
  },
  {
    id: 'interact',
    text: 'Acércate a los pilares y presiona ENTER para descubrir más.',
    inputType: 'continue'
  }
];

/**
 * Return Visitor Dialog (short welcome)
 */
export const RETURN_VISITOR_DIALOG: DialogMessage = {
  id: 'welcome-back',
  text: '¡Hola de nuevo! Bienvenido al hábitat.',
  inputType: 'continue'
};

/**
 * Timing configuration
 */
export const ONBOARDING_TIMING = {
  INITIAL_DARKNESS_MS: 500,
  GROUND_FADE_DURATION_MS: 1500,
  TITLE_FADE_DURATION_MS: 1000,
  PILLARS_FADE_DURATION_MS: 2000,
  TYPING_SPEED_MS: 35,  // Per character
  POST_ASSEMBLY_DELAY_MS: 800
};

/**
 * LocalStorage key for persistence
 */
export const ONBOARDING_STORAGE_KEY = 'sendell_onboarding_complete';
