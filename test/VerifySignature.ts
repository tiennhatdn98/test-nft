import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { Contract } from "ethers";
import { ethers } from "hardhat";
import { TokenInfoStruct } from "../typechain-types/contracts/ERC721";

const { AddressZero } = require("@ethersproject/constants");
const ZERO_ADDRESS = AddressZero;

describe("VerifySignature", () => {
  let verifySignature: Contract;
  let signer: SignerWithAddress;

  beforeEach(async () => {
    const VerifySignature = await ethers.getContractFactory("VerifySignature");
    verifySignature = await VerifySignature.deploy();
    await verifySignature.deployed();
  });

  it("Check signature", async () => {
    [signer] = await ethers.getSigners();

    let tokenInput1: TokenInfoStruct = {
      tokenId: 0,
      tokenURI: "ipfs://1.json",
      status: true,
      paymentToken: ZERO_ADDRESS,
      amount: ethers.utils.parseEther("1"),
      price: ethers.utils.parseEther("1"),
      owner: ZERO_ADDRESS,
    };

    let tokenInput2: TokenInfoStruct = {
      tokenId: 0,
      tokenURI: "ipfs://2.json",
      status: true,
      paymentToken: ZERO_ADDRESS,
      amount: ethers.utils.parseEther("1"),
      price: ethers.utils.parseEther("1"),
      owner: ZERO_ADDRESS,
    };

    const hash = await verifySignature.getMessageHash(
      tokenInput1.tokenId,
      tokenInput1.tokenURI,
      tokenInput1.paymentToken,
      tokenInput1.price,
      tokenInput1.amount,
      tokenInput1.owner,
      tokenInput1.status
    );
    const sig = await signer.signMessage(ethers.utils.arrayify(hash));

    // Check correct hash
    expect(
      await verifySignature.verify(signer.address, tokenInput1, sig)
    ).to.be.equal(true);

    // Check wrong hash
    expect(
      await verifySignature.verify(signer.address, tokenInput2, sig)
    ).to.be.equal(false);
  });
});
