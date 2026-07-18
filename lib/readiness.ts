export type CapabilityName = "openai" | "places" | "d1" | "r2";
export type CapabilityHealth = {
  status: "available" | "unavailable";
  reason: "configured" | "missing_credential" | "missing_binding";
};

export type CapabilityStatus = {
  status: "ready" | "degraded";
  capabilities: Record<CapabilityName, CapabilityHealth>;
  liveAnalysis: boolean;
  locationSearch: boolean;
  persistence: boolean;
  uploads: boolean;
  demoAnalysis: true;
};

export function capabilityStatus(input: {
  openAIKey?: string;
  googlePlacesKey?: string;
  hasDatabase: boolean;
  hasUploads: boolean;
}): CapabilityStatus {
  const liveAnalysis = Boolean(input.openAIKey?.trim());
  const locationSearch = Boolean(input.googlePlacesKey?.trim());
  const persistence = input.hasDatabase;
  const uploads = input.hasUploads;
  const capabilities: CapabilityStatus["capabilities"] = {
    openai: { status: liveAnalysis ? "available" : "unavailable", reason: liveAnalysis ? "configured" : "missing_credential" },
    places: { status: locationSearch ? "available" : "unavailable", reason: locationSearch ? "configured" : "missing_credential" },
    d1: { status: persistence ? "available" : "unavailable", reason: persistence ? "configured" : "missing_binding" },
    r2: { status: uploads ? "available" : "unavailable", reason: uploads ? "configured" : "missing_binding" },
  };
  return {
    status: liveAnalysis && locationSearch && persistence && uploads ? "ready" : "degraded",
    capabilities,
    liveAnalysis,
    locationSearch,
    persistence,
    uploads,
    demoAnalysis: true,
  };
}
