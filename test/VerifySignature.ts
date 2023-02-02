import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { Contract } from "ethers";
import { ethers } from "hardhat";
import { MintParamsStruct } from "../typechain-types/contracts/ERC721";
import { AddressZero } from "@ethersproject/constants";
import { TokenType } from "./utils/constant";

const ZERO_ADDRESS = AddressZero;

describe("Verify Signature", () => {
  let verifySignature: Contract;
  let signer: SignerWithAddress;
  let government: SignerWithAddress;
  let user: SignerWithAddress;
  let stranger: SignerWithAddress;
  let artist: SignerWithAddress;

  beforeEach(async () => {
    [signer, government, stranger, user, artist] = await ethers.getSigners();

    const VerifySignature = await ethers.getContractFactory("VerifySignature");
    verifySignature = await VerifySignature.deploy();
    await verifySignature.deployed();
  });

  describe("1. Verify Mint", () => {
    it("1.1. Should verify fail when signer is wrong", async () => {
      const data: MintParamsStruct = {
        to: user.address,
        owner: government.address,
        paymentToken: ZERO_ADDRESS,
        royaltyReceiver: artist.address,
        price: ethers.utils.parseEther("1"),
        amount: ethers.utils.parseEther("1"),
        royaltyPercent: 10,
        tokenURI: "ipfs://test",
        typeToken: TokenType.Normal,
      };
      const hash = await verifySignature.getMessageHashMint(
        data.to,
        data.owner,
        data.paymentToken,
        data.royaltyReceiver,
        data.price,
        data.amount,
        data.royaltyPercent,
        data.tokenURI,
        data.typeToken
      );
      const signature = await stranger.signMessage(ethers.utils.arrayify(hash));

      expect(
        await verifySignature.verifyMint(signer.address, data, signature)
      ).to.be.equal(false);
    });

    it("1.2. Should verify fail when data is wrong", async () => {
      const wrongData: MintParamsStruct = {
        to: user.address,
        owner: government.address,
        paymentToken: ZERO_ADDRESS,
        royaltyReceiver: artist.address,
        price: ethers.utils.parseEther("2"),
        amount: ethers.utils.parseEther("1"),
        royaltyPercent: 10,
        tokenURI: "ipfs://test",
        typeToken: TokenType.Normal,
      };

      const correctData: MintParamsStruct = {
        to: user.address,
        owner: government.address,
        paymentToken: ZERO_ADDRESS,
        royaltyReceiver: artist.address,
        price: ethers.utils.parseEther("1"),
        amount: ethers.utils.parseEther("1"),
        royaltyPercent: 10,
        tokenURI: "ipfs://test",
        typeToken: TokenType.Normal,
      };

      const hash = await verifySignature.getMessageHashMint(
        wrongData.to,
        wrongData.owner,
        wrongData.paymentToken,
        wrongData.royaltyReceiver,
        wrongData.price,
        wrongData.amount,
        wrongData.royaltyPercent,
        wrongData.tokenURI,
        wrongData.typeToken
      );
      const signature = await signer.signMessage(ethers.utils.arrayify(hash));

      expect(
        await verifySignature.verifyMint(signer.address, correctData, signature)
      ).to.be.equal(false);
    });

    it("1.3. Should verify successfully", async () => {
      const data: MintParamsStruct = {
        to: user.address,
        owner: government.address,
        paymentToken: ZERO_ADDRESS,
        royaltyReceiver: artist.address,
        price: ethers.utils.parseEther("1"),
        amount: ethers.utils.parseEther("1"),
        royaltyPercent: 10,
        tokenURI: "ipfs://test",
        typeToken: TokenType.Normal,
      };

      const hash = await verifySignature.getMessageHashMint(
        data.to,
        data.owner,
        data.paymentToken,
        data.royaltyReceiver,
        data.price,
        data.amount,
        data.royaltyPercent,
        data.tokenURI,
        data.typeToken
      );
      const signature = await signer.signMessage(ethers.utils.arrayify(hash));

      expect(
        await verifySignature.verifyMint(signer.address, data, signature)
      ).to.be.equal(true);
    });
  });

  describe("2. Verify Set Token URI", () => {
    const tokenId = 1;
    const correctTokenURI = "ipfs://correct";
    const wrongTokenURI = "ipfs://wrong";

    it("2.1. Should verify fail when signer is wrong", async () => {
      const hash = await verifySignature.getMessageHashSetTokenURI(
        tokenId,
        correctTokenURI
      );
      const signature = await stranger.signMessage(ethers.utils.arrayify(hash));

      expect(
        await verifySignature.verifySetTokenURI(
          signer.address,
          tokenId,
          correctTokenURI,
          signature
        )
      ).to.be.equal(false);
    });

    it("1.2. Should verify fail when data is wrong", async () => {
      const hash = await verifySignature.getMessageHashSetTokenURI(
        tokenId,
        wrongTokenURI
      );
      const signature = await signer.signMessage(ethers.utils.arrayify(hash));

      expect(
        await verifySignature.verifySetTokenURI(
          signer.address,
          tokenId,
          correctTokenURI,
          signature
        )
      ).to.be.equal(false);
    });

    it("1.3. Should verify successfully", async () => {
      const hash = await verifySignature.getMessageHashSetTokenURI(
        tokenId,
        correctTokenURI
      );
      const signature = await signer.signMessage(ethers.utils.arrayify(hash));

      expect(
        await verifySignature.verifySetTokenURI(
          signer.address,
          tokenId,
          correctTokenURI,
          signature
        )
      ).to.be.equal(true);
    });
  });

  describe("3. Verify Set Type Of Token", () => {
    const tokenId = 1;
    const correctType = TokenType.Normal;
    const wrongType = TokenType.Furusato;

    it("3.1. Should verify fail when signer is wrong", async () => {
      const hash = await verifySignature.getMessageHashSetType(
        tokenId,
        correctType
      );
      const signature = await stranger.signMessage(ethers.utils.arrayify(hash));

      expect(
        await verifySignature.verifySetType(
          signer.address,
          tokenId,
          correctType,
          signature
        )
      ).to.be.equal(false);
    });

    it("3.2. Should verify fail when data is wrong", async () => {
      const hash = await verifySignature.getMessageHashSetType(
        tokenId,
        wrongType
      );
      const signature = await signer.signMessage(ethers.utils.arrayify(hash));

      expect(
        await verifySignature.verifySetType(
          signer.address,
          tokenId,
          correctType,
          signature
        )
      ).to.be.equal(false);
    });

    it("3.3. Should verify successfully", async () => {
      const hash = await verifySignature.getMessageHashSetType(
        tokenId,
        correctType
      );
      const signature = await signer.signMessage(ethers.utils.arrayify(hash));

      expect(
        await verifySignature.verifySetType(
          signer.address,
          tokenId,
          correctType,
          signature
        )
      ).to.be.equal(true);
    });
  });
});
