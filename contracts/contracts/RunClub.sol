// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {ISemaphore} from "@semaphore-protocol/contracts/interfaces/ISemaphore.sol";

/// @title RunClub — rejestr członków klubu biegowego
/// @notice Lista biegaczy trzymana jako grupa Semaphore v4. Do klubu wchodzi się
///         wyłącznie z polecenia obecnego członka. Polecenie to anonimowy dowód
///         członkostwa, którego wiadomością jest identyfikator nowego biegacza.
///         Każdy członek ma stały limit poleceń na sezon (30 dni), wymuszony przez
///         nullifiery Semaphore: scope = (sezon, slot), więc ten sam biegacz nie
///         użyje slotu dwa razy. Kontrakt nie wie, kto poleca. Wie, że poleca członek.
contract RunClub {
    ISemaphore public immutable semaphore;
    uint256 public immutable groupId;
    uint256 public immutable foundedAt;

    /// @dev Długość sezonu poleceń.
    uint256 public constant SEASON = 30 days;
    /// @dev Ile osób może polecić jeden członek w sezonie.
    uint256 public constant INVITES_PER_SEASON = 2;
    /// @dev Jak długo stary korzeń drzewa jest akceptowany (klient buduje dowód z pobranej listy).
    uint256 public constant MERKLE_TREE_DURATION = 1 days;

    /// @notice Kapitan dodaje tylko skład założycielski i potem zrzeka się roli.
    address public captain;

    event RunnerJoined(uint256 indexed identityCommitment, uint256 indexed season, bool founding);
    event CaptainRenounced();

    error NotCaptain();
    error SlotOutOfRange();
    error BadScope();

    constructor(ISemaphore _semaphore, address _captain) {
        semaphore = _semaphore;
        captain = _captain;
        foundedAt = block.timestamp;
        groupId = _semaphore.createGroup(address(this), MERKLE_TREE_DURATION);
    }

    // ---------------------------------------------------------------- widoki

    function currentSeason() public view returns (uint256) {
        return (block.timestamp - foundedAt) / SEASON;
    }

    /// @notice Scope dowodu polecenia dla danego sezonu i slotu. Klient liczy to samo.
    function inviteScope(uint256 season, uint256 slot) public pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked("runclub:invite:", season, slot)));
    }

    // ---------------------------------------------------------- założyciele

    function addFoundingRunners(uint256[] calldata identityCommitments) external {
        if (msg.sender != captain) revert NotCaptain();
        semaphore.addMembers(groupId, identityCommitments);
        uint256 season = currentSeason();
        for (uint256 i = 0; i < identityCommitments.length; i++) {
            emit RunnerJoined(identityCommitments[i], season, true);
        }
    }

    function renounceCaptain() external {
        if (msg.sender != captain) revert NotCaptain();
        captain = address(0);
        emit CaptainRenounced();
    }

    // ------------------------------------------------------------ polecenia

    /// @notice Dołącza nowego biegacza na podstawie anonimowego dowodu członka.
    /// @param slot numer slotu polecenia w bieżącym sezonie (0..INVITES_PER_SEASON-1)
    /// @param proof dowód Semaphore: message = identyfikator nowego biegacza,
    ///              scope = inviteScope(currentSeason(), slot)
    /// @dev Może wywołać ktokolwiek (relayer), bo dowód sam się uwierzytelnia.
    function inviteRunner(uint256 slot, ISemaphore.SemaphoreProof calldata proof) external {
        if (slot >= INVITES_PER_SEASON) revert SlotOutOfRange();
        uint256 season = currentSeason();
        if (proof.scope != inviteScope(season, slot)) revert BadScope();

        // Odrzuca zły dowód, obcy korzeń i powtórny nullifier (ten sam członek, ten sam slot).
        semaphore.validateProof(groupId, proof);
        semaphore.addMember(groupId, proof.message);

        emit RunnerJoined(proof.message, season, false);
    }
}
