const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
require("dotenv").config();

async function main() {
  // Get network
  const network = await ethers.provider.getNetwork();
  const networkName = network.chainId === 31337 ? "hardhat" : network.name;

  // Loading accouts
  const accounts = await ethers.getSigners();
  const addresses = accounts.map((item: any) => item.address);
  const deployer = addresses[0];
  let gasPriceTotal = 0;

  // Deployed params
  const tokenName = "Token";
  const symbol = "TKN";
  const decimal = 8;

  // Loading contract factory
  // const ERC721 = await ethers.getContractFactory("TokenERC721");
  // const CashTestToken = await ethers.getContractFactory("CashTestToken");
  // const TestNFT = await ethers.getContractFactory("TestNFT");
  const Sale = await ethers.getContractFactory("Sale");

  // Deploy contracts
  console.log(
    "================================================================================"
  );
  console.log("DEPLOYING CONTRACTS");
  console.log(
    "================================================================================"
  );
  console.log("chainId           : >> ", network.chainId);
  console.log("chainName         : >> ", networkName);
  console.log("deployer          : >> ", deployer);
  console.log(
    "================================================================================"
  );
  // const erc721 = await upgrades.deployProxy(ERC721, [
  //   process.env.OWNER_WALLET_ADDRESS,
  //   tokenName,
  //   symbol,
  // ]);
  // await erc721.deployed();
  // console.log("ERC721 deployed to: >>", erc721.address);

  // const cashTestToken = await CashTestToken.deploy(tokenName, symbol, decimal);
  // await cashTestToken.deployed();
  // console.log("Cash Test Token deployed to: >>", cashTestToken.address);

  // const testNft = await TestNFT.deploy("NFT", "NFT");
  // await testNft.deployed();
  // console.log("Test NFT deployed to: >>", testNft.address);

  const sale = await upgrades.deployProxy(Sale, []);
  await sale.deployed();
  console.log("Sale deployed to: >>", sale.address);

  // const erc721Verify = await upgrades.erc1967.getImplementationAddress(
  //   erc721.address
  // );
  // console.log("ERC721 verify addr: >>", erc721Verify);
  // console.log(
  //   "ERC721 gasPrice   : >>",
  //   Number(erc721.deployTransaction.gasPrice)
  // );
  // console.log(
  //   "ERC721 gasLimit   : >>",
  //   Number(erc721.deployTransaction.gasLimit)
  // );
  // const gasUsed = await erc721.deployTransaction.wait();
  // console.log("ERC721 gasUsed	  : >> ", Number(gasUsed.gasUsed));
  // gasPriceTotal += Number(erc721.deployTransaction.gasPrice);

  // const contractAddresses = {
  //   chainId: network.chainId,
  //   deployer: deployer,
  //   erc721: erc721.address,
  //   erc721Verify: erc721Verify,
  // };

  // const dir = `./deploy-history/${network.chainId}-${networkName}`;
  // const fileName = network.chainId === 31337 ? "hardhat" : network.name;
  // if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  // await fs.writeFileSync(
  //   `${dir}/${fileName}.json`,
  //   JSON.stringify(contractAddresses, null, 2)
  // );
  // await fs.writeFileSync(
  //   "contracts.json",
  //   JSON.stringify(contractAddresses, null, 2)
  // );
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.log(error);
    process.exit(1);
  });
