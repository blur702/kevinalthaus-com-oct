/**
 * Central configuration loader.
 *
 * Non-secret, environment-specific defaults live in the config/*.js files.
 * Secrets (passwords, API keys, tokens) must stay in .env files and are accessed
 * through the getSecret helper so that they are never written to source control.
 */

// Re-export AppConfig from shared types (single source of truth)
export type { AppConfig } from '../packages/shared/src/types/appConfig';
type RuntimeConfig = AppConfig & {
    getSecret: typeof getSecret;
};
export declare function getSecret(key: string, required?: boolean): string | undefined;
export declare const config: RuntimeConfig;
export default config;
//# sourceMappingURL=index.d.ts.map