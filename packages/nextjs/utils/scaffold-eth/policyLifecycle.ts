export function policyLifecycle(policy: {status:number; departureDate:bigint; coverageEnd:bigint}, chainTime?:bigint, grace=86400n) {
  if(policy.status===2) return {label:"已理赔",tone:"success" as const,canTransfer:false,canRefund:false,description:"赔付完成，保单已结算。"};
  if(policy.status===3) return {label:"已退款",tone:"neutral" as const,canTransfer:false,canRefund:false,description:"可退保费已返还，保单已结算。"};
  if(policy.status!==1) return {label:"未知状态",tone:"neutral" as const,canTransfer:false,canRefund:false,description:"请确认保单编号。"};
  if(chainTime===undefined) return {label:"正在读取时间",tone:"neutral" as const,canTransfer:false,canRefund:false,description:"正在核对链上时间。"};
  if(chainTime>policy.coverageEnd+grace) return {label:"待退款",tone:"warning" as const,canTransfer:false,canRefund:true,description:"报告宽限期已结束。点击“领取到期退款”完成结算，资金退给当前持有人。"};
  if(chainTime>=policy.coverageEnd) return {label:"保障已结束",tone:"warning" as const,canTransfer:false,canRefund:false,description:"当前处于24小时报告宽限期，仍可由授权Oracle报告符合条件的延误；宽限期结束后可退款。"};
  if(chainTime>=policy.departureDate) return {label:"已起飞",tone:"warning" as const,canTransfer:false,canRefund:false,description:"航班已起飞，保单无法转让；符合条件的延误仍可申请赔付。"};
  return {label:"待起飞",tone:"success" as const,canTransfer:true,canRefund:false,description:"起飞前可以转让保单受益权。"};
}
