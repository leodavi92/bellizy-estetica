export const maskPhone = (value) => {
  if (!value) return "";
  const cleaned = value.replace(/\D/g, ""); // Remove tudo que não é dígito
  const limited = cleaned.slice(0, 11); // Limita a 11 dígitos (DDD + 9 números)
  
  if (limited.length <= 10) {
    // Formato (XX) XXXX-XXXX (Telefone fixo ou incompleto)
    return limited
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  } else {
    // Formato (XX) XXXXX-XXXX (Celular)
    return limited
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2");
  }
};

export const validatePhone = (value) => {
  const cleaned = value.replace(/\D/g, "");
  // Aceita 10 dígitos (fixo) ou 11 dígitos (celular)
  return cleaned.length === 10 || cleaned.length === 11;
};
