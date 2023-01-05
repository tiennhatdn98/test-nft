import { upgrades } from "hardhat";
import { ethers } from "hardhat";
import { expect } from "chai";
import { BigNumber, Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { TokenInputStruct } from "../../typechain-types/contracts/ERC721";

const { AddressZero, MaxUint256 } = require("@ethersproject/constants");
const ZERO_ADDRESS = AddressZero;
const MAX_UINT256 = MaxUint256;
const tokenName = "Token";
const symbol = "TKN";
const decimal = 6;
const sampleSignature =
  "0xe061bcd7ddefb1dbef4bb6e16bc0fc8f5c1edebbd3a94c3e7bfafae9966fae5936458df7c8cc4bf664641978b79d915c95db6907057f2bfe9610a323a2dad7281c";
const YEAR_TO_SECONDS = 31_556_926;
const NONEXISTENT_TOKEN_ID = 9999;
const royaltyPercentage = 10;

describe("ERC721 Integration", () => {
  let erc721: Contract;
  let cashTestToken: Contract;
  let owner: SignerWithAddress;
  let admin: SignerWithAddress;
  let verifier: SignerWithAddress;
  let royaltyReceiver: SignerWithAddress;
  let government: SignerWithAddress;
  let users: SignerWithAddress[];
  let expiration: BigNumber;
  let tokenId: BigNumber;
  let tokenInput: TokenInputStruct;

  const resetTokenInput = () => {
    tokenInput = {
      tokenId: 0,
      tokenURI: "",
      paymentToken: ZERO_ADDRESS,
      amount: 0,
      price: 0,
      owner: ZERO_ADDRESS,
      status: true,
    };
  };

  const getSignature = async (
    tokenInput: TokenInputStruct,
    signer: SignerWithAddress
  ): Promise<string> => {
    const hash = await erc721.getMessageHash(
      tokenInput.tokenId,
      tokenInput.tokenURI,
      tokenInput.paymentToken,
      tokenInput.price,
      tokenInput.amount,
      tokenInput.owner,
      tokenInput.status
    );
    const signature = await signer.signMessage(ethers.utils.arrayify(hash));
    return signature;
  };

  beforeEach(async () => {
    const ERC721 = await ethers.getContractFactory("ERC721");
    const CashTestToken = await ethers.getContractFactory("CashTestToken");
    [owner, admin, verifier, royaltyReceiver, government, ...users] =
      await ethers.getSigners();

    erc721 = await upgrades.deployProxy(ERC721, [
      owner.address,
      tokenName,
      symbol,
      YEAR_TO_SECONDS,
      royaltyReceiver.address,
      royaltyPercentage,
    ]);
    await erc721.deployed();

    cashTestToken = await CashTestToken.deploy(tokenName, symbol, decimal);
    await cashTestToken.deployed();

    await erc721.connect(owner).setAdmin(admin.address);
    await erc721.connect(admin).setVerifier(verifier.address);

    const allowance = ethers.utils.parseUnits("1000000000", decimal);
    await cashTestToken.mintFor(users[0].address, allowance);
    await cashTestToken.mintFor(users[1].address, allowance);
    await cashTestToken.mintFor(users[2].address, allowance);

    await cashTestToken.connect(users[0]).approve(erc721.address, MAX_UINT256);
    await cashTestToken.connect(users[1]).approve(erc721.address, MAX_UINT256);
    await cashTestToken.connect(users[2]).approve(erc721.address, MAX_UINT256);
    resetTokenInput();
  });

  describe("1. Mint token by paying native token => Transfer token => Local government claims => Owner of contract withdraws", () => {
    it("1.1. Should be successfull", async () => {
      // Mint token
      const price = ethers.utils.parseEther("1");
      const amount = ethers.utils.parseEther("2");
      tokenInput.tokenURI = "ipfs://1.json";
      tokenInput.price = price;
      tokenInput.amount = amount;
      tokenInput.owner = government.address;
      const signature = await getSignature(tokenInput, verifier);
      await erc721.mint(users[0].address, tokenInput, signature, {
        value: amount,
      });

      // Transfer token
      let tokenId = await erc721.lastId();
      await expect(
        erc721.connect(users[0]).transfer(users[1].address, tokenId)
      ).changeTokenBalances(
        erc721,
        [users[0].address, users[1].address],
        [-1, 1]
      );
      expect(await erc721.ownerOf(tokenId)).to.be.equal(users[1].address);

      // Local government claims
      await expect(
        erc721.claim(ZERO_ADDRESS, government.address, tokenInput.price)
      ).changeEtherBalances(
        [erc721.address, government.address],
        [price.mul(-1), price]
      );

      // Someone transfers to contract
      // const donation = ethers.utils.parseEther("1.5");
      // console.log(donation);
      // await users[1].sendTransaction({ to: erc721.address, value: donation });

      // Owner withdraws
      const withdrawableAmount = amount.sub(price);
      await expect(
        erc721
          .connect(owner)
          .withdraw(ZERO_ADDRESS, owner.address, withdrawableAmount)
      ).changeEtherBalances(
        [erc721.address, owner.address],
        [withdrawableAmount.mul(-1), withdrawableAmount]
      );
    });
  });
});
