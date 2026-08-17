/**
 * dsh-freebuff — register the `freebuff` provider route on ctx.llm.
 *
 * The provider reverse-proxies the freebuff (CodebuffAI) free client protocol
 * (session → agent-runs → chat/completions on codebuff.com) into the harness
 * LLM seam, exposing free DeepSeek V4 Flash (and friends) as selectable
 * models. Credentials are picked up from plugin settings, the FREEBUFF_TOKEN
 * env var, or the official freebuff CLI credential file.
 */
import { installSettingsSection } from '@deepseek-ai/dsh-settings';
import { getOrCreateAnonymousUserId } from '@deepseek-ai/dsh-anonymous-user-id';
import { FreebuffAdapter } from './adapter.js';
import { FreebuffClient } from './freebuff.js';
import { Config, NS, resolveAdapterOptions } from './config.js';
export const name = 'llm-freebuff';
export const inject = ['llm'];
export { Config, NS };
export { FreebuffAdapter } from './adapter.js';
export { FreebuffClient, stableFingerprint } from './freebuff.js';
/** The single provider route this plugin owns. */
export const PROVIDER = 'freebuff';
export function apply(ctx, config) {
    let current = () => config;
    let lastRaw;
    let lastGood;
    const options = () => {
        const raw = current();
        if (raw === lastRaw && lastGood !== undefined)
            return lastGood;
        try {
            const next = resolveAdapterOptions(raw);
            lastRaw = raw;
            lastGood = next;
            return next;
        }
        catch (error) {
            if (lastGood === undefined)
                throw error;
            lastRaw = raw;
            ctx.logger.error('llm-freebuff: keeping the last good configuration after an invalid settings section');
            ctx.logger.error(error);
            return lastGood;
        }
    };
    options();
    const client = new FreebuffClient({
        baseURL: () => options().baseURL,
        proxyUrl: () => (options().upstreamProxy.length > 0 ? options().upstreamProxy : undefined),
        logger: ctx.logger,
    });
    let userId;
    const resolveUserId = () => (userId ??= getOrCreateAnonymousUserId());
    const adapter = new FreebuffAdapter({ options, client, userId: resolveUserId });
    ctx.llm.registerConfigurableProviders([
        { provider: PROVIDER, displayName: 'Freebuff', settingsNs: NS, settingsPath: [] },
    ]);
    const registration = ctx.llm.registerAdapter([PROVIDER], adapter);
    installSettingsSection(ctx, NS, Config, config, {
        setSource: (source) => {
            current = source;
        },
        onChange: () => {
            registration.replace([PROVIDER]);
        },
    });
}
