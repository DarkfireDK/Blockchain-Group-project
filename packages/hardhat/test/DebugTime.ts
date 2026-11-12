import {expect} from "chai";
import {network} from "hardhat";
import {setDebugChainTime} from "../../nextjs/utils/scaffold-eth/debugChainTime.js";
describe("Local Debug time button RPC",function(){
  it("sets the exact target and mines a block without changing balances",async()=>{
    const {ethers}=await network.create();const [user]=await ethers.getSigners();
    const balance=await ethers.provider.getBalance(user.address);
    const block=(await ethers.provider.getBlock("latest"))!;
    const target=BigInt(block.timestamp)+3600n;
    const actual=await setDebugChainTime(target,(method,params)=>ethers.provider.send(method,params));
    expect(actual).to.equal(target);
    expect(await ethers.provider.getBalance(user.address)).to.equal(balance);
  });
  it("rejects past time without a mutating RPC call",async()=>{
    const {ethers}=await network.create();const block=(await ethers.provider.getBlock("latest"))!;const calls:string[]=[];
    try{await setDebugChainTime(BigInt(block.timestamp),(method,params)=>{calls.push(method);return ethers.provider.send(method,params);});throw Error("expected rejection");}
    catch(error){expect(String(error)).to.include("不能调回过去");}
    expect(calls).not.to.include("evm_setNextBlockTimestamp");
  });
  it("rejects Sepolia before changing time",async()=>{
    const calls:string[]=[];
    try{await setDebugChainTime(2000000000n,async method=>{calls.push(method);return "0xaa36a7";});throw Error("expected rejection");}
    catch(error){expect(String(error)).to.include("仅支持本地");}
    expect(calls).to.deep.equal(["eth_chainId"]);
  });
  it("rejects a fork even with local chain ID",async()=>{
    const calls:string[]=[];
    try{await setDebugChainTime(2000000000n,async method=>{calls.push(method);return method==="eth_chainId"?"0x7a69":{chainId:31337,clientVersion:"edr/0.3.8",forkedNetwork:{chainId:1}};});throw Error("expected rejection");}
    catch(error){expect(String(error)).to.include("独立");}
    expect(calls).not.to.include("evm_setNextBlockTimestamp");
  });
});
