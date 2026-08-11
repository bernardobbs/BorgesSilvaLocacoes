// Sistema familiar — todos os admins veem os mesmos dados do proprietário principal
// UUID do proprietário definido via variável de ambiente FAMILY_OWNER_ID
// Fallback hardcoded apenas para desenvolvimento local sem .env configurado

export const FAMILY_OWNER_ID =
  process.env.FAMILY_OWNER_ID ?? '360196c2-df33-4848-80a9-1c4984ad028c';
