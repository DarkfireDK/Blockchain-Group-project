export function flightReportError(input: {
  status: number;
  departureDate: bigint;
  coverageEnd: bigint;
  chainTime?: bigint;
  delay: string;
  threshold?: number;
  reporter: boolean;
  oracleMatches: boolean;
}) {
  if (input.status !== 1) return "请选择一张未结算保单。";
  if (input.chainTime === undefined) return "无法读取链上时间，请刷新后重试。";
  if (input.chainTime < input.departureDate) return "尚未到计划起飞时间，不能上报延误。";
  if (input.chainTime > input.coverageEnd + 86400n) return "已超过24小时报告宽限期，请结算到期退款。";
  if (!input.oracleMatches) return "该保单绑定的是其他 Oracle，不能通过当前 Oracle 上报。";
  if (!input.reporter) return "请连接该 Oracle 的授权上报员钱包。";
  if (input.threshold === undefined) return "正在读取本保单的赔付门槛。";
  if (!/^\d+$/.test(input.delay)) return "请输入整数分钟。";
  const delay = Number(input.delay);
  if (!Number.isSafeInteger(delay) || delay > 4294967295) return "延误分钟超出合约允许范围。";
  if (delay < input.threshold || delay === 0)
    return `延误须达到本保单的 ${input.threshold} 分钟门槛，未达门槛无需上报。`;
  return undefined;
}
