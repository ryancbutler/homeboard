"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, Home, ShieldCheck, Users } from "lucide-react";
import { useRouter } from "next/navigation";

type SetupResponse = { error?: string };

export function FirstRunSetup() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setError("");
    setSubmitting(true);

    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/v1/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          householdName: form.get("householdName"),
          parentName: form.get("parentName"),
          pin: form.get("pin"),
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({})) as SetupResponse;
        throw new Error(data.error ?? "We couldn't create your household. Please try again.");
      }
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We couldn't create your household. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <main className="setup-shell" aria-labelledby="setup-title">
      <section className="setup-card">
        <div className="setup-mark" aria-hidden="true"><Home size={30} strokeWidth={2.4} /></div>
        <p className="eyebrow">WELCOME TO HOMEBOARD</p>
        <h1 id="setup-title">Let&apos;s make your home feel more in sync.</h1>
        <p className="setup-intro">Start with your household and first parent profile. You can add family members, chores, and routines whenever you&apos;re ready.</p>

        <form className="setup-form" onSubmit={submit}>
          <label htmlFor="household-name">
            Household name <span aria-hidden="true">*</span>
            <input id="household-name" name="householdName" autoComplete="organization" maxLength={100} placeholder="e.g. The Johnson Home" required disabled={submitting} />
          </label>
          <label htmlFor="parent-name">
            Your name <span aria-hidden="true">*</span>
            <input id="parent-name" name="parentName" autoComplete="name" maxLength={100} placeholder="e.g. Alex" required disabled={submitting} />
          </label>
          <label htmlFor="household-pin">
            Create a parent PIN <span aria-hidden="true">*</span>
            <input id="household-pin" name="pin" type="password" inputMode="numeric" autoComplete="new-password" pattern="[0-9]{4,20}" minLength={4} maxLength={20} placeholder="4 to 20 digits" aria-describedby="pin-help" required disabled={submitting} />
            <small id="pin-help">Use this PIN to open Parent mode and manage your home.</small>
          </label>
          {error && <p className="setup-error" role="alert">{error}</p>}
          <button className="primary setup-submit" type="submit" disabled={submitting}>
            {submitting ? "Creating your home…" : "Create my home"} <ArrowRight size={18} aria-hidden="true" />
          </button>
        </form>

        <ul className="setup-benefits" aria-label="What happens next">
          <li><span aria-hidden="true"><Users size={17} /></span>Add your family when you&apos;re ready</li>
          <li><span aria-hidden="true"><ShieldCheck size={17} /></span>Your parent PIN stays protected</li>
        </ul>
      </section>
    </main>
  );
}
