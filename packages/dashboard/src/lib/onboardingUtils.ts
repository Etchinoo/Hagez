// ============================================================
// SUPER RESERVATION PLATFORM — Onboarding Step Utilities
// Shared localStorage helpers for tracking onboarding step
// completion. Call markOnboardingStep() from any page after
// a successful save, and the OnboardingChecklist will
// automatically reflect the change.
// ============================================================

export const ONBOARDING_STEPS_KEY = 'reservr_onboarding_steps';

export function getCompletedSteps(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(ONBOARDING_STEPS_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function markOnboardingStep(id: string): void {
  if (typeof window === 'undefined') return;
  const current = getCompletedSteps();
  if (current.includes(id)) return;
  const updated = [...current, id];
  localStorage.setItem(ONBOARDING_STEPS_KEY, JSON.stringify(updated));
  // Notify OnboardingChecklist on the same tab
  window.dispatchEvent(new StorageEvent('storage', { key: ONBOARDING_STEPS_KEY, newValue: JSON.stringify(updated) }));
}
