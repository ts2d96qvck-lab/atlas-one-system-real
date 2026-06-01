export type AuthLoginErrorCode =
  | "invalid_credentials"
  | "rate_limited"
  | "billing_blocked"
  | "trial_expired"
  | "twofa_sms"
  | "twofa_phone_missing";

export class AuthLoginError extends Error {
  readonly code: AuthLoginErrorCode;

  constructor(code: AuthLoginErrorCode, message: string) {
    super(message);
    this.name = "AuthLoginError";
    this.code = code;
  }
}

export function formatZodIssues(issues: { path: (string | number)[]; message: string }[]) {
  return issues.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`).join("; ");
}
