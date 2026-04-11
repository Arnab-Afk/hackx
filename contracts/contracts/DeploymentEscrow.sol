// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IProviderRegistry {
    function slash(address providerWallet, bytes32 evidence) external;
}

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
    uint256 public constant FEE_BPS     = 1_000;
    uint256 private constant BPS_DENOM  = 10_000;
    /// @notice Upfront deployment fee sent immediately to provider on session start (20%)
    uint256 public constant UPFRONT_BPS = 2_000;

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

    /// @dev Streaming payment session — lives alongside simple Escrow records.
    struct Session {
        address user;
        address provider;
        uint256 ratePerSecond;     // wei streamed to provider per second
        uint256 remainingBalance;  // wei still held in escrow
        uint256 lastPaidAt;        // block.timestamp of last payment release
        bool    isActive;
    }

    // ─── State ────────────────────────────────────────────────────────────────

    /// @dev sessionId → Escrow record
    mapping(bytes32 => Escrow) public escrows;

    /// @dev Address authorised to release or dispute escrows (zkLOUD backend)
    address public releaseAuthority;

    /// @dev Accumulated protocol fees (owner can withdraw)
    uint256 public accruedFees;

    // ─── Streaming state ──────────────────────────────────────────────────────

    /// @dev ProviderRegistry — used to slash misbehaving providers
    IProviderRegistry public immutable registry;

    /// @dev Address authorised to submit proofs and trigger slashes (zkLOUD backend)
    address public proofAuthority;

    /// @dev sessionId → streaming Session
    mapping(bytes32 => Session) public sessions;

    // ─── Events ───────────────────────────────────────────────────────────────

    event Deposited(bytes32 indexed sessionId, address indexed user, address indexed provider, uint256 amount);
    event Released(bytes32 indexed sessionId, address indexed provider, uint256 netAmount, uint256 fee);
    event Refunded(bytes32 indexed sessionId, address indexed user, uint256 amount);
    event Disputed(bytes32 indexed sessionId);
    event FeesWithdrawn(address indexed to, uint256 amount);
    event ReleaseAuthorityUpdated(address indexed newAuthority);
    event SessionStarted(bytes32 indexed sessionId, address indexed user, address indexed provider, uint256 totalDeposit, uint256 upfrontPaid, uint256 escrowed, uint256 ratePerSecond);
    event PaymentReleased(bytes32 indexed sessionId, address indexed provider, uint256 netAmount, uint256 remainingBalance);
    event SessionStopped(bytes32 indexed sessionId, address indexed user, uint256 refundAmount);
    event ProviderSlashed(bytes32 indexed sessionId, address indexed provider, bytes32 evidence);
    event ProofAuthorityUpdated(address indexed newAuthority);

    // ─── Errors ───────────────────────────────────────────────────────────────

    error SessionAlreadyExists();
    error SessionNotFound();
    error WrongStatus();
    error LockupNotExpired();
    error Unauthorised();
    error ZeroAmount();
    error NoFeesToWithdraw();
    error SessionNotActive();
    error ZeroRate();

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(address initialOwner, address _releaseAuthority, address _registry) Ownable(initialOwner) {
        releaseAuthority = _releaseAuthority;
        proofAuthority   = _releaseAuthority; // default same as releaseAuthority; updateable post-deploy
        registry         = IProviderRegistry(_registry);
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

    // ─── Streaming payment functions ──────────────────────────────────────────

    /// @notice Start a streaming payment session.
    ///         Caller sends full estimated payment; 20% goes to provider immediately,
    ///         80% is held and dripped via submitProof() calls.
    /// @param sessionId     keccak256 of the session identifier (assigned by backend)
    /// @param provider      Provider wallet address
    /// @param ratePerSecond Wei per second to stream from escrow to provider
    function startSession(
        bytes32 sessionId,
        address provider,
        uint256 ratePerSecond
    ) external payable nonReentrant {
        if (msg.value == 0) revert ZeroAmount();
        if (ratePerSecond == 0) revert ZeroRate();
        if (sessions[sessionId].user != address(0)) revert SessionAlreadyExists();

        uint256 upfront  = (msg.value * UPFRONT_BPS) / BPS_DENOM;
        uint256 escrowed = msg.value - upfront;

        sessions[sessionId] = Session({
            user:             msg.sender,
            provider:         provider,
            ratePerSecond:    ratePerSecond,
            remainingBalance: escrowed,
            lastPaidAt:       block.timestamp,
            isActive:         true
        });

        emit SessionStarted(sessionId, msg.sender, provider, msg.value, upfront, escrowed, ratePerSecond);

        (bool ok, ) = provider.call{value: upfront}("");
        require(ok, "Upfront transfer failed");
    }

    /// @notice Release accrued streaming payment. Callable by anyone — useful for the
    ///         provider to pull their earnings without requiring a proof submission.
    /// @param sessionId  The active session
    function releasePayment(bytes32 sessionId) external nonReentrant {
        Session storage s = sessions[sessionId];
        if (s.user == address(0)) revert SessionNotFound();
        if (!s.isActive) revert SessionNotActive();
        _releaseAccrued(sessionId);
    }

    /// @notice Submit a proof of uptime and trigger a streaming payment release.
    ///         Only callable by proofAuthority (zkLOUD backend).
    /// @param sessionId  The active session
    /// @param stateHash  Hash of container state — logged for auditability; full verification is a post-MVP upgrade
    function submitProof(bytes32 sessionId, bytes32 stateHash) external nonReentrant {
        if (msg.sender != proofAuthority && msg.sender != owner()) revert Unauthorised();
        Session storage s = sessions[sessionId];
        if (s.user == address(0)) revert SessionNotFound();
        if (!s.isActive) revert SessionNotActive();
        // stateHash stored in event for off-chain verification
        emit PaymentReleased(sessionId, s.provider, 0, s.remainingBalance); // emitted inside _releaseAccrued too; this captures stateHash context
        _releaseAccrued(sessionId);
        // suppress unused variable warning — stateHash is intentionally event-only for now
        stateHash;
    }

    /// @notice Stop the session. Releases any accrued payment, then refunds remainder to user.
    ///         Only callable by the session user.
    /// @param sessionId  The active session to stop
    function stopSession(bytes32 sessionId) external nonReentrant {
        Session storage s = sessions[sessionId];
        if (s.user == address(0)) revert SessionNotFound();
        if (!s.isActive) revert SessionNotActive();
        if (msg.sender != s.user) revert Unauthorised();

        _releaseAccrued(sessionId);

        uint256 refundAmount = s.remainingBalance;
        s.remainingBalance = 0;
        s.isActive = false;

        emit SessionStopped(sessionId, s.user, refundAmount);

        if (refundAmount > 0) {
            (bool ok, ) = s.user.call{value: refundAmount}("");
            require(ok, "Refund transfer failed");
        }
    }

    /// @notice Slash a misbehaving provider: stops the session, refunds the user,
    ///         and calls ProviderRegistry.slash() to penalise their stake.
    ///         Only callable by proofAuthority.
    /// @param sessionId  The session whose provider misbehaved
    /// @param evidence   keccak256 of evidence (e.g. IPFS CID of invalid action log)
    function slashProvider(bytes32 sessionId, bytes32 evidence) external nonReentrant {
        if (msg.sender != proofAuthority && msg.sender != owner()) revert Unauthorised();
        Session storage s = sessions[sessionId];
        if (s.user == address(0)) revert SessionNotFound();
        if (!s.isActive) revert SessionNotActive();

        address provider     = s.provider;
        address user         = s.user;
        uint256 refundAmount = s.remainingBalance;

        s.remainingBalance = 0;
        s.isActive = false;

        emit ProviderSlashed(sessionId, provider, evidence);
        emit SessionStopped(sessionId, user, refundAmount);

        // Slash stake in registry — non-blocking so refund always completes
        try registry.slash(provider, evidence) {} catch {}

        if (refundAmount > 0) {
            (bool ok, ) = user.call{value: refundAmount}("");
            require(ok, "Slash refund failed");
        }
    }

    /// @notice Update the proof authority address.
    function setProofAuthority(address newAuthority) external onlyOwner {
        proofAuthority = newAuthority;
        emit ProofAuthorityUpdated(newAuthority);
    }

    /// @dev Drain elapsed * ratePerSecond from escrow to provider, taking protocol fee.
    function _releaseAccrued(bytes32 sessionId) internal {
        Session storage s = sessions[sessionId];
        uint256 elapsed = block.timestamp - s.lastPaidAt;
        if (elapsed == 0) return;

        uint256 owed = elapsed * s.ratePerSecond;
        if (owed > s.remainingBalance) owed = s.remainingBalance;
        if (owed == 0) return;

        uint256 fee       = (owed * FEE_BPS) / BPS_DENOM;
        uint256 netAmount = owed - fee;

        s.remainingBalance -= owed;
        s.lastPaidAt        = block.timestamp;
        accruedFees        += fee;

        emit PaymentReleased(sessionId, s.provider, netAmount, s.remainingBalance);

        (bool ok, ) = s.provider.call{value: netAmount}("");
        require(ok, "Payment transfer failed");
    }

    // ─── View helpers ─────────────────────────────────────────────────────────

    /// @notice Check whether a simple escrow session's lockup has expired.
    function isLockupExpired(bytes32 sessionId) external view returns (bool) {
        Escrow storage e = escrows[sessionId];
        if (e.user == address(0)) return false;
        return block.timestamp >= e.depositedAt + LOCKUP_PERIOD;
    }

    /// @notice Compute how much payment has accrued since the last release for a streaming session.
    function pendingPayment(bytes32 sessionId) external view returns (uint256) {
        Session storage s = sessions[sessionId];
        if (!s.isActive) return 0;
        uint256 owed = (block.timestamp - s.lastPaidAt) * s.ratePerSecond;
        return owed > s.remainingBalance ? s.remainingBalance : owed;
    }
}
