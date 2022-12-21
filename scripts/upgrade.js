const { ethers, upgrades } = require("hardhat");
const contracts = require("../contracts.json");

async function main() {
  //* Loading contract factory */
  const ERC721 = await ethers.getContractFactory("ERC721");

  //* Deploy contracts */
  console.log(
    "================================================================================"
  );
  console.log("UPGRADING CONTRACTS");
  console.log(
    "================================================================================"
  );

  // const admin = await upgrades.erc1967.getAdminAddress("address proxy");
  await upgrades.upgradeProxy(contracts.erc721, ERC721);
  console.log("ERC721 is upgraded");

  console.log(
    "================================================================================"
  );
  console.log("DONE");
  console.log(
    "================================================================================"
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
