/**
 * Cost Tracking & Rate Limiting Middleware
 * Handles cost tracking, rate limiting, and burst protection
 */

/**
 * Cost configuration
 */
export const COST_CONFIG = {
  PHASE1: {
    BASE_COST: 0.0025,
    PER_BROKER: 0.000625,
    PER_BROKER_COUNT: 4,
  },
  PHASE2: {
    BASE_COST: 0.007,
    EMAIL_EXTRACTION: 0.0005,
    HOLEHE: 0.001,
    LEAKCHECK: 0.002,
  },
  RATE_LIMITS: {
    DAILY_MAX_USD: 10.0,
    BURST_MAX_SEARCHES: 5,
    BURST_WINDOW_SECONDS: 60,
    LOOKBACK_DAYS: 30,
  },
};

/**
 * Cost tracking result
 */
export interface CostTrackingResult {
  success: boolean;
  cost_usd: number;
  phase: number;
  estimated?: boolean;
  error?: string;
}

/**
 * Rate limit check result
 */
export interface RateLimitCheckResult {
  allowed: boolean;
  reason?: string;
  usage?: {
    daily_spent_usd: number;
    daily_limit_usd: number;
    searches_last_hour: number;
    burst_limit: number;
  };
}

/**
 * Track a search cost in the database
 * @param supabaseClient Supabase client
 * @param userId User ID (optional for anonymous)
 * @param sessionId Session ID (required)
 * @param phase Phase number (1 or 2)
 * @param quickScanId Reference to quick_scans
 * @param costUsd Cost in USD
 * @param metadata Additional tracking data
 * @returns Tracking result
 */
export async function trackCost(
  supabaseClient: any,
  userId: string | null,
  sessionId: string,
  phase: number,
  quickScanId: string | null,
  costUsd: number,
  metadata: Record<string, unknown> = {}
): Promise<CostTrackingResult> {
  try {
    console.log(`💰 Tracking cost: $${costUsd.toFixed(4)} for Phase ${phase}`);

    const { error } = await supabaseClient
      .from("quickscan_cost_tracking")
      .insert({
        user_id: userId,
        session_id: sessionId,
        quick_scan_id: quickScanId,
        phase: phase,
        phase1_cost_usd: phase === 1 ? costUsd : 0,
        phase2_cost_usd: phase === 2 ? costUsd : 0,
        total_cost_usd: costUsd,
        status: "success",
        ...metadata,
      });

    if (error) {
      console.error(`Error tracking cost: ${error.message}`);
      return {
        success: false,
        cost_usd: costUsd,
        phase: phase,
        error: error.message,
      };
    }

    // Update user's aggregate cost (if authenticated)
    if (userId) {
      await updateUserCostAggregate(supabaseClient, userId, costUsd);
    }

    return {
      success: true,
      cost_usd: costUsd,
      phase: phase,
    };
  } catch (error) {
    console.error(`Cost tracking error: ${(error as Error).message}`);
    return {
      success: false,
      cost_usd: costUsd,
      phase: phase,
      error: (error as Error).message,
    };
  }
}

/**
 * Update user's aggregate cost in user_profiles
 * @param supabaseClient Supabase client
 * @param userId User ID
 * @param costUsd Cost to add
 */
async function updateUserCostAggregate(supabaseClient: any, userId: string, costUsd: number): Promise<void> {
  try {
    const { error } = await supabaseClient.rpc("add_quickscan_cost", {
      p_user_id: userId,
      p_cost_usd: costUsd,
    });

    if (error) {
      console.warn(`Error updating user cost aggregate: ${error.message}`);
    }
  } catch (error) {
    console.warn(`Error in updateUserCostAggregate: ${(error as Error).message}`);
  }
}

/**
 * Estimate cost before running a search
 * @param phase Phase number (1 or 2)
 * @param options Additional options
 * @returns Estimated cost in USD
 */
export function estimateCost(
  phase: number,
  options: { brokerCount?: number; includeLeakcheck?: boolean } = {}
): number {
  const { brokerCount = 4, includeLeakcheck = true } = options;

  if (phase === 1) {
    // Phase 1 cost: base + per broker
    return COST_CONFIG.PHASE1.BASE_COST + brokerCount * COST_CONFIG.PHASE1.PER_BROKER;
  } else if (phase === 2) {
    // Phase 2 cost: base + enrichment components
    let cost = COST_CONFIG.PHASE2.BASE_COST;
    cost += COST_CONFIG.PHASE2.EMAIL_EXTRACTION;
    cost += COST_CONFIG.PHASE2.HOLEHE;
    if (includeLeakcheck) {
      cost += COST_CONFIG.PHASE2.LEAKCHECK;
    }
    return cost;
  }

  return 0;
}

/**
 * Check rate limits for a user
 * @param supabaseClient Supabase client
 * @param userId User ID (nullable for anonymous)
 * @param sessionId Session ID
 * @returns Rate limit check result
 */
