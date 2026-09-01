"use client";

import { useState } from "react";

/**
 * Display name only — no email, phone, password, or verification (FR-23, AC 2).
 *
 * Validation fires on submit, never on first render, per the UX spec's form rules.
 */
export function OnboardingForm({
  inviterName,
  isPending,
  onSubmit,
}: {
  inviterName: string;
  isPending: boolean;
  onSubmit: (displayName: string) => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [attempted, setAttempted] = useState(false);

  const trimmed = displayName.trim();
  const isEmpty = trimmed.length === 0;
  const showError = attempted && isEmpty;

  return (
    <main className="flex min-h-screen flex-col justify-center px-7">
      <p className="text-[10px] font-normal uppercase tracking-[0.14em] text-text-secondary">
        You&rsquo;ve been invited
      </p>

      <h1 className="mt-2 text-[28px] font-bold leading-[1.18] tracking-tight text-text-primary">
        {inviterName} wants to surf with you.
      </h1>

      <form
        className="mt-8"
        onSubmit={(event) => {
          event.preventDefault();
          setAttempted(true);
          if (isEmpty || isPending) return;
          onSubmit(trimmed);
        }}
      >
        <label
          htmlFor="displayName"
          className="text-[10px] font-normal uppercase tracking-[0.14em] text-text-secondary"
        >
          What should we call you?
        </label>

        <input
          id="displayName"
          name="displayName"
          type="text"
          autoFocus
          autoComplete="nickname"
          enterKeyHint="go"
          maxLength={50}
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          aria-invalid={showError}
          aria-describedby={showError ? "displayName-error" : undefined}
          className="mt-2 min-h-[48px] w-full rounded-lg border border-divider bg-surface px-4 text-[16px] font-bold text-text-primary outline-none focus-visible:border-action focus-visible:ring-3 focus-visible:ring-action/20"
        />

        {showError && (
          <p
            id="displayName-error"
            className="mt-2 text-[13px] text-destructive"
          >
            Enter a name so your crew knows who you are.
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="mt-6 min-h-[48px] w-full rounded-lg bg-action px-4 text-[16px] font-bold text-action-fg transition-opacity disabled:opacity-50"
        >
          {isPending ? "Getting you in…" : "I'm in"}
        </button>
      </form>

      <p className="mt-6 text-[13px] text-text-secondary">
        No email, no password. Just a name.
      </p>
    </main>
  );
}
