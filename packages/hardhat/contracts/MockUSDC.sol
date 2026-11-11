// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {}

    // 覆盖 decimals，变成 6 位
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    // 任何人可以 mint，方便测试
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}