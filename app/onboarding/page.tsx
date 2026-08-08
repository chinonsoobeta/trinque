"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { LoadingState, PageContainer } from "@/components/AppPrimitives";
import { AvatarCropper } from "@/components/AvatarCropper";
import { useAuth } from "@/components/AuthProvider";
import { Icon } from "@/components/Icon";
import { SUPPORTED_COUNTRY_CODES } from "@/lib/regions";
import { LANGUAGE_LABEL_KEYS, translate, UI_LANGUAGES, type MessageKey, type UiLanguage } from "@/ios/i18n";
import { useUiText } from "@/components/useUiText";

type Step = "identity" | "region" | "taste" | "photo";
const STEPS: Step[] = ["identity", "region", "taste", "photo"];
const STEP_TITLES: Record<Step, MessageKey> = { identity: "onboarding.stepIdentity", region: "onboarding.stepRegion", taste: "onboarding.stepTaste", photo: "onboarding.stepPhoto" };
const STEP_HELP: Record<Step, MessageKey> = { identity: "onboarding.identityHelp", region: "onboarding.regionHelp", taste: "onboarding.tasteHelp", photo: "onboarding.photoHelp" };
/** The last two ask for things the account works without. */
const OPTIONAL: Step[] = ["taste", "photo"];

const HANDLE_PATTERN = /^[a-z0-9][a-z0-9._-]{2,29}$/;

/**
 * Setting up a profile, four short questions at a time.
 *
 * It used to be one form of six controls with a single "Finish your profile
 * first." for every way of getting it wrong — including a username someone else
 * already had, which was only discovered on submit. Each step validates what it
 * asked for, the two optional ones can be skipped outright, and the username is
 * checked while it is being typed.
 */
