const COMMON_PASSWORDS = new Set([
  "password",
  "password1",
  "password123",
  "12345678",
  "123456789",
  "qwerty123",
  "admin123",
  "atlas2026",
  "atlasone",
  "changeme"
]);

export const PASSWORD_POLICY_HINT =
  "Minimo 12 caracteres, com 3 tipos entre maiuscula, minuscula, numero e simbolo.";

export function validatePassword(password: string): { ok: true } | { ok: false; message: string } {
  if (password.length < 12) {
    return { ok: false, message: "Senha deve ter no minimo 12 caracteres" };
  }
  if (password.length > 128) {
    return { ok: false, message: "Senha muito longa" };
  }

  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  const classes = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;

  if (classes < 3) {
    return {
      ok: false,
      message: "Senha deve incluir pelo menos 3 tipos: maiuscula, minuscula, numero e simbolo"
    };
  }

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return { ok: false, message: "Senha muito comum — escolha outra" };
  }

  return { ok: true };
}

export function assertPassword(password: string) {
  const result = validatePassword(password);
  if (!result.ok) throw new Error(result.message);
}
