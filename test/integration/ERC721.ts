import { upgrades, ethers } from "hardhat";
import { expect } from "chai";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import * as helpers from "@nomicfoundation/hardhat-network-helpers";
import { MintParamsStruct } from "./../../typechain-types/contracts/ERC721";
import { getSignatureMint } from "../utils/ERC721";
import { TokenType } from "../utils/constant";
import {
  ZERO_ADDRESS,
  MAX_UINT256,
  TOKEN_NAME,
  SYMBOL,
  DECIMALS,
  ROYALTY_PERCENTAGE,
} from "../utils/constant";

const royaltyPercentage = ROYALTY_PERCENTAGE * 100;

describe("ERC721 Integration", () => {
  let erc721: Contract;
  let cashTestToken: Contract;
  let owner: SignerWithAddress;
  let admin: SignerWithAddress;
  let verifier: SignerWithAddress;
  let royaltyReceiver: SignerWithAddress;
  let government: SignerWithAddress;
  let users: SignerWithAddress[];
  let params: MintParamsStruct;

  const initParams = () => {
    params = {
      to: users[0].address,
      owner: government.address,
      paymentToken: ZERO_ADDRESS,
      price: ethers.utils.parseEther("1"),
      amount: ethers.utils.parseEther("1"),
      expiredYears: 1,
      tokenURI: "ipfs://test",
      typeToken: TokenType.Normal,
    };
  };

  beforeEach(async () => {
    const ERC721 = await ethers.getContractFactory("ERC721");
    const CashTestToken = await ethers.getContractFactory("CashTestToken");
    [owner, admin, verifier, royaltyReceiver, government, artist, ...users] =
      await ethers.getSigners();
    users.forEach(async (user) => {
      await helpers.setBalance(user.address, 100n ** 18n);
    });

    erc721 = await upgrades.deployProxy(ERC721, [
      owner.address,
      TOKEN_NAME,
      SYMBOL,
      royaltyPercentage,
    ]);
    await erc721.deployed();

    cashTestToken = await CashTestToken.deploy(TOKEN_NAME, SYMBOL, DECIMALS);
    await cashTestToken.deployed();

    await erc721.connect(owner).setAdmin(admin.address);
    await erc721.connect(admin).setVerifier(verifier.address);

    const allowance = ethers.utils.parseUnits("1000000", DECIMALS);
    await cashTestToken.mintFor(users[0].address, allowance);
    await cashTestToken.mintFor(users[1].address, allowance);
    await cashTestToken.mintFor(users[2].address, allowance);

    await cashTestToken.connect(users[0]).approve(erc721.address, MAX_UINT256);
    await cashTestToken.connect(users[1]).approve(erc721.address, MAX_UINT256);
    await cashTestToken.connect(users[2]).approve(erc721.address, MAX_UINT256);
    await cashTestToken
      .connect(royaltyReceiver)
      .approve(erc721.address, MAX_UINT256);

    initParams();
  });

  it("1.1. Mint token by paying native token => Transfer token => Owner of contract withdraws", async () => {
    // Mint token
    const price = ethers.utils.parseEther("1");
    const amount = ethers.utils.parseEther("2");
    const balanceOfOwner = await ethers.provider.getBalance(government.address);
    params.price = price;
    params.amount = amount;
    const signature = await getSignatureMint(erc721, params, verifier);
    await erc721.connect(users[0]).mint(users[0].address, params, signature, {
      value: amount,
    });

    expect(await ethers.provider.getBalance(government.address)).to.be.equal(
      balanceOfOwner.add(params.price)
    );

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

  it("1.2. Mint token by paying test cash token => Transfer token => Owner of contract withdraws", async () => {
    // Mint token
    const price = ethers.utils.parseUnits("1", DECIMALS);
    const amount = ethers.utils.parseUnits("2", DECIMALS);
    const balanceOfOwner = await cashTestToken.balanceOf(government.address);
    params.paymentToken = cashTestToken.address;
    params.price = price;
    params.amount = amount;
    const signature = await getSignatureMint(erc721, params, verifier);
    await erc721.connect(users[0]).mint(users[0].address, params, signature);

    expect(await cashTestToken.balanceOf(government.address)).to.be.equal(
      balanceOfOwner.add(params.price)
    );

    let tokenId = await erc721.lastId();
    const [_, royaltyFraction] = await erc721.royaltyInfo(
      tokenId,
      params.price
    );

    expect(await erc721.ownerOf(tokenId)).to.be.equal(users[0].address);

    // User0 transfers token to User1
    await expect(erc721.connect(users[0]).transfer(users[1].address, tokenId))
      .changeTokenBalances(
        erc721,
        [users[0].address, users[1].address],
        [-1, 1]
      )
      .changeTokenBalances(
        cashTestToken,
        [
          erc721.address,
          users[1].address,
          users[0].address,
          government.address,
        ],
        [royaltyFraction.mul(-1), 0, 0, royaltyFraction]
      )
      .changeEtherBalances(
        [
          erc721.address,
          users[1].address,
          users[0].address,
          government.address,
        ],
        [0, 0, 0, 0]
      );
    expect(await erc721.ownerOf(tokenId)).to.be.equal(users[1].address);

    // Owner withdraws
    const withdrawableAmount = amount.sub(price);
    await expect(
      erc721
        .connect(owner)
        .withdraw(cashTestToken.address, owner.address, withdrawableAmount)
    )
      .changeTokenBalances(
        cashTestToken,
        [erc721.address, owner.address],
        [withdrawableAmount.mul(-1), withdrawableAmount]
      )
      .changeEtherBalances([erc721.address, owner.address], [0, 0]);
  });

  it("1.3. A user buys a token => Someone buys this token => Money will be transfered properly", async () => {
    // Mint token
    const balanceOfOwner = await cashTestToken.balanceOf(government.address);
    params.paymentToken = cashTestToken.address;
    params.price = ethers.utils.parseUnits("1", DECIMALS);
    params.amount = ethers.utils.parseUnits("2", DECIMALS);
    const signature = await getSignatureMint(erc721, params, verifier);
    await erc721.connect(users[0]).mint(users[0].address, params, signature);
    expect(await cashTestToken.balanceOf(government.address)).to.be.equal(
      balanceOfOwner.add(params.price)
    );

    const [royaltyAddress, royaltyFraction] = await erc721.royaltyInfo(
      1,
      params.price
    );

    // User1 buys token
    await expect(erc721.connect(users[1]).buy(1))
      .changeTokenBalances(
        erc721,
        [users[0].address, users[1].address],
        [-1, 1]
      )
      .changeTokenBalances(
        cashTestToken,
        [users[0].address, users[1].address, royaltyAddress],
        [
          params.price.sub(royaltyFraction),
          params.price.mul(-1),
          royaltyFraction,
        ]
      );
    expect(government.address).to.be.equal(royaltyAddress);

    // Owner withdraws
    const withdrawableAmount = params.amount.sub(params.price);
    await expect(
      erc721.withdraw(cashTestToken.address, owner.address, withdrawableAmount)
    ).changeTokenBalances(
      cashTestToken,
      [erc721.address, owner.address],
      [withdrawableAmount.mul(-1), withdrawableAmount]
    );
  });
});
