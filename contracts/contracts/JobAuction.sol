// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IProviderRegistry {
    struct Provider {
        address wallet;
        string  endpoint;
        uint256 pricePerHour;
        uint256 stakedAmount;
        uint256 jobsCompleted;
        bool    active;
    }
    function getActiveProviders() external view returns (Provider[] memory);
}

interface IDeploymentEscrow {
    function startSession(bytes32 sessionId, address provider, uint256 ratePerSecond) external payable;
}

/// @title JobAuction
/// @notice On-chain request-for-quote auction for COMPUT3 deployment jobs.
///
///         Flow:
///           1. User calls postJob() with ETH deposit and job specs.
///              A bid window opens (default 30 seconds on Base for low latency).
///           2. Any active staked provider calls submitBid() with their price.
///           3. After the bid window, anyone calls closeAuction() which selects
///              the lowest-price bid and forwards funds to DeploymentEscrow.startSession().
///           4. If no bids arrive, user calls cancelJob() to reclaim their deposit.
///
///         The JobAuction contract is intentionally a thin routing layer —
///         all payment enforcement (streaming, slashing, refund) is handled by
///         DeploymentEscrow, and all provider stake enforcement by ProviderRegistry.

contract JobAuction is Ownable, ReentrancyGuard {
    // ─── Constants ────────────────────────────────────────────────────────────

    /// @notice How long the bid window stays open after postJob()
    uint256 public constant BID_WINDOW = 30 seconds;

    /// @notice Minimum stake a provider must hold in ProviderRegistry to bid
    uint256 public constant MIN_STAKE = 0.01 ether;

    // ─── Types ────────────────────────────────────────────────────────────────

    enum JobStatus { Open, Awarded, Cancelled }

    struct JobRequest {
        address user;
        uint256 depositedAt;      // timestamp when job was posted
        uint256 maxPricePerHour;  // user's ceiling price (wei/hr)
        uint256 ramMb;            // requested RAM
        uint256 cpuCores;         // requested CPU cores
        uint256 durationSeconds;  // estimated session length
        JobStatus status;
        address winningProvider;
        uint256 winningRatePerSecond;
    }

    struct Bid {
        address provider;
        uint256 pricePerHour;     // wei per hour offered
        uint256 submittedAt;
    }

    // ─── State ────────────────────────────────────────────────────────────────

    IProviderRegistry public immutable registry;
    IDeploymentEscrow public immutable escrow;

    /// @notice COMPUT3's own provider node — used as fallback when no bids arrive
    address public fallbackProvider;

    /// @dev jobId → JobRequest
    mapping(bytes32 => JobRequest) public jobs;

    /// @dev jobId → list of bids
    mapping(bytes32 => Bid[]) public bids;

    /// @dev jobId → provider → has bid (prevent duplicate bids)
    mapping(bytes32 => mapping(address => bool)) public hasBid;

    // ─── Events ───────────────────────────────────────────────────────────────

    event FallbackProviderUpdated(address indexed newFallback);
    event JobAwardedToFallback(bytes32 indexed jobId, address indexed fallback, uint256 ratePerSecond);
    event JobPosted(
        bytes32 indexed jobId,
        address indexed user,
        uint256 maxPricePerHour,
        uint256 ramMb,
        uint256 cpuCores,
        uint256 durationSeconds,
        uint256 deposit,
        uint256 bidDeadline
    );
    event BidSubmitted(bytes32 indexed jobId, address indexed provider, uint256 pricePerHour);
    event JobAwarded(bytes32 indexed jobId, address indexed winner, uint256 pricePerHour, uint256 ratePerSecond);
    event JobCancelled(bytes32 indexed jobId, address indexed user, uint256 refunded);

    // ─── Errors ───────────────────────────────────────────────────────────────

    error JobAlreadyExists();
    error JobNotFound();
    error WrongStatus();
    error BidWindowOpen();
    error BidWindowClosed();
    error DuplicateBid();
    error BidAboveCeiling();
    error NotJobOwner();
    error InsufficientStake();
    error ZeroDeposit();
    error ZeroDuration();
    error NoFallbackProvider();

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(address initialOwner, address _registry, address _escrow, address _fallbackProvider) Ownable(initialOwner) {
        registry         = IProviderRegistry(_registry);
        escrow           = IDeploymentEscrow(_escrow);
        fallbackProvider = _fallbackProvider;
    }

    // ─── User actions ─────────────────────────────────────────────────────────

    /// @notice Post a new deployment job and open the bid window.
    ///         Caller deposits ETH; this is forwarded to DeploymentEscrow on award.
    /// @param jobId            keccak256 of the session identifier (assigned by backend)
    /// @param maxPricePerHour  Maximum wei/hr the user is willing to pay
    /// @param ramMb            Required RAM in megabytes
    /// @param cpuCores         Required CPU cores
    /// @param durationSeconds  Estimated session duration (used to compute ratePerSecond)
    function postJob(
        bytes32 jobId,
        uint256 maxPricePerHour,
        uint256 ramMb,
        uint256 cpuCores,
        uint256 durationSeconds
    ) external payable nonReentrant {
        if (msg.value == 0) revert ZeroDeposit();
        if (durationSeconds == 0) revert ZeroDuration();
        if (jobs[jobId].user != address(0)) revert JobAlreadyExists();

        uint256 deadline = block.timestamp + BID_WINDOW;

        jobs[jobId] = JobRequest({
            user:                 msg.sender,
            depositedAt:          block.timestamp,
            maxPricePerHour:      maxPricePerHour,
            ramMb:                ramMb,
            cpuCores:             cpuCores,
            durationSeconds:      durationSeconds,
            status:               JobStatus.Open,
            winningProvider:      address(0),
            winningRatePerSecond: 0
        });

        emit JobPosted(jobId, msg.sender, maxPricePerHour, ramMb, cpuCores, durationSeconds, msg.value, deadline);
    }

    /// @notice Cancel an open job with no bids after the bid window closes, or
    ///         an open job at any time if no bids have been submitted yet.
    ///         Refunds the full deposit to the user.
    /// @param jobId  The job to cancel
    function cancelJob(bytes32 jobId) external nonReentrant {
        JobRequest storage j = jobs[jobId];
        if (j.user == address(0)) revert JobNotFound();
        if (j.status != JobStatus.Open) revert WrongStatus();
        if (msg.sender != j.user) revert NotJobOwner();

        // Allow cancel any time if no bids, otherwise only after window closes
        bool windowClosed = block.timestamp > j.depositedAt + BID_WINDOW;
        if (!windowClosed && bids[jobId].length > 0) revert BidWindowOpen();

        j.status = JobStatus.Cancelled;
        uint256 refund = address(this).balance; // all ETH held for this job

        emit JobCancelled(jobId, j.user, refund);

        (bool ok, ) = j.user.call{value: refund}("");
        require(ok, "Refund failed");
    }

    // ─── Provider actions ─────────────────────────────────────────────────────

    /// @notice Submit a bid for an open job.
    ///         Provider must be active and staked in ProviderRegistry.
    ///         Bid must be at or below the user's maxPricePerHour.
    /// @param jobId         The job to bid on
    /// @param pricePerHour  Wei per hour the provider is offering
    function submitBid(bytes32 jobId, uint256 pricePerHour) external {
        JobRequest storage j = jobs[jobId];
        if (j.user == address(0)) revert JobNotFound();
        if (j.status != JobStatus.Open) revert WrongStatus();
        if (block.timestamp > j.depositedAt + BID_WINDOW) revert BidWindowClosed();
        if (hasBid[jobId][msg.sender]) revert DuplicateBid();
        if (pricePerHour > j.maxPricePerHour) revert BidAboveCeiling();
        _requireSufficientStake(msg.sender);

        hasBid[jobId][msg.sender] = true;
        bids[jobId].push(Bid({
            provider:    msg.sender,
            pricePerHour: pricePerHour,
            submittedAt: block.timestamp
        }));

        emit BidSubmitted(jobId, msg.sender, pricePerHour);
    }

    // ─── Settlement ───────────────────────────────────────────────────────────

    /// @notice Close the auction after the bid window and award to the lowest bidder.
    ///         Forwards the deposited ETH to DeploymentEscrow.startSession() with
    ///         the winning provider and computed ratePerSecond.
    ///         Callable by anyone once the window has closed.
    /// @param jobId  The job to settle
    function closeAuction(bytes32 jobId) external nonReentrant {
        JobRequest storage j = jobs[jobId];
        if (j.user == address(0)) revert JobNotFound();
        if (j.status != JobStatus.Open) revert WrongStatus();
        if (block.timestamp <= j.depositedAt + BID_WINDOW) revert BidWindowOpen();

        uint256 deposit = address(this).balance;

        // ── Fallback: no bids → award to COMPUT3's own node ──────────────────
        if (bids[jobId].length == 0) {
            if (fallbackProvider == address(0)) revert NoFallbackProvider();

            // Use user's maxPricePerHour as the rate for the fallback
            uint256 fallbackRate = j.maxPricePerHour / 3600;
            if (fallbackRate == 0) fallbackRate = 1;

            j.status               = JobStatus.Awarded;
            j.winningProvider      = fallbackProvider;
            j.winningRatePerSecond = fallbackRate;

            emit JobAwardedToFallback(jobId, fallbackProvider, fallbackRate);
            escrow.startSession{value: deposit}(jobId, fallbackProvider, fallbackRate);
            return;
        }

        // ── Normal path: pick lowest bid ─────────────────────────────────────
        Bid memory winner = bids[jobId][0];
        for (uint256 i = 1; i < bids[jobId].length; i++) {
            Bid memory b = bids[jobId][i];
            if (b.pricePerHour < winner.pricePerHour ||
                (b.pricePerHour == winner.pricePerHour && b.submittedAt < winner.submittedAt)) {
                winner = b;
            }
        }

        // Convert pricePerHour (wei/hr) → ratePerSecond (wei/s)
        uint256 ratePerSecond = winner.pricePerHour / 3600;
        if (ratePerSecond == 0) ratePerSecond = 1; // floor at 1 wei/s

        j.status               = JobStatus.Awarded;
        j.winningProvider      = winner.provider;
        j.winningRatePerSecond = ratePerSecond;

        emit JobAwarded(jobId, winner.provider, winner.pricePerHour, ratePerSecond);

        // Forward to DeploymentEscrow — starts streaming session immediately
        escrow.startSession{value: deposit}(jobId, winner.provider, ratePerSecond);
    }

    // ─── View helpers ─────────────────────────────────────────────────────────

    /// @notice Return all bids for a job.
    function getBids(bytes32 jobId) external view returns (Bid[] memory) {
        return bids[jobId];
    }

    /// @notice Return the current lowest bid for an open job (off-chain UI helper).
    function lowestBid(bytes32 jobId) external view returns (address provider, uint256 pricePerHour) {
        Bid[] storage b = bids[jobId];
        if (b.length == 0) return (address(0), 0);
        Bid memory best = b[0];
        for (uint256 i = 1; i < b.length; i++) {
            if (b[i].pricePerHour < best.pricePerHour) best = b[i];
        }
        return (best.provider, best.pricePerHour);
    }

    /// @notice Whether the bid window is still open for a job.
    function isBidWindowOpen(bytes32 jobId) external view returns (bool) {
        JobRequest storage j = jobs[jobId];
        if (j.user == address(0)) return false;
        return j.status == JobStatus.Open && block.timestamp <= j.depositedAt + BID_WINDOW;
    }

    /// @notice Update the COMPUT3 fallback provider address. Only owner.
    function setFallbackProvider(address newFallback) external onlyOwner {
        fallbackProvider = newFallback;
        emit FallbackProviderUpdated(newFallback);
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    /// @dev Reverts if the caller doesn't meet MIN_STAKE in ProviderRegistry.
    function _requireSufficientStake(address provider) internal view {
        IProviderRegistry.Provider[] memory active = registry.getActiveProviders();
        for (uint256 i = 0; i < active.length; i++) {
            if (active[i].wallet == provider) {
                if (active[i].stakedAmount < MIN_STAKE) revert InsufficientStake();
                return;
            }
        }
        revert InsufficientStake(); // not found in active providers
    }
}
