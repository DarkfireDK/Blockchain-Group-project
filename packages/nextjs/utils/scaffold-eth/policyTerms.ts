export function policyTermsError({flight, coverage, departure, end, chainTime}: {
  flight: string; coverage: bigint; departure?: bigint; end?: bigint; chainTime?: bigint;
}): string {
  const bytes = new TextEncoder().encode(flight.trim().toUpperCase()).length;
  if (bytes < 2 || bytes > 12) return "请输入2–12字节的航班号，例如CX528。";
  if (coverage < 10_000000n || coverage > 5000_000000n) return "保额必须在10–5,000测试USDC之间。";
  if (!departure || !end) return "请填写有效的起飞时间和保障结束时间。";
  if (chainTime === undefined) return "正在读取链上时间，请稍候。";
  if (departure <= chainTime) return "起飞时间已早于或等于链上时间，请按链上时间重新设置日期。";
  if (end <= departure) return "保障结束时间必须晚于起飞时间。";
  if (end - departure > 7n * 86400n) return "保障区间不能超过7天。";
  return "";
}