export async function checkRateLimit(
  supabaseClient: any,
  userId: string | null,
  sessionId: string
): Promise<RateLimitCheckResult> {
  try {
    if (!userId) {
      // No rate limiting for anonymous users (tracked by session)
      return {
        allowed: true,
      };
    }

    // Get user's costs from the last 24 hours
    const { data, error } = await supabaseClient.rpc("get_user_quickscan_costs", {
      p_user_id: userId,
      p_lookback_days: 1,
    });

    if (error) {
      console.warn(`Error checking rate limits: ${error.message}`);
      // If we can't check, allow the request but log it
      return {
        allowed: true,
      };
    }

    if (!data || data.length === 0) {
      return {
        allowed: true,
      };
    }

    const [costData] = data;
    const dailySpent = parseFloat(costData.total_cost_usd) || 0;
    const dailyLimit = COST_CONFIG.RATE_LIMITS.DAILY_MAX_USD;

    if (dailySpent >= dailyLimit) {
      console.warn(`Rate limit exceeded for user ${userId}: $${dailySpent}/$${dailyLimit}`);
      return {
        allowed: false,
        reason: `Daily rate limit exceeded ($${dailyLimit}/day)`,
        usage: {
          daily_spent_usd: dailySpent,
          daily_limit_usd: dailyLimit,
          searches_last_hour: 0,
          burst_limit: COST_CONFIG.RATE_LIMITS.BURST_MAX_SEARCHES,
        },
      };
    }

    // Check if user is approaching limit (warn at 80%)
    if (dailySpent > dailyLimit * 0.8) {
      console.warn(`User ${userId} is approaching daily rate limit: $${dailySpent}/$${dailyLimit}`);
    }

    return {
      allowed: true,
      usage: {
        daily_spent_usd: dailySpent,
        daily_limit_usd: dailyLimit,
        searches_last_hour: 0,
        burst_limit: COST_CONFIG.RATE_LIMITS.BURST_MAX_SEARCHES,
      },
    };
  } catch (error) {
    console.error(`Rate limit check error: ${(error as Error).message}`);
    // On error, allow but log for investigation
    return {
      allowed: true,
    };
  }
}

/**
 * Check for burst protection (max searches per time window)
 * @param supabaseClient Supabase client
 * @param sessionId Session ID
 * @returns Burst check result
 */
export async function checkBurstProtection(supabaseClient: any, sessionId: string): Promise<RateLimitCheckResult> {
  try {
    // Get Phase 1 searches in the last BURST_WINDOW_SECONDS
    const windowSeconds = COST_CONFIG.RATE_LIMITS.BURST_WINDOW_SECONDS;
    const cutoffTime = new Date(Date.now() - windowSeconds * 1000).toISOString();

    const { data, error } = await supabaseClient
      .from("quickscan_cost_tracking")
      .select("id")
      .eq("session_id", sessionId)
      .eq("phase", 1)
      .gt("created_at", cutoffTime);

    if (error) {
      console.warn(`Error checking burst protection: ${error.message}`);
      return { allowed: true };
    }

    const searchCount = data?.length || 0;
    const burstLimit = COST_CONFIG.RATE_LIMITS.BURST_MAX_SEARCHES;

    if (searchCount >= burstLimit) {
      console.warn(`Burst limit exceeded for session ${sessionId}: ${searchCount}/${burstLimit}`);
      return {
        allowed: false,
        reason: `Too many searches in short time (${burstLimit} per ${windowSeconds}s)`,
        usage: {
          daily_spent_usd: 0,
          daily_limit_usd: COST_CONFIG.RATE_LIMITS.DAILY_MAX_USD,
          searches_last_hour: searchCount,
          burst_limit: burstLimit,
        },
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error(`Burst protection check error: ${(error as Error).message}`);
    return { allowed: true };
  }
}

/**
 * Create cost estimate response
 * @param phase Phase number
 * @param options Additional options
 * @returns Cost estimate with explanation
 */
export function createCostEstimate(phase: number, options: Record<string, unknown> = {}) {
  const costUsd = estimateCost(phase);

  return {
    phase: phase,
    estimated_cost_usd: costUsd,
    components: phase === 1 ? {
      base: COST_CONFIG.PHASE1.BASE_COST,
      per_broker: COST_CONFIG.PHASE1.PER_BROKER,
      broker_count: 4,
    } : {
      base: COST_CONFIG.PHASE2.BASE_COST,
      email_extraction: COST_CONFIG.PHASE2.EMAIL_EXTRACTION,
      holehe: COST_CONFIG.PHASE2.HOLEHE,
      leakcheck: COST_CONFIG.PHASE2.LEAKCHECK,
    },
    note: "Estimates are based on typical usage. Actual costs may vary.",
  };
}

/**
 * Format cost for display
 * @param costUsd Cost in USD
 * @returns Formatted string
 */
export function formatCost(costUsd: number): string {
  return `$${costUsd.toFixed(4)}`;
}

/**
 * Get user cost summary
 * @param supabaseClient Supabase client
 * @param userId User ID
 * @param days Lookback days (default: 30)
 * @returns Cost summary
 */
export async function getUserCostSummary(
  supabaseClient: any,
  userId: string,
  days: number = 30
): Promise<Record<string, unknown> | null> {
  try {
    const { data, error } = await supabaseClient.rpc("get_user_quickscan_costs", {
      p_user_id: userId,
      p_lookback_days: days,
    });

    if (error) {
      console.error(`Error getting cost summary: ${error.message}`);
      return null;
    }

    if (!data || data.length === 0) {
      return {
        total_cost_usd: 0,
        phase1_cost_usd: 0,
        phase2_cost_usd: 0,
        phase1_count: 0,
        phase2_count: 0,
        lookback_days: days,
      };
    }

    return data[0];
  } catch (error) {
    console.error(`Error in getUserCostSummary: ${(error as Error).message}`);
    return null;
  }
}
