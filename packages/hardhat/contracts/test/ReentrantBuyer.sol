// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;
import "../Insurance.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

/// @notice Test harness: attempts reentry while receiving a freshly minted policy.
contract ReentrantBuyer is IERC721Receiver {
    Insurance public immutable insurance;
    bool public blocked;
    bytes4 public callbackError;
    uint64 private departure;
    constructor(address insurance_) { insurance = Insurance(insurance_); }
    function purchase(uint64 departure_) external {
        departure = departure_;
        insurance.usdc().approve(address(insurance.pool()), 100e6);
        insurance.purchasePolicy("CX528", departure, departure, departure + 1 hours, 1000e6, 20e6, 10e6);
    }
    function onERC721Received(address, address, uint256, bytes calldata) external returns (bytes4) {
        require(msg.sender == address(insurance.policyNFT()), "NFT only");
        try insurance.purchasePolicy("CX528", departure, departure, departure + 1 hours, 1000e6, 20e6, 10e6) {
            blocked = false;
        } catch (bytes memory reason) {
            blocked = true;
            if (reason.length >= 4) callbackError = bytes4(reason);
        }
        return IERC721Receiver.onERC721Received.selector;
    }
}
