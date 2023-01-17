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
    // await run("verify:verify", {
    //   address: "0xff402fF1b143eCE3888bf26E67b0EA46011d77FD",
    //   constructorArguments: ["NFT", "NFT"],
    // });
    // await run("verify:verify", {
    //   address: "0x6BF9aF9716D95a2f3584431FA3cfDaBEa79433A9",
    //   constructorArguments: ["Token", "TKN", 8],
    // });
    await run("verify:verify", {
      address: "0xfCA41ffa7eD917993fAf30fecCeaF5C052699fa3",
      constructorArguments: [],
    });
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
