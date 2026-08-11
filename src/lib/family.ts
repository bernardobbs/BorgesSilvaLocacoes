// Sistema familiar — todos os admins veem os mesmos dados do proprietário principal
// UUID do proprietário definido via variável de ambiente FAMILY_OWNER_ID (obrigatório em produção)
export const FAMILY_OWNER_ID = (() => {
  const id = process.env.FAMILY_OWNER_ID;
  if (!id) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FAMILY_OWNER_ID env var is required in production');
    }
    return '360196c2-df33-4848-80a9-1c4984ad028c'; // fallback apenas em dev
  }
  return id;
})();
