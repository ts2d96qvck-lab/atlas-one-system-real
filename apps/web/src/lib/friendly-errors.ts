/** Maps API errors to user-friendly Portuguese messages. */
export function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("login invalido") || m.includes("credenciais")) {
    return "E-mail, senha ou empresa incorretos. Verifique e tente novamente.";
  }
  if (m.includes("conta temporariamente bloqueada")) {
    return "Muitas tentativas falhas. Aguarde 15 minutos e tente de novo.";
  }
  if (m.includes("conta bloqueada") || m.includes("pendencia") || m.includes("pendência")) {
    return "Conta bloqueada. Fale com o administrador da sua empresa.";
  }
  if (m.includes("convite invalido") || m.includes("expirado")) {
    return "Este convite expirou ou já foi usado. Peça um novo link ao administrador.";
  }
  if (m.includes("empresa nao encontrada") || m.includes("empresa não encontrada")) {
    return "Empresa não encontrada. Confira o ID da empresa com quem te convidou.";
  }
  if (m.includes("ja possui cadastro") || m.includes("já possui cadastro") || m.includes("conta dona")) {
    return "Esta empresa já tem cadastro. Entre com sua conta ou solicite acesso como equipe.";
  }
  if (m.includes("solicitacao") || m.includes("solicitação") || m.includes("ja existe") || m.includes("já existe")) {
    return "Já existe uma conta ou solicitação com este e-mail.";
  }
  if (m.includes("network") || m.includes("failed to fetch") || m.includes("timeout")) {
    return "Sem conexão com o servidor. Verifique sua internet e tente novamente.";
  }
  if (m.includes("503") || m.includes("indisponivel") || m.includes("indisponível")) {
    return "Sistema temporariamente indisponível. Tente novamente em instantes.";
  }
  return message;
}
