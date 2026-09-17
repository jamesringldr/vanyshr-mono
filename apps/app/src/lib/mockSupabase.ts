import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Dummy data returned per edge function name in Disconnected mode. Add an entry
 * here when a specific page needs a more realistic shape than the generic
 * `{ id, success: true }` fallback below.
 */
const FUNCTION_FIXTURES: Record<string, unknown> = {
    "intro-scan": { id: `mock-scan-${Date.now()}` },
};

function mockId(prefix: string): string {
    return `mock-${prefix}-${Date.now()}`;
}

const mockUser = {
    id: "mock-user-id",
    email: "dev@vanyshr.local",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
};

const mockSession = {
    access_token: "mock-access-token",
    refresh_token: "mock-refresh-token",
    expires_in: 3600,
    token_type: "bearer",
    user: mockUser,
};

/**
 * Minimal stand-in for the Supabase client used only in Disconnected dev mode
 * (see isDisconnectedMode() in ./env). Implements just the surface this app
 * actually calls — auth, rpc, functions.invoke — with generic dummy responses
 * so pages render instead of erroring against a real backend. Never real
 * network calls, and dead-code-eliminated from every built bundle since it's
 * only reachable when import.meta.env.DEV is true.
 */
export function createMockSupabaseClient(): SupabaseClient {
    const client = {
        auth: {
            async getSession() {
                return { data: { session: mockSession }, error: null };
            },
            async getUser() {
                return { data: { user: mockUser }, error: null };
            },
            onAuthStateChange(_callback: unknown) {
                return { data: { subscription: { unsubscribe() {} } } };
            },
            async signInWithOtp() {
                return { data: {}, error: null };
            },
            async signOut() {
                return { error: null };
            },
        },
        async rpc(name: string) {
            return { data: FUNCTION_FIXTURES[name] ?? null, error: null };
        },
        functions: {
            async invoke(name: string) {
                return {
                    data: FUNCTION_FIXTURES[name] ?? { id: mockId(name), success: true },
                    error: null,
                };
            },
        },
        from() {
            const builder: Record<string, unknown> = {
                select: () => builder,
                insert: () => builder,
                update: () => builder,
                upsert: () => builder,
                delete: () => builder,
                eq: () => builder,
                order: () => builder,
                limit: () => builder,
                single: async () => ({ data: null, error: null }),
                maybeSingle: async () => ({ data: null, error: null }),
                then: (resolve: (v: { data: unknown[]; error: null }) => void) =>
                    resolve({ data: [], error: null }),
            };
            return builder;
        },
    };

    // eslint-disable-next-line no-console
    console.warn(
        "[dev] Disconnected mode: using a mock Supabase client. No real auth/data calls will be made.",
    );

    return client as unknown as SupabaseClient;
}
