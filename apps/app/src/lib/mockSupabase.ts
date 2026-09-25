import type { SupabaseClient } from "@supabase/supabase-js";

const FUNCTION_FIXTURES: Record<string, unknown> = {
    "intro-scan": { id: `mock-scan-${Date.now()}`, status: "pending" },
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createMockSupabaseClient(): SupabaseClient<any, any, any> {
    const mockAuthStateChangeCallbacks: Array<(event: string, session: typeof mockSession | null) => void> = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client: any = {
        auth: {
            getSession: async () => ({ data: { session: mockSession }, error: null }),
            getUser: async () => ({ data: { user: mockUser }, error: null }),
            onAuthStateChange: (callback: (event: string, session: typeof mockSession | null) => void) => {
                mockAuthStateChangeCallbacks.push(callback);
                return {
                    data: {
                        subscription: {
                            unsubscribe() {
                                const idx = mockAuthStateChangeCallbacks.indexOf(callback);
                                if (idx > -1) mockAuthStateChangeCallbacks.splice(idx, 1);
                            },
                        },
                    },
                };
            },
            signInWithOtp: async () => ({ data: {}, error: null }),
            signOut: async () => ({ error: null }),
        },
        rpc: async (name: string) => ({
            data: FUNCTION_FIXTURES[name] ?? null,
            error: null,
        }),
        functions: {
            invoke: async (name: string) => ({
                data: FUNCTION_FIXTURES[name] ?? { id: mockId(name), success: true },
                error: null,
            }),
        },
        from: () => ({
            select: function () { return this; },
            eq: function () { return this; },
            single: async () => ({ data: null, error: null }),
        }),
    };

    console.warn(
        "[dev] Disconnected mode: using a mock Supabase client. No real auth/data calls will be made.",
    );
    return client;
}
