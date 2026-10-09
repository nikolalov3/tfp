// Wdrożenie RunClub. Na Base i Base Sepolia używa oficjalnego Semaphore v4,
// na sieci lokalnej wdraża Semaphore od zera.
const { ethers, network, run } = require("hardhat")

// Semaphore v4 ma ten sam adres na wszystkich wspieranych sieciach (docs: deployed-contracts).
const SEMAPHORE_V4 = "0x8A1fd199516489B0Fb7153EB5f075cDAC83c693D"

async function main() {
  const [deployer] = await ethers.getSigners()
  let semaphoreAddress = SEMAPHORE_V4

  if (network.name === "hardhat" || network.name === "localhost") {
    const { semaphore } = await run("deploy:semaphore", { logs: false })
    semaphoreAddress = await semaphore.getAddress()
  }

  const captain = process.env.CAPTAIN_ADDRESS || deployer.address
  const factory = await ethers.getContractFactory("RunClub")
  const contract = await factory.deploy(semaphoreAddress, captain)
  await contract.waitForDeployment()

  const address = await contract.getAddress()
  const groupId = await contract.groupId()
  const block = await ethers.provider.getBlockNumber()

  console.log(JSON.stringify({
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    runClub: address,
    semaphore: semaphoreAddress,
    groupId: groupId.toString(),
    captain,
    deployBlock: block
  }, null, 2))
}

main().catch((e) => { console.error(e); process.exit(1) })
