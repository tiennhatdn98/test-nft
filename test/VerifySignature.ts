import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { Contract } from "ethers";
import { ethers } from "hardhat";
import { TokenDetailStruct } from "../typechain-types/contracts/ERC721";
import { AddressZero } from "@ethersproject/constants";

const ZERO_ADDRESS = AddressZero;

describe("Verify Signature", () => {
  let verifySignature: Contract;
  let signer: SignerWithAddress;
  let stranger: SignerWithAddress;

  beforeEach(async () => {
    [signer, stranger] = await ethers.getSigners();

    const VerifySignature = await ethers.getContractFactory("VerifySignature");
    verifySignature = await VerifySignature.deploy();
    await verifySignature.deployed();
  });

  it("1. Should verify fail when signer is wrong", async () => {
    const data: TokenDetailStruct = {
      tokenId: 0,
      tokenURI: "ipfs://1.json",
      status: true,
      paymentToken: ZERO_ADDRESS,
      amount: ethers.utils.parseEther("1"),
      price: ethers.utils.parseEther("1"),
      owner: ZERO_ADDRESS,
    };
    const hash = await verifySignature.getMessageHash(
      data.tokenId,
      data.tokenURI,
      data.paymentToken,
      data.price,
      data.amount,
      data.owner,
      data.status
    );
    const signature = await stranger.signMessage(ethers.utils.arrayify(hash));

    expect(
      await verifySignature.verify(signer.address, data, signature)
    ).to.be.equal(false);
  });

  it("2. Should verify fail when data is wrong", async () => {
    const wrongData: TokenDetailStruct = {
      tokenId: 0,
      tokenURI: "ipfs://1.json",
      status: true,
      paymentToken: ZERO_ADDRESS,
      amount: ethers.utils.parseEther("1"),
      price: ethers.utils.parseEther("1"),
      owner: ZERO_ADDRESS,
    };

    const correctData: TokenDetailStruct = {
      tokenId: 0,
      tokenURI: "ipfs://abcxyz.json",
      status: true,
      paymentToken: ZERO_ADDRESS,
      amount: ethers.utils.parseEther("1"),
      price: ethers.utils.parseEther("1"),
      owner: ZERO_ADDRESS,
    };

    const hash = await verifySignature.getMessageHash(
      wrongData.tokenId,
      wrongData.tokenURI,
      wrongData.paymentToken,
      wrongData.price,
      wrongData.amount,
      wrongData.owner,
      wrongData.status
    );
    const signature = await signer.signMessage(ethers.utils.arrayify(hash));

    expect(
      await verifySignature.verify(signer.address, correctData, signature)
    ).to.be.equal(false);
  });

  it("3. Should verify successfully", async () => {
    const data: TokenDetailStruct = {
      tokenId: 0,
      tokenURI: "ipfs://1.json",
      status: true,
      paymentToken: ZERO_ADDRESS,
      amount: ethers.utils.parseEther("1"),
      price: ethers.utils.parseEther("1"),
      owner: ZERO_ADDRESS,
    };

    const hash = await verifySignature.getMessageHash(
      data.tokenId,
      data.tokenURI,
      data.paymentToken,
      data.price,
      data.amount,
      data.owner,
      data.status
    );
    const signature = await signer.signMessage(ethers.utils.arrayify(hash));

    expect(
      await verifySignature.verify(signer.address, data, signature)
    ).to.be.equal(true);
  });
});
