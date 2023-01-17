import { TokenDetailStruct } from "../typechain-types/contracts/ERC721";
import { ethers, upgrades } from "hardhat";
import { expect } from "chai";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { AddressZero, MaxUint256 } from "@ethersproject/constants";
import { mintRoyaltyToken, mintToken } from "./utils/ERC721";
import * as helpers from "@nomicfoundation/hardhat-network-helpers";
import { SaleTokenStruct } from "../typechain-types/contracts/Sale";

const ZERO_ADDRESS = AddressZero;
const MAX_UINT256 = MaxUint256;
const TOKEN_NAME = "Token";
const SYMBOL = "TKN";
const DECIMALS = 6;
const YEAR_TO_SECONDS = 31_556_926;
const ROYALTY_PERCENTAGE = 10;
const royaltyPercentage = ROYALTY_PERCENTAGE * 100;
const SALE_STATUS = {
  LIVE: 0,
  CANCELLED: 1,
};
const TOKEN_STATUS = {
  AVAILABLE: 0,
  SOLD: 1,
};

describe("Sale", () => {
  let erc721: Contract;
  let cashTestToken: Contract;
  let sale: Contract;
  let owner: SignerWithAddress;
  let admin: SignerWithAddress;
  let verifier: SignerWithAddress;
  let government: SignerWithAddress;
  let artist: SignerWithAddress;
  let poor: SignerWithAddress;
  let manager: SignerWithAddress;
  let users: SignerWithAddress[];
  let tokenInput: TokenDetailStruct;
  const price = ethers.utils.parseEther("1");
  const tokenPrice = ethers.utils.parseUnits("1", DECIMALS);

  const resetTokenInput = (): void => {
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

  beforeEach(async () => {
    const ERC721 = await ethers.getContractFactory("ERC721");
    const CashTestToken = await ethers.getContractFactory("CashTestToken");
    const Sale = await ethers.getContractFactory("Sale");
    [owner, admin, verifier, government, artist, poor, manager, ...users] =
      await ethers.getSigners();

    await helpers.setBalance(poor.address, 0);

    erc721 = await upgrades.deployProxy(ERC721, [
      owner.address,
      TOKEN_NAME,
      SYMBOL,
      YEAR_TO_SECONDS,
      royaltyPercentage,
    ]);
    await erc721.deployed();

    cashTestToken = await CashTestToken.deploy(TOKEN_NAME, SYMBOL, DECIMALS);
    await cashTestToken.deployed();

    sale = await upgrades.deployProxy(Sale, [owner.address]);
    await sale.deployed();

    await erc721.connect(owner).setAdmin(admin.address);
    await erc721.connect(admin).setVerifier(verifier.address);

    const allowance = ethers.utils.parseUnits("1000000", DECIMALS);
    await cashTestToken.mintFor(users[0].address, allowance);
    await cashTestToken.mintFor(users[1].address, allowance);
    await cashTestToken.mintFor(users[2].address, allowance);

    await cashTestToken.connect(users[0]).approve(erc721.address, MAX_UINT256);
    await cashTestToken.connect(users[1]).approve(erc721.address, MAX_UINT256);
    await cashTestToken.connect(users[2]).approve(erc721.address, MAX_UINT256);
    await cashTestToken.connect(artist).approve(erc721.address, MAX_UINT256);

    resetTokenInput();
    tokenInput.tokenURI = "ipfs://test";
    tokenInput.price = price;
    tokenInput.amount = price;
    tokenInput.owner = government.address;
    await mintToken(erc721, users[0], users[0].address, tokenInput, verifier);
    await mintRoyaltyToken(
      erc721,
      users[0],
      users[0].address,
      tokenInput,
      artist.address,
      verifier
    );

    tokenInput.paymentToken = cashTestToken.address;
    tokenInput.price = tokenPrice;
    tokenInput.amount = tokenPrice;
    await mintToken(erc721, users[0], users[0].address, tokenInput, verifier);
    await mintRoyaltyToken(
      erc721,
      users[0],
      users[0].address,
      tokenInput,
      artist.address,
      verifier
    );
  });

  describe("1. Create Sale", async () => {
    it("1.1. Should be fail when token contract address is zero address", async () => {
      const tokenIds = [1, 2, 3, 4];
      const prices = [price, price, tokenPrice, tokenPrice];
      const tokenPayments = [
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        cashTestToken.address,
        cashTestToken.address,
      ];
      await expect(
        sale
          .connect(manager)
          .create(ZERO_ADDRESS, tokenIds, tokenPayments, prices)
      ).to.be.revertedWith("Invalid token address");
    });

    it("1.2. Should be fail when token IDs is empty", async () => {
      const prices = [price, price, tokenPrice, tokenPrice];
      const tokenPayments = [
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        cashTestToken.address,
        cashTestToken.address,
      ];
      await expect(
        sale.connect(manager).create(erc721.address, [], tokenPayments, prices)
      ).to.be.revertedWith("Empty token ids");
    });

    it("1.3. Should be fail when create a sale with more than 50 token IDs", async () => {
      const tokenIds = Array.from(Array(51).keys());
      const prices = [price, price, tokenPrice, tokenPrice];
      const tokenPayments = [
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        cashTestToken.address,
        cashTestToken.address,
      ];
      await expect(
        sale
          .connect(manager)
          .create(erc721.address, tokenIds, tokenPayments, prices)
      ).to.be.revertedWith("Limit length");
    });

    it("1.4. Should be fail when token IDs, prices and token payments are not same length", async () => {
      const tokenIds = [1];
      const prices = [price, price];
      const tokenPayments = [
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        cashTestToken.address,
        cashTestToken.address,
      ];
      await expect(
        sale
          .connect(manager)
          .create(erc721.address, tokenIds, tokenPayments, prices)
      ).to.be.revertedWith("Inconsistent length");
    });

    it("1.5. Should be fail when price of token is equal 0", async () => {
      const tokenIds = [1];
      const prices = [0];
      const tokenPayments = [ZERO_ADDRESS];
      await expect(
        sale
          .connect(manager)
          .create(erc721.address, tokenIds, tokenPayments, prices)
      ).to.be.revertedWith("Invalid price");
    });

    it("1.6. Should create successfully", async () => {
      const tokenIds = [1, 2, 3, 4];
      const prices = [price, price, tokenPrice, tokenPrice];
      const tokenPayments = [
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        cashTestToken.address,
        cashTestToken.address,
      ];
      await expect(
        sale
          .connect(manager)
          .create(cashTestToken.address, tokenIds, tokenPayments, prices)
      ).to.emit(sale, "Created");

      const saleId = await sale.lastId();
      const saleDetail = await sale.sales(saleId);

      expect(saleDetail.token).to.be.equal(cashTestToken.address);
      expect(saleDetail.manager).to.be.equal(manager.address);
      expect(saleDetail.status).to.be.equal(SALE_STATUS.LIVE);
      expect(await sale.getTokenIds(1)).to.be.deep.equal(tokenIds);
    });
  });

  describe.only("2. Update", () => {
    beforeEach(async () => {
      const tokenIds = [1, 2, 3, 4];
      const prices = [price, price, tokenPrice, tokenPrice];
      const tokenPayments = [
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        cashTestToken.address,
        cashTestToken.address,
      ];
      await sale
        .connect(manager)
        .create(cashTestToken.address, tokenIds, tokenPayments, prices);
    });

    it("2.1. Should be fail when update nonexistent sale", async () => {
      await expect(sale.connect(manager).update(2, [])).to.be.revertedWith(
        "Nonexistent sale"
      );
    });

    it("2.2. Should be fail when caller is not manager of sale", async () => {
      await expect(sale.connect(owner).update(1, [])).to.be.revertedWith(
        "Caller is must be manager of sale"
      );
    });

    it("2.3. Should be fail when sale is cancelled", async () => {
      await sale.connect(manager).cancel(1);
      await expect(sale.connect(manager).update(1, [])).to.be.revertedWith(
        "Sale was cancelled"
      );
    });

    it("2.4. Should be fail when token IDs is empty", async () => {
      await expect(sale.connect(manager).update(1, [])).to.be.revertedWith(
        "Empty token ids"
      );
    });

    it("2.5. Should be fail when update more than 50 sale tokens", async () => {
      const saleToken: SaleTokenStruct = {
        tokenId: 1,
        paymentToken: cashTestToken.address,
        price: 1,
        status: TOKEN_STATUS.AVAILABLE,
      };
      let saleTokens: SaleTokenStruct[] = [];
      for (let i = 0; i < 51; i++) {
        saleTokens.push(saleToken);
      }
      await expect(
        sale.connect(manager).update(1, saleTokens)
      ).to.be.revertedWith("Limit length");
    });

    it.only("2.6. Should be fail when update a sale with token is sold", async () => {
      await sale.connect(users[1]).buy(1, 1);
    });
  });
});
