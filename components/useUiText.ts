"use client";

import { useCallback, useSyncExternalStore } from "react";
import { getServerSnapshot, getSnapshot, subscribe } from "@/lib/preferences-store";
import { translate, type MessageKey, type UiLanguage } from "@/ios/i18n";

export function useUiText() {
  const language = useUiLanguage();
  return useCallback((key: MessageKey, values?: Record<string, string | number>) => translate(language, key, values), [language]);
}

/**
 * Reads the same store the settings screen writes to, rather than reaching into
 * `localStorage` and waiting for a bespoke DOM event to say it had changed. Two
 * readers of one value, not two values kept roughly in step.
 */
export function useUiLanguage(): UiLanguage {
  return useSyncExternalStore(subscribe, () => getSnapshot().language, () => getServerSnapshot().language);
}
