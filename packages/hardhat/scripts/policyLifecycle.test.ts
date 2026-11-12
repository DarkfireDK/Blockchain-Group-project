import {test} from "node:test";
import assert from "node:assert/strict";
import {policyLifecycle} from "../../nextjs/utils/scaffold-eth/policyLifecycle.js";
const policy={status:1,departureDate:1000n,coverageEnd:2000n};
test("preflight listing allowed until one second before departure",()=>{
  const phase=policyLifecycle(policy,999n);assert.equal(phase.label,"待起飞");assert.equal(phase.canTransfer,true);
});
test("exact departure marks departed and forbids transfer",()=>{
  const phase=policyLifecycle(policy,1000n);assert.equal(phase.label,"已起飞");assert.equal(phase.canTransfer,false);assert.equal(phase.canRefund,false);
});
test("still departed immediately before coverage end",()=>assert.equal(policyLifecycle(policy,1999n).label,"已起飞"));
test("coverage end marks ended without claiming funds were refunded",()=>{
  const phase=policyLifecycle(policy,2000n);assert.equal(phase.label,"保障已结束");assert.equal(phase.canRefund,false);assert.equal(phase.canTransfer,false);
});
test("last grace second still forbids refund",()=>assert.equal(policyLifecycle(policy,88400n).canRefund,false));
test("one second after grace enables refund",()=>{
  const phase=policyLifecycle(policy,88401n);assert.equal(phase.label,"待退款");assert.equal(phase.canRefund,true);assert.equal(phase.canTransfer,false);
});
test("terminal states override time and forbid further action",()=>{
  assert.equal(policyLifecycle({...policy,status:2},0n).label,"已理赔");
  const refunded=policyLifecycle({...policy,status:3},999999n);assert.equal(refunded.label,"已退款");assert.equal(refunded.canRefund,false);assert.equal(refunded.canTransfer,false);
});
test("missing block time does not enable transfer",()=>{
  const phase=policyLifecycle(policy);assert.equal(phase.label,"正在读取时间");assert.equal(phase.canTransfer,false);
});
