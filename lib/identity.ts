import {
  AuthenticationError,
  getOptionalIdentity,
  getOrCreateLegacyIdentity,
  requireAuthenticatedIdentity,
  type TrinqueIdentity,
} from "@/lib/auth";
import { requiresAuthenticatedLegacyMutation } from "@/lib/auth-policy";

export type { TrinqueIdentity } from "@/lib/auth";

/**
 * Compatibility bridge for pre-social routes.
 * Public GET/HEAD/OPTIONS handlers keep guest-capable identity resolution, while
 * legacy dish/group mutations are upgraded to durable authenticated accounts.
 * New routes should import getOptionalIdentity/requireAuthenticatedIdentity
 * directly from lib/auth instead of relying on this shim.
 */
export async function requireIdentity(request: Request): Promise<TrinqueIdentity | null> {
  if (requiresAuthenticatedLegacyMutation(request)) {
    try {
      return await requireAuthenticatedIdentity(request);
    } catch (error) {
      if (error instanceof AuthenticationError) return null;
      throw error;
    }
  }
  return getOptionalIdentity(request);
}

/** @deprecated Only the legacy /api/session compatibility route should create guests. */
export async function getOrCreateIdentity(request: Request) {
  // Some older mutation handlers use this helper instead of requireIdentity().
  // Never let those paths mint a guest identity: force durable authentication.
  if (requiresAuthenticatedLegacyMutation(request)) {
    return { identity: await requireAuthenticatedIdentity(request) };
  }
  return getOrCreateLegacyIdentity(request);
}
