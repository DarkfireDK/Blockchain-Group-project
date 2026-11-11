# 当前验证结果（修订版）

20项保险及安全回归测试全部通过，旧借贷文件已归档为legacy-tests/*.ts.txt。新增固定报价、条款快照、报告时间边界、暂停后退出、LP净值公平性、市场限价/过时挂单、20张保单混合结算、NFT回调重入、资金操作权限、零份额捐赠攻击测试。
业务源码6份，加专用重入攻击测试合约1份。前后端类型检查与生产构建通过，关闭了Next.js忽略类型错误设置。部署依赖已锁定到兼容版本。
本地部署脚本成功执行；浏览器实际完成领取测试ETH/USDC、授权、700测试USDC注资、购买500测试USDC保额保单（10保费/5可退）、NFT授权及20测试USDC挂牌，市场显示该保单。全部为Hardhat本地链，不是真实资产或Sepolia证据。
Slither结果见security-review.md和evidence/slither.json。Sepolia部署/验证、GitHub推送与远程CI尚未完成。

以下为首次运行历史记录，所述旧测试失败已在当前修订中处理。

# 首次编译与测试记录

日期：2026-11-10（香港）。基线提交 `4f85fc790c8e7bcd0e50f7add785fb6fc9585b26`，本地新增 Insurance.ts 测试和 test:insurance 命令，业务合约未修改。
环境：Windows，Node.js v22.14.0，仓库内置 Yarn 4.13.0，使用现有 yarn.lock。

| 检查 | 实际结果 |
|---|---|
| `yarn install --immutable` | 退出码0；安装完成，有peer dependency警告 |
| `yarn compile` | 退出码0；6份业务Solidity文件编译成功，solc 0.8.30，EVM prague |
| `yarn test:insurance` 对应的Hardhat命令 | 退出码0；9 passing (824ms) |
| `yarn test` | 退出码1；Mocha用例列表为9 passing、1 failing，旧借贷fixture失败 |

本环境直接用 `node .yarn/releases/yarn-4.13.0.cjs` 替代全局 `yarn` 启动。首次编译下载了原生及WASM编译器。

## 新增的9项保险测试
1. 购保后NFT归属、保额准备金与退款准备金。
2. 达标延误赔付金额、最终状态、重复报告拒绝。
3. 未授权报告和直接回调拒绝。
4. 未达门槛报告回滚，随后可重新报告。
5. 过早到期拒绝、到期退款金额、重复退款拒绝。
6. LP赎回后仍保留已锁定准备金。
7. 保费授权不足时订单与准备金整体回滚。
8. 二级转售的买卖双方及手续费余额变化，后续向新持有人赔付。
9. 撤单后不可购买。

首次新增测试运行有3项余额断言因工具兼容问题失败；改为等待交易后直接比较余额差，再次运行9项全部通过。

## 全量测试仍失败的原因
`packages/hardhat/test/Lending.ts` 的beforeEach尝试创建Corn合约，但保险仓库没有该合约，报HHE1000。其余旧借贷用例因fixture失败未运行，不能认定它们通过。保留旧文件及失败输出，没有隐藏或跳过失败。
全量测试的gas统计汇总额外打印29 passing，与Mocha列表的9项不一致；本记录按实际保险用例列表与单独运行结果报告9项，不将汇总数字当作额外测试覆盖。

## 输出与限制
原始输出见 evidence/compile.log、evidence/test-insurance.log、evidence/test-all.log（含gas统计）。
未执行前端构建/浏览器测试、漏洞扫描、模糊测试、Sepolia部署或验证；没有真实资产交易。本地测试实例不是测试网部署。
9项功能测试不覆盖经济安全：保费/保额自由输入、LP净值与可提款金额混用、Oracle时间窗和存量条款变更等仍需专项测试与修复。安装还提示rocketh相关版本范围不匹配、前端缺react-native peer dependency；此次合约编译与测试未被这些警告阻断。
