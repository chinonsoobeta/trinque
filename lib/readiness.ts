export type CapabilityStatus = {
  status: "ready" | "degraded";
  liveAnalysis: boolean;
  persistence: boolean;
  uploads: boolean;
  demoAnalysis: true;
};

export function capabilityStatus(input: {
  openAIKey?: string;
  hasDatabase: boolean;
  hasUploads: boolean;
}): CapabilityStatus {
  const liveAnalysis = Boolean(input.openAIKey?.trim());
  const persistence = input.hasDatabase;
  const uploads = input.hasUploads;
  return {
    status: liveAnalysis && persistence && uploads ? "ready" : "degraded",
    liveAnalysis,
    persistence,
    uploads,
    demoAnalysis: true,
  };
}
