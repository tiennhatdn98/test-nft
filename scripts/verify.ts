import { run } from "hardhat";
const contracts = require("../contracts.json");

async function main() {
  // const jobs = [
  //   // run("verify:verify", {
  //   //   address: contracts.erc721Verify,
  //   //   constructorArguments: [],
  //   // }),
  //   run("verify:verify", {
  //     address: "0x83f0076E253009d5462b1695C748cfF490d6Ca77",
  //   }),
  // ];
  try {
    // await run("verify:verify", {
    //   address: "0x83f0076E253009d5462b1695C748cfF490d6Ca77",
    //   constructorArguments: ["Token", "TKN", 8],
    // });
    // await run("verify:verify", {
    //   address: "0x0a7093d399e8Fccb33bDB6bBF0870A1924d7cC26",
    //   constructorArguments: ["NFT", "NFT"],
    // });
  } catch (error) {
    console.log("Error: >> ", error);
  }

  // await Promise.all(
  //   jobs.map((job) => job.catch((error) => console.log(error)))
  // );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
