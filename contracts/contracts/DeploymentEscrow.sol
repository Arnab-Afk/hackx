// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title DeploymentEscrow
/// @notice Fallback payment escrow for zkLOUD deployments.
///         Used when x402 HTTP-native payments are unavailable or fail.
///
///         Flow:
///           1. User deposits funds (ETH) into escrow for a session.
///           2. Backend (release authority) calls release() when the session
///              completes successfully, sending funds to the provider.
///           3. If the session fails or times out, user calls refund() after
///              the lockup period.
contract DeploymentEscrow is Ownable, ReentrancyGuard {
    // ─── Constants ────────────────────────────────────────────────────────────

    /// @notice How long a user must wait before claiming a refund (24 hours)
    uint256 public constant LOCKUP_PERIOD = 24 hours;

    /// @notice Protocol fee in basis points (e.g. 1000 = 10%)
    uint256 public constant FEE_BPS = 1000;
    uint256 private constant BPS_DENOM = 10_000;

    // ─── Types ────────────────────────────────────────────────────────────────

    enum EscrowStatus { Pending, Released, Refunded, Disputed }

    struct Escrow {
        address user;
        address provider;
        uint256 amount;          // Total deposited (including fee)
        uint256 depositedAt;     // Timestamp of deposit
        bytes32 sessionId;       // keccak256 of the session identifier
        EscrowStatus status;
    }

    // ─── State ────────────────────────────────────────────────────────────────

    /// @dev sessionId → Escrow record
    mapping(bytes32 => Escrow) public escrows;

    /// @dev Address authorised to release or dispute escrows (zkLOUD backend)
    address public releaseAuthority;

    /// @dev Accumulated protocol fees (owner can withdraw)
    uint256 public accruedFees;

    // ─── Events ───────────────────────────────────────────────────────────────

    event Deposited(bytes32 indexed sessionId, address indexed user, address indexed provider, uint256 amount);
    event Released(bytes32 indexed sessionId, address indexed provider, uint256 netAmount, uint256 fee);
    event Refunded(bytes32 indexed sessionId, address indexed user, uint256 amount);
    event Disputed(bytes32 indexed sessionId);
    event FeesWithdrawn(address indexed to, uint256 amount);
    event ReleaseAuthorityUpdated(address indexed newAuthority);

    // ─── Errors ───────────────────────────────────────────────────────────────

    error SessionAlreadyExists();
    error SessionNotFound();
    error WrongStatus();
    error LockupNotExpired();
    error Unauthorised();
    error ZeroAmount();
    error NoFeesToWithdraw();

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(address initialOwner, address _releaseAuthority) Ownable(initialOwner) {
        releaseAuthority = _releaseAuthority;
    }

    // ─── User actions ─────────────────────────────────────────────────────────

    /// @notice Deposit ETH into escrow for a deployment session.
    /// @param sessionId  keccak256 hash of the session identifier string
    /// @param provider   Address of the provider who will execute the deployment
    function deposit(bytes32 sessionId, address provider) external payable nonReentrant {
        if (msg.value == 0) revert ZeroAmount();
        if (escrows[sessionId].user != address(0)) revert SessionAlreadyExists();

        escrows[sessionId] = Escrow({
            user:        msg.sender,
            provider:    provider,
            amount:      msg.value,
            depositedAt: block.timestamp,
            sessionId:   sessionId,
            status:      EscrowStatus.Pending
        });

        emit Deposited(sessionId, msg.sender, provider, msg.value);
    }

    /// @notice Refund the user after the lockup period expires (session timed out or failed).
    ///         User calls this themselves — no authority needed.
    /// @param sessionId  The session to refund
    function refund(bytes32 sessionId) external nonReentrant {
        Escrow storage e = escrows[sessionId];
        if (e.user == address(0)) revert SessionNotFound();
        if (e.status != EscrowStatus.Pending) revert WrongStatus();
        if (msg.sender != e.user) revert Unauthorised();
        if (block.timestamp < e.depositedAt + LOCKUP_PERIOD) revert LockupNotExpired();

        e.status = EscrowStatus.Refunded;
        uint256 amount = e.amount;

        emit Refunded(sessionId, e.user, amount);

        (bool ok, ) = e.user.call{value: amount}("");
        require(ok, "Refund transfer failed");
    }

    // ─── Release authority actions ────────────────────────────────────────────

    /// @notice Release funds to the provider after a successful session.
    ///         Deducts the protocol fee and sends the rest to the provider.
    ///         Only callable by releaseAuthority or owner.
    /// @param sessionId  The session to release
    function release(bytes32 sessionId) external nonReentrant {
        if (msg.sender != releaseAuthority && msg.sender != owner()) revert Unauthorised();

        Escrow storage e = escrows[sessionId];
        if (e.user == address(0)) revert SessionNotFound();
        if (e.status != EscrowStatus.Pending) revert WrongStatus();

        e.status = EscrowStatus.Released;

        uint256 fee       = (e.amount * FEE_BPS) / BPS_DENOM;
        uint256 netAmount = e.amount - fee;
        accruedFees      += fee;

        emit Released(sessionId, e.provider, netAmount, fee);

        (bool ok, ) = e.provider.call{value: netAmount}("");
        require(ok, "Release transfer failed");
    }

    /// @notice Mark a session as disputed (freezes funds pending off-chain resolution).
    ///         Only callable by releaseAuthority or owner.
    /// @param sessionId  The session to dispute
    function dispute(bytes32 sessionId) external {
        if (msg.sender != releaseAuthority && msg.sender != owner()) revert Unauthorised();

        Escrow storage e = escrows[sessionId];
        if (e.user == address(0)) revert SessionNotFound();
        if (e.status != EscrowStatus.Pending) revert WrongStatus();

        e.status = EscrowStatus.Disputed;
        emit Disputed(sessionId);
    }

    /// @notice Resolve a dispute: send funds to either user or provider.
    ///         Only callable by owner (final arbiter).
    /// @param sessionId   The disputed session
    /// @param toProvider  If true, release to provider; if false, refund to user
    function resolveDispute(bytes32 sessionId, bool toProvider) external nonReentrant onlyOwner {
        Escrow storage e = escrows[sessionId];
        if (e.user == address(0)) revert SessionNotFound();
        if (e.status != EscrowStatus.Disputed) revert WrongStatus();

        uint256 amount = e.amount;

        if (toProvider) {
            uint256 fee       = (amount * FEE_BPS) / BPS_DENOM;
            uint256 netAmount = amount - fee;
            accruedFees      += fee;
            e.status          = EscrowStatus.Released;

            emit Released(sessionId, e.provider, netAmount, fee);
            (bool ok, ) = e.provider.call{value: netAmount}("");
            require(ok, "Dispute release failed");
        } else {
            e.status = EscrowStatus.Refunded;
            emit Refunded(sessionId, e.user, amount);
            (bool ok, ) = e.user.call{value: amount}("");
            require(ok, "Dispute refund failed");
        }
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    /// @notice Withdraw accrued protocol fees to owner.
    function withdrawFees() external onlyOwner nonReentrant {
        uint256 amount = accruedFees;
        if (amount == 0) revert NoFeesToWithdraw();
        accruedFees = 0;
        emit FeesWithdrawn(owner(), amount);
        (bool ok, ) = owner().call{value: amount}("");
        require(ok, "Fee withdrawal failed");
    }

    /// @notice Update the release authority address.
    function setReleaseAuthority(address newAuthority) external onlyOwner {
        releaseAuthority = newAuthority;
        emit ReleaseAuthorityUpdated(newAuthority);
    }

    // ─── View helpers ─────────────────────────────────────────────────────────

    /// @notice Check whether a session's lockup has expired.
    function isLockupExpired(bytes32 sessionId) external view returns (bool) {
        Escrow storage e = escrows[sessionId];
        if (e.user == address(0)) return false;
        return block.timestamp >= e.depositedAt + LOCKUP_PERIOD;
    }
}
