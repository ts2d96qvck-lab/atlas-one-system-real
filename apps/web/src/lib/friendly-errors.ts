/** Maps API errors to user-friendly Portuguese messages. */
export function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("login invalido") || m.includes("credenciais")) {
    return "E-mail, senha ou empresa incorretos. Verifique e tente novamente.";
  }
  if (m.includes("conta temporariamente bloqueada")) {
    return "Muitas tentativas falhas. Aguarde 15 minutos e tente de novo.";
  }
  if (m.includes("conta bloqueada") || m.includes("pendencia")) {
    return "Conta bloqueada. Fale com o administrador da sua empresa.";
  }
  if (m.includes("convite invalido") || m.includes("expirado")) {
    return "Este convite expirou ou ja foi usado. Peça um novo link ao administrador.";
  }
  if (m.includes("empresa nao encontrada")) {
    return "Empresa nao encontrada. Confira o ID da empresa com quem te convidou.";
  }
  if (m.includes("ja possui cadastro") || m.includes("conta dona")) {
    return "Esta empresa ja tem cadastro. Entre com sua conta ou solicite acesso como equipe.";
  }
  if (m.includes("solicitacao") || m.includes("ja existe")) {
    return "Ja existe uma conta ou solicitacao com este e-mail.";
  }
  if (m.includes("network") || m.includes("failed to fetch") || m.includes("timeout")) {
    return "Sem conexao com o servidor. Verifique sua internet e tente novamente.";
  }
  if (m.includes("503") || m.includes("indisponivel")) {
    return "Sistema temporariamente indisponivel. Tente novamente em instantes.";
  }
  return message;
}
