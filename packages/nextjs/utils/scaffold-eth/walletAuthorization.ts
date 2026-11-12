export function isWalletAuthorizationError(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const value = current as { code?: unknown; message?: unknown; cause?: unknown };
    if (Number(value.code) === 4100 || /not been authorized|unauthorized|account.*not.*found|尚未授权/i.test(String(value.message ?? ""))) return true;
    current = value.cause;
  }
  return false;
}

export function assertWalletAccount(address: string, accounts: readonly string[]) {
  if (!accounts.some(account => account.toLowerCase() === address.toLowerCase())) {
    throw new Error("钱包尚未授权当前页面使用这个账户，请重新连接钱包并选择页面显示的账户。");
  }
}
