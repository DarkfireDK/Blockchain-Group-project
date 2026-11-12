export function isMarketPolicyTradable(input: {
  active: boolean; status: number; departure: bigint; chainTime: bigint; seller: string; owner?: string;
}): boolean {
  return input.active && input.status === 1 && input.chainTime < input.departure &&
    Boolean(input.owner && input.owner.toLowerCase() === input.seller.toLowerCase());
}
