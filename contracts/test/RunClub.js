const { expect } = require("chai")
const { ethers, run } = require("hardhat")
const { time } = require("@nomicfoundation/hardhat-network-helpers")
const { Identity, Group, generateProof } = require("@semaphore-protocol/core")

const SEASON = 30 * 24 * 60 * 60

function inviteScope(season, slot) {
  // To samo co w kontrakcie: keccak256(abi.encodePacked("runclub:invite:", season, slot))
  return BigInt(ethers.solidityPackedKeccak256(["string", "uint256", "uint256"], ["runclub:invite:", season, slot]))
}

describe("RunClub", function () {
  let semaphore, club, captain, relayer, outsider
  let alice, bob, carol, dave
  let group // lustro grupy on-chain po stronie klienta

  async function proveInvite(inviter, invitee, slot) {
    const season = await club.currentSeason()
    return generateProof(inviter, group, invitee.commitment, inviteScope(season, slot))
  }

  before(async function () {
    ;[captain, relayer, outsider] = await ethers.getSigners()
    ;({ semaphore } = await run("deploy:semaphore", { logs: false }))
    const factory = await ethers.getContractFactory("RunClub")
    club = await factory.deploy(await semaphore.getAddress(), captain.address)
    await club.waitForDeployment()

    alice = new Identity()
    bob = new Identity()
    carol = new Identity()
    dave = new Identity()
    group = new Group()
  })

  it("tworzy grupę Semaphore, której adminem jest kontrakt", async function () {
    expect(await club.groupId()).to.equal(0n)
    expect(await semaphore.getGroupAdmin(0)).to.equal(await club.getAddress())
  })

  it("skład założycielski dodaje kapitan, nikt inny", async function () {
    await expect(club.connect(outsider).addFoundingRunners([alice.commitment])).to.be.revertedWithCustomError(club, "NotCaptain")

    await expect(club.addFoundingRunners([alice.commitment, bob.commitment]))
      .to.emit(club, "RunnerJoined").withArgs(alice.commitment, 0, true)
      .and.to.emit(club, "RunnerJoined").withArgs(bob.commitment, 0, true)

    group.addMembers([alice.commitment, bob.commitment])
    expect(await semaphore.getMerkleTreeRoot(0)).to.equal(group.root)
    expect(await semaphore.getMerkleTreeSize(0)).to.equal(2n)
  })

  it("członek poleca nowego biegacza anonimowym dowodem, wysłanym przez relayera", async function () {
    const proof = await proveInvite(alice, carol, 0)

    await expect(club.connect(relayer).inviteRunner(0, proof))
      .to.emit(club, "RunnerJoined").withArgs(carol.commitment, 0, false)

    group.addMember(carol.commitment)
    expect(await semaphore.getMerkleTreeRoot(0)).to.equal(group.root)
    expect(await semaphore.getMerkleTreeSize(0)).to.equal(3n)
  })

  it("ten sam członek nie użyje tego samego slotu dwa razy w sezonie", async function () {
    const proof = await proveInvite(alice, dave, 0)
    await expect(club.inviteRunner(0, proof)).to.be.revertedWithCustomError(semaphore, "Semaphore__YouAreUsingTheSameNullifierTwice")
  })

  it("drugi slot działa, trzeciego nie ma", async function () {
    const proof = await proveInvite(alice, dave, 1)
    await expect(club.inviteRunner(1, proof)).to.emit(club, "RunnerJoined").withArgs(dave.commitment, 0, false)
    group.addMember(dave.commitment)

    const extra = new Identity()
    await expect(club.inviteRunner(2, await proveInvite(alice, extra, 1))).to.be.revertedWithCustomError(club, "SlotOutOfRange")
  })

  it("odrzuca dowód ze złym scope (slot z innego sezonu)", async function () {
    const extra = new Identity()
    const proof = await generateProof(bob, group, extra.commitment, inviteScope(99n, 0))
    await expect(club.inviteRunner(0, proof)).to.be.revertedWithCustomError(club, "BadScope")
  })

  it("odrzuca dowód z podmienioną wiadomością (identyfikatorem)", async function () {
    const extra = new Identity()
    const proof = await proveInvite(bob, extra, 0)
    const tampered = { ...proof, message: new Identity().commitment }
    await expect(club.inviteRunner(0, tampered)).to.be.revertedWithCustomError(semaphore, "Semaphore__InvalidProof")
  })

  it("odrzuca dowód osoby spoza klubu", async function () {
    const stranger = new Identity()
    const fakeGroup = new Group([...group.members, stranger.commitment])
    const season = await club.currentSeason()
    const proof = await generateProof(stranger, fakeGroup, new Identity().commitment, inviteScope(season, 0))
    await expect(club.inviteRunner(0, proof)).to.be.revertedWithCustomError(semaphore, "Semaphore__MerkleTreeRootIsNotPartOfTheGroup")
  })

  it("w nowym sezonie limit poleceń się odnawia", async function () {
    await time.increase(SEASON)
    expect(await club.currentSeason()).to.equal(1n)

    const extra = new Identity()
    const proof = await proveInvite(alice, extra, 0)
    await expect(club.inviteRunner(0, proof)).to.emit(club, "RunnerJoined").withArgs(extra.commitment, 1, false)
    group.addMember(extra.commitment)
  })

  it("nowo polecony biegacz może sam polecać", async function () {
    const extra = new Identity()
    const proof = await proveInvite(carol, extra, 0)
    await expect(club.inviteRunner(0, proof)).to.emit(club, "RunnerJoined").withArgs(extra.commitment, 1, false)
    group.addMember(extra.commitment)
  })

  it("po zrzeczeniu się kapitana skład założycielski jest zamknięty na zawsze", async function () {
    await expect(club.connect(outsider).renounceCaptain()).to.be.revertedWithCustomError(club, "NotCaptain")
    await expect(club.renounceCaptain()).to.emit(club, "CaptainRenounced")
    expect(await club.captain()).to.equal(ethers.ZeroAddress)
    await expect(club.addFoundingRunners([new Identity().commitment])).to.be.revertedWithCustomError(club, "NotCaptain")
  })
})
