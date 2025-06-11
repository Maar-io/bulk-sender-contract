// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20, SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title BulkSender
 * @dev Contract for bulk sending ERC20, ERC721, and ERC1155 tokens
 */
contract BulkSender is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // State variables
    uint256 public recipientLimit = 200; // Default limit
    
    // Events
    event BulkERC20Transfer(
        address indexed token,
        address indexed sender,
        uint256 totalAmount,
        uint256 recipientCount
    );
    
    event BulkERC721Transfer(
        address indexed token,
        address indexed sender,
        uint256[] tokenIds,
        address[] recipients
    );
    
    event BulkERC1155Transfer(
        address indexed token,
        address indexed sender,
        uint256[] tokenIds,
        uint256[] amounts,
        address[] recipients
    );
    
    event RecipientLimitUpdated(uint256 newLimit);
    
    // Modifiers
    modifier validArrayLength(uint256 length) {
        require(length > 0, "BulkSender: Empty array");
        require(length <= recipientLimit, "BulkSender: Exceeds recipient limit");
        _;
    }
    
    constructor(address initialOwner) Ownable(initialOwner) {}
    
    // ERC20 Bulk Operations
    /**
     * @dev Send same ERC20 token to multiple recipients with same amount each
     */
    function bulkSendERC20Equal(
        address token,
        address[] calldata recipients,
        uint256 amount
    ) external payable nonReentrant whenNotPaused validArrayLength(recipients.length) {
        require(amount > 0, "BulkSender: Amount must be greater than 0");
        
        uint256 totalAmount = amount * recipients.length;
        
        // Validate transfer prerequisites
        _validateERC20Transfer(token, msg.sender, totalAmount);
        
        IERC20 erc20Token = IERC20(token);
        
        // Transfer total amount from sender to this contract
        erc20Token.safeTransferFrom(msg.sender, address(this), totalAmount);
        
        // Distribute to recipients
        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "BulkSender: Invalid recipient");
            erc20Token.safeTransfer(recipients[i], amount);
        }
        
        emit BulkERC20Transfer(token, msg.sender, totalAmount, recipients.length);
    }
    
    /**
     * @dev Send same ERC20 token to multiple recipients with different amounts
     */
    function bulkSendERC20Different(
        address token,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external payable nonReentrant whenNotPaused validArrayLength(recipients.length) {
        require(recipients.length == amounts.length, "BulkSender: Array length mismatch");
        
        uint256 totalAmount = 0;
        
        // Calculate total amount and validate individual amounts
        for (uint256 i = 0; i < amounts.length; i++) {
            require(amounts[i] > 0, "BulkSender: Amount must be greater than 0");
            totalAmount += amounts[i];
        }
        
        // Validate transfer prerequisites
        _validateERC20Transfer(token, msg.sender, totalAmount);
        
        IERC20 erc20Token = IERC20(token);
        
        // Transfer total amount from sender to this contract
        erc20Token.safeTransferFrom(msg.sender, address(this), totalAmount);
        
        // Distribute to recipients
        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "BulkSender: Invalid recipient");
            erc20Token.safeTransfer(recipients[i], amounts[i]);
        }
        
        emit BulkERC20Transfer(token, msg.sender, totalAmount, recipients.length);
    }
    
    // ERC721 Bulk Operations
    /**
     * @dev Send multiple ERC721 tokens to multiple recipients
     */
    function bulkSendERC721(
        address token,
        address[] calldata recipients,
        uint256[] calldata tokenIds
    ) external payable nonReentrant whenNotPaused validArrayLength(recipients.length) {
        require(token != address(0), "BulkSender: Invalid token address");
        require(recipients.length == tokenIds.length, "BulkSender: Array length mismatch");
                
        IERC721 erc721Token = IERC721(token);
        
        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "BulkSender: Invalid recipient");
            erc721Token.safeTransferFrom(msg.sender, recipients[i], tokenIds[i]);
        }
        
        emit BulkERC721Transfer(token, msg.sender, tokenIds, recipients);
    }
    
    // ERC1155 Bulk Operations
    /**
     * @dev Send same ERC1155 token ID to multiple recipients
     */
    function bulkSendERC1155(
        address token,
        address[] calldata recipients,
        uint256 tokenId,
        uint256[] calldata amounts,
        bytes calldata data
    ) external payable nonReentrant whenNotPaused validArrayLength(recipients.length) {
        require(token != address(0), "BulkSender: Invalid token address");
        require(recipients.length == amounts.length, "BulkSender: Array length mismatch");
        
        _executeERC1155Transfers(token, recipients, tokenId, amounts, data, true);
    }
    
    /**
     * @dev Send multiple different ERC1155 tokens with different IDs
     */
    function bulkSendERC1155Different(
        address token,
        address[] calldata recipients,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts,
        bytes calldata data
    ) external payable nonReentrant whenNotPaused validArrayLength(recipients.length) {
        require(token != address(0), "BulkSender: Invalid token address");
        require(
            recipients.length == tokenIds.length && tokenIds.length == amounts.length,
            "BulkSender: Array length mismatch"
        );
        
        _executeERC1155DifferentTransfers(token, recipients, tokenIds, amounts, data);
    }
    
    // Administrative functions
    
    /**
     * @dev Set the maximum number of recipients per bulk call (only owner)
     */
    function setRecipientLimit(uint256 newLimit) external onlyOwner {
        require(newLimit > 0, "BulkSender: Limit must be greater than 0");
        recipientLimit = newLimit;
        emit RecipientLimitUpdated(newLimit);
    }
    
    /**
     * @dev Get current recipient limit per bulk call
     */
    function getRecipientLimit() external view returns (uint256) {
        return recipientLimit;
    }
    
    // Emergency functions
    /**
     * @dev Emergency withdrawal of tokens sent to contract by mistake
     */
    function emergencyWithdraw(
        address token,
        address to,
        uint256 amount
    ) external onlyOwner {
        require(to != address(0), "BulkSender: Invalid address");
        
        if (token == address(0)) {
            // Withdraw ETH
            uint256 availableBalance = address(this).balance;
            require(amount <= availableBalance, "BulkSender: Insufficient balance");
            (bool success, ) = payable(to).call{value: amount}("");
            require(success, "BulkSender: ETH withdrawal failed");
        } else {
            // Withdraw ERC20 tokens
            IERC20(token).safeTransfer(to, amount);
        }
    }
    
    /**
     * @dev Pause/unpause contract functionality
     */
    function setPaused(bool paused) external onlyOwner {
        if (paused) {
            _pause();
        } else {
            _unpause();
        }
    }
    
    /**
     * @dev Check if contract is paused
     */
    function isPaused() external view returns (bool) {
        return paused();
    }
    
    // Internal functions
    /**
     * @dev Execute ERC1155 transfers with same token ID
     */
    function _executeERC1155Transfers(
        address token,
        address[] calldata recipients,
        uint256 tokenId,
        uint256[] calldata amounts,
        bytes calldata data,
        bool sameTokenId
    ) internal {
        IERC1155 erc1155Token = IERC1155(token);
        
        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "BulkSender: Invalid recipient");
            require(amounts[i] > 0, "BulkSender: Amount must be greater than 0");
            erc1155Token.safeTransferFrom(msg.sender, recipients[i], tokenId, amounts[i], data);
        }
        
        if (sameTokenId) {
            uint256[] memory tokenIds = new uint256[](recipients.length);
            for (uint256 i = 0; i < recipients.length; i++) {
                tokenIds[i] = tokenId;
            }
            emit BulkERC1155Transfer(token, msg.sender, tokenIds, amounts, recipients);
        }
    }
    
    /**
     * @dev Execute ERC1155 transfers with different token IDs
     */
    function _executeERC1155DifferentTransfers(
        address token,
        address[] calldata recipients,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts,
        bytes calldata data
    ) internal {
        IERC1155 erc1155Token = IERC1155(token);
        
        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "BulkSender: Invalid recipient");
            require(amounts[i] > 0, "BulkSender: Amount must be greater than 0");
            erc1155Token.safeTransferFrom(msg.sender, recipients[i], tokenIds[i], amounts[i], data);
        }
        
        emit BulkERC1155Transfer(token, msg.sender, tokenIds, amounts, recipients);
    }

    /**
     * @dev Validate ERC20 token transfer prerequisites
     */
    function _validateERC20Transfer(
        address token,
        address sender,
        uint256 totalAmount
    ) internal view {
        require(token != address(0), "BulkSender: Invalid token address");
        require(totalAmount > 0, "BulkSender: Total amount must be greater than 0");
        
        IERC20 erc20Token = IERC20(token);
        
        // Check allowance
        uint256 allowance = erc20Token.allowance(sender, address(this));
        require(allowance >= totalAmount, "BulkSender: Insufficient allowance");
        
        // Check balance
        uint256 senderBalance = erc20Token.balanceOf(sender);
        require(senderBalance >= totalAmount, "BulkSender: Insufficient balance");
    }
    
    // Receive function to accept ETH
    receive() external payable {
        // Allow contract to receive ETH
    }
}