import { run } from "hardhat";
const contracts = require("../contracts.json");

async function main() {
  const jobs = [
    run("verify:verify", {
      address: contracts.erc721Verify,
      constructorArguments: [],
    }),
  ];

  await Promise.all(
    jobs.map((job) => job.catch((error) => console.log(error)))
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
