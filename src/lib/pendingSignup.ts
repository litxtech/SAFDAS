/** In-memory only — clears on process restart so OTP is never a cold-start screen. */
let pendingSignupEmail: string | null = null;

export function setPendingSignupEmail(email: string | null) {
  pendingSignupEmail = email?.trim() ? email.trim() : null;
}

export function getPendingSignupEmail() {
  return pendingSignupEmail;
}
