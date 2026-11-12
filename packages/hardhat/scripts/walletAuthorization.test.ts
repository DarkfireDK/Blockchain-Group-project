import { test } from "node:test";
import assert from "node:assert/strict";
import { assertWalletAccount, isWalletAuthorizationError } from "../../nextjs/utils/scaffold-eth/walletAuthorization.js";
test("recognizes nested wallet 4100", () => assert.equal(isWalletAuthorizationError({cause:{code:4100}}),true));
test("recognizes original provider text", () => assert.equal(isWalletAuthorizationError({message:"The requested account and/or method has not been authorized by the user."}),true));
test("does not mislabel rejected signature", () => assert.equal(isWalletAuthorizationError({code:4001,message:"User rejected request"}),false));
test("rejects stale or revoked account", () => assert.throws(()=>assertWalletAccount("0xAbC",["0xdef"]),/尚未授权/));
test("accepts current account without case sensitivity", () => assert.doesNotThrow(()=>assertWalletAccount("0xAbC",["0xabc"])));
test("handles circular provider errors", () => {const error:{cause?:unknown}={};error.cause=error;assert.equal(isWalletAuthorizationError(error),false);});