export default function OnboardingPage() {
  const { authenticated, authHeaders, loading } = useAuth();
  const t = useUiText();
  const [step, setStep] = useState<Step>("identity");
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [language, setLanguage] = useState<UiLanguage | "">("");
  const [cuisines, setCuisines] = useState("");
  const [avatar, setAvatar] = useState<Blob | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Partial<Record<"name" | "handle" | "country" | "language" | "photo", MessageKey>>>({});
  const [handleState, setHandleState] = useState<"idle" | "checking" | "free" | "taken">("idle");
  const [statusKey, setStatusKey] = useState<MessageKey | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!loading && !authenticated) window.location.replace("/auth/login?next=/onboarding"); }, [authenticated, loading]);
  useEffect(() => {
    if (!authenticated) return;
    void fetch("/api/onboarding", { headers: authHeaders(), cache: "no-store" })
      .then(async (response) => response.ok ? await response.json() as { complete: boolean } : null)
      .then((result) => { if (result?.complete) window.location.replace("/"); });
  }, [authHeaders, authenticated]);

  // Asked while the username is being typed rather than after the whole form is
  // submitted, which is where "that one is taken" used to arrive.
  const checkHandle = useCallback(async (value: string) => {
    if (!HANDLE_PATTERN.test(value)) { setHandleState("idle"); return; }
    setHandleState("checking");
    try {
      const response = await fetch(`/api/profiles/${encodeURIComponent(value)}`, { headers: authHeaders(), cache: "no-store" });
      setHandleState(response.status === 404 ? "free" : "taken");
    } catch { setHandleState("idle"); }
  }, [authHeaders]);

  const debounce = useRef<number | null>(null);
  function onHandleChange(value: string) {
    const next = value.toLowerCase().replace(/[^a-z0-9._-]/g, "");
    setHandle(next); setHandleState("idle");
    setErrors((current) => ({ ...current, handle: undefined }));
    if (debounce.current) window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(() => void checkHandle(next), 400);
  }

  function problemsFor(target: Step) {
    const found: typeof errors = {};
    if (target === "identity") {
      if (!name.trim()) found.name = "onboarding.nameRequired";
      if (handle.length < 3) found.handle = "onboarding.usernameRequired";
      else if (!HANDLE_PATTERN.test(handle)) found.handle = "onboarding.usernameInvalid";
      else if (handleState === "taken") found.handle = "onboarding.usernameTaken";
    }
    if (target === "region") {
      if (!countryCode) found.country = "onboarding.countryRequired";
      if (!language) found.language = "onboarding.languageRequired";
    }
    return found;
  }

  function advance() {
    const found = problemsFor(step);
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;
    const next = STEPS[STEPS.indexOf(step) + 1];
    if (next) { setStep(next); setStatusKey(null); }
  }

  function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    setErrors((current) => ({ ...current, photo: undefined }));
    setAvatar(null);
    setAvatarFile(event.target.files?.[0] ?? null);
  }

  const onCropped = useCallback((blob: Blob | null) => setAvatar(blob), []);
  const onPhotoProblem = useCallback((key: "onboarding.photoTooLarge" | "onboarding.photoUnsupported") => {
    setAvatarFile(null); setAvatar(null);
    setErrors((current) => ({ ...current, photo: key }));
  }, []);

  async function finish(event?: FormEvent) {
    event?.preventDefault();
    // Every step is re-checked at the end, so skipping forward with the browser's
    // back button cannot post a half-filled profile.
    const found = { ...problemsFor("identity"), ...problemsFor("region") };
    if (Object.values(found).some(Boolean)) {
      setErrors(found);
      setStep(found.name || found.handle ? "identity" : "region");
      return;
    }
    setBusy(true); setStatusKey(null);
    try {
      const response = await fetch("/api/onboarding", {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), countryCode, language, handle, favoriteCuisines: cuisines.split(",") }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        if (payload?.error === "username_taken") { setErrors({ handle: "onboarding.usernameTaken" }); setStep("identity"); setHandleState("taken"); return; }
        setStatusKey("onboarding.saveFailed");
        return;
      }
      if (avatar) {
        const data = new FormData();
        data.set("file", new File([avatar], "avatar.jpg", { type: "image/jpeg" }));
        const imageResponse = await fetch("/api/profile/avatar", { method: "POST", headers: authHeaders(), body: data });
        if (!imageResponse.ok) { setStatusKey("onboarding.photoFailed"); return; }
      }
      window.location.replace("/");
    } finally { setBusy(false); }
  }

  const countryNames = new Intl.DisplayNames([language || "en"], { type: "region" });
  if (loading || !authenticated) return <PageContainer className="onboarding-page"><LoadingState label={t("onboarding.loading")} /></PageContainer>;

  const index = STEPS.indexOf(step);
  const last = index === STEPS.length - 1;
  return <PageContainer className="onboarding-page">
    <header className="page-hero compact">
      <span className="kicker">{t("onboarding.step", { current: index + 1, total: STEPS.length })}</span>
      <h1>{t("onboarding.title")}</h1>
    </header>

    <ol className="onboarding-progress" aria-label={t("onboarding.title")}>
      {STEPS.map((item, position) => <li key={item} className={position < index ? "done" : position === index ? "current" : ""} aria-current={position === index ? "step" : undefined}>
        <span className="onboarding-bullet" aria-hidden="true">{position < index ? <Icon name="check" size={13} /> : position + 1}</span>
        <small>{t(STEP_TITLES[item])}</small>
      </li>)}
    </ol>

    <form className="onboarding-card" onSubmit={(event) => { event.preventDefault(); if (last) void finish(); else advance(); }}>
      <h2>{t(STEP_TITLES[step])}</h2>
      <p>{t(STEP_HELP[step])}</p>

      {step === "identity" && <>
        <label><span>{t("onboarding.name")}</span>
          <input value={name} maxLength={80} autoComplete="name"
            onChange={(event) => { setName(event.target.value); setErrors((current) => ({ ...current, name: undefined })); }}
            aria-invalid={errors.name ? true : undefined} />
          {errors.name && <small className="field-error">{t(errors.name)}</small>}
        </label>
        <label><span>{t("onboarding.username")}</span>
          <input value={handle} maxLength={30} autoComplete="username" inputMode="text"
            onChange={(event) => onHandleChange(event.target.value)}
            aria-invalid={errors.handle ? true : undefined} />
          {errors.handle ? <small className="field-error">{t(errors.handle)}</small>
            : handleState === "checking" ? <small className="field-note" role="status">{t("onboarding.usernameChecking")}</small>
            : handleState === "free" ? <small className="field-note ok" role="status">{t("onboarding.usernameFree")}</small>
            : handleState === "taken" ? <small className="field-error" role="status">{t("onboarding.usernameTaken")}</small>
            : null}
        </label>
      </>}

      {step === "region" && <>
        <label><span>{t("onboarding.country")}</span>
          <select value={countryCode} onChange={(event) => { setCountryCode(event.target.value); setErrors((current) => ({ ...current, country: undefined })); }} aria-invalid={errors.country ? true : undefined}>
            <option value="" disabled>{t("onboarding.chooseCountry")}</option>
            {SUPPORTED_COUNTRY_CODES.map((code) => <option key={code} value={code}>{countryNames.of(code) ?? code}</option>)}
          </select>
          {errors.country && <small className="field-error">{t(errors.country)}</small>}
        </label>
        <label><span>{t("onboarding.language")}</span>
          <select value={language} onChange={(event) => { setLanguage(event.target.value as UiLanguage); setErrors((current) => ({ ...current, language: undefined })); }} aria-invalid={errors.language ? true : undefined}>
            <option value="" disabled>{t("onboarding.chooseLanguage")}</option>
            {UI_LANGUAGES.map((item) => <option key={item} value={item}>{translate(language || "en-US", LANGUAGE_LABEL_KEYS[item])}</option>)}
          </select>
          {errors.language && <small className="field-error">{t(errors.language)}</small>}
        </label>
      </>}

      {step === "taste" && <label><span>{t("onboarding.cuisines")}</span>
        <input value={cuisines} onChange={(event) => setCuisines(event.target.value)} placeholder={t("onboarding.cuisineExample")} />
      </label>}

      {step === "photo" && <div className="onboarding-photo">
        <label className="file-button">
          <span>{avatarFile ? t("onboarding.changePhoto") : t("onboarding.choosePhoto")}</span>
          <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={selectPhoto} />
        </label>
        {errors.photo && <small className="field-error">{t(errors.photo)}</small>}
        {avatarFile && <AvatarCropper file={avatarFile} onCropped={onCropped} onProblem={onPhotoProblem} />}
      </div>}

      <div className="onboarding-actions">
        {index > 0 && <button type="button" className="secondary" onClick={() => setStep(STEPS[index - 1])}>{t("onboarding.back")}</button>}
        {OPTIONAL.includes(step) && <button type="button" className="text-button" onClick={() => { if (last) void finish(); else setStep(STEPS[index + 1]); }}>{t("onboarding.skip")}</button>}
        <button className="primary" disabled={busy} aria-busy={busy}>{busy ? t("onboarding.saving") : last ? t("onboarding.finish") : t("onboarding.next")}</button>
      </div>
      {statusKey && <p role="status" className="auth-status">{t(statusKey)}</p>}
    </form>
  </PageContainer>;
}
