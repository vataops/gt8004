// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IReputationRegistry - ERC-8004 Reputation Registry Interface
/// @notice On-chain reputation feedback for registered agents
interface IReputationRegistry {
    event FeedbackGiven(
        uint256 indexed agentId,
        address indexed from,
        int128 value,
        bytes32 tag1,
        bytes32 tag2
    );

    /// @notice Submit reputation feedback for an agent
    /// @param agentId The agent's ERC-8004 token ID
    /// @param value Reputation score (signed, supports negative feedback)
    /// @param decimals Decimal places for the value
    /// @param tag1 Primary category tag (e.g., "service-quality")
    /// @param tag2 Secondary category tag (e.g., "response-time")
    /// @param endpoint The service endpoint this feedback relates to
    /// @param feedbackURI URI to off-chain feedback details
    /// @param feedbackHash Hash of the off-chain feedback data for integrity
    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 decimals,
        bytes32 tag1,
        bytes32 tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external;

    /// @notice Get aggregated reputation summary for an agent
    /// @param agentId The agent's ERC-8004 token ID
    /// @return score Aggregated reputation score
    /// @return count Total number of feedback entries
    function getSummary(uint256 agentId) external view returns (int128 score, uint256 count);
}
