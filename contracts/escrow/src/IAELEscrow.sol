// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAELEscrow {
    /// @notice Deposit USDC when creating a channel.
    function deposit(bytes32 channelId, uint256 usdcAmount) external;

    /// @notice Top up additional USDC to an existing channel.
    function topup(bytes32 channelId, uint256 usdcAmount) external;

    /// @notice Settle a channel: distribute USDC based on final CREDIT balances.
    function settle(
        bytes32 channelId,
        address[] calldata agents,
        uint256[] calldata creditBalances,
        bytes calldata hydraStateProof
    ) external;

    /// @notice Partial settlement when a single participant exits.
    function exitParticipant(
        bytes32 channelId,
        address agent,
        uint256 creditBalance,
        bytes calldata proof
    ) external;

    /// @notice Emergency withdrawal after timeout (AEL unresponsive).
    function emergencyWithdraw(bytes32 channelId) external;

    event Deposited(bytes32 indexed channelId, address indexed depositor, uint256 usdcAmount, uint256 creditsIssued);
    event ToppedUp(bytes32 indexed channelId, address indexed depositor, uint256 usdcAmount, uint256 additionalCredits);
    event Settled(bytes32 indexed channelId, address[] agents, uint256[] usdcAmounts);
    event ParticipantExited(bytes32 indexed channelId, address indexed agent, uint256 usdcAmount);
    event EmergencyWithdrawal(bytes32 indexed channelId, address indexed depositor, uint256 usdcAmount);
}
