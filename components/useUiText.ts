"use client";

import { useCallback, useSyncExternalStore } from "react";
import { resolveUiLanguage, translate, type MessageKey, type UiLanguage } from "@/ios/i18n";

export function useUiText() {
  const language = useUiLanguage();
  return useCallback((key: MessageKey, values?: Record<string, string | number>) => translate(language, key, values), [language]);
}

export function useUiLanguage() {
  return useSyncExternalStore<UiLanguage>(
    (notify) => { window.addEventListener("storage", notify); window.addEventListener("trinque:language", notify); return () => { window.removeEventListener("storage", notify); window.removeEventListener("trinque:language", notify); }; },
    () => { const saved = window.localStorage.getItem("trinque.language"); return resolveUiLanguage(saved ? [saved] : navigator.languages); },
    () => "en-CA",
  );
}
