/**
 * Sendell Consultant Chat Configuration
 *
 * Environment-specific settings for connecting to the Sendell Consultant
 * WebSocket gateway. In production, override via window.__SENDELL_CONFIG__
 * or environment injection.
 */

interface ConsultantConfig {
  /** WebSocket endpoint URL */
  wsEndpoint: string;
  /** Auth token (set at runtime, never hardcode) */
  wsToken: string;
  /** Whether to auto-connect on service initialization */
  autoConnect: boolean;
  /** Enable debug logging */
  debug: boolean;
}

/** Default config - development */
const DEFAULT_CONFIG: ConsultantConfig = {
  wsEndpoint: 'ws://localhost:3004/ws',
  wsToken: '',
  autoConnect: false,
  debug: true,
};

/** Production overrides via window global (injected by deploy script) */
declare global {
  interface Window {
    __SENDELL_CONFIG__?: Partial<ConsultantConfig>;
  }
}

/** Merged configuration */
export function getConsultantConfig(): ConsultantConfig {
  const windowConfig = (typeof window !== 'undefined' && window.__SENDELL_CONFIG__) || {};
  return { ...DEFAULT_CONFIG, ...windowConfig };
}

/**
 * Production deployment: Add this script tag to index.html before the app:
 *
 * <script>
 *   window.__SENDELL_CONFIG__ = {
 *     wsEndpoint: 'wss://api.danielconsultant.dev/ws',
 *     wsToken: 'your-token-here',
 *     autoConnect: true,
 *     debug: false
 *   };
 * </script>
 */
