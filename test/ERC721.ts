import { TokenDetailStruct } from "../typechain-types/contracts/ERC721";
import { ethers, upgrades } from "hardhat";
import { expect } from "chai";
import { BigNumber, Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { blockTimestamp } from "./utils";
import { AddressZero, MaxUint256 } from "@ethersproject/constants";
import { getSignature, mintRoyaltyToken, mintToken } from "./utils/ERC721";
import * as helpers from "@nomicfoundation/hardhat-network-helpers";

const ZERO_ADDRESS = AddressZero;
const MAX_UINT256 = MaxUint256;
const TOKEN_NAME = "Token";
const SYMBOL = "TKN";
const DECIMALS = 6;
const YEAR_TO_SECONDS = 31_556_926;
const NONEXISTENT_TOKEN_ID = 9999;
const ROYALTY_PERCENTAGE = 10;
const sampleSignature =
  "0xe061bcd7ddefb1dbef4bb6e16bc0fc8f5c1edebbd3a94c3e7bfafae9966fae5936458df7c8cc4bf664641978b79d915c95db6907057f2bfe9610a323a2dad7281c";
const royaltyPercentage = ROYALTY_PERCENTAGE * 100;

describe("ERC721", () => {
  let erc721: Contract;
  let cashTestToken: Contract;
  let owner: SignerWithAddress;
  let admin: SignerWithAddress;
  let verifier: SignerWithAddress;
  let government: SignerWithAddress;
  let artist: SignerWithAddress;
  let poor: SignerWithAddress;
  let users: SignerWithAddress[];
  let expiration: BigNumber;
  let tokenId: BigNumber;
  let tokenInput: TokenDetailStruct;

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
    [owner, admin, verifier, government, artist, poor, ...users] =
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

    await erc721.connect(owner).setAdmin(admin.address);
    await erc721.connect(admin).setVerifier(verifier.address);
    expiration = await erc721.expiration();

    const allowance = ethers.utils.parseUnits("1000000", DECIMALS);
    await cashTestToken.mintFor(users[0].address, allowance);
    await cashTestToken.mintFor(users[1].address, allowance);
    await cashTestToken.mintFor(users[2].address, allowance);

    await cashTestToken.connect(users[0]).approve(erc721.address, MAX_UINT256);
    await cashTestToken.connect(users[1]).approve(erc721.address, MAX_UINT256);
    await cashTestToken.connect(users[2]).approve(erc721.address, MAX_UINT256);
    await cashTestToken.connect(artist).approve(erc721.address, MAX_UINT256);
  });

  describe("1. Initialize", () => {
    it("1.1. Should assign states successfully", async () => {
      expect(await erc721.owner()).to.be.equal(owner.address);
      expect(await erc721.name()).to.be.equal(TOKEN_NAME);
      expect(await erc721.symbol()).to.be.equal(SYMBOL);
      expect(await erc721.lastId()).to.be.equal(0);
      expect(await erc721.expiration()).to.be.equal(YEAR_TO_SECONDS);
      expect(await erc721.royaltyPercentage()).to.be.equal(royaltyPercentage);
    });
  });

  describe("2. Mint", () => {
    beforeEach(() => resetTokenInput());

    it("2.1. Should be fail when recipient address is zero address", async () => {
      await expect(
        erc721.mint(ZERO_ADDRESS, tokenInput, sampleSignature)
      ).to.be.revertedWith("Invalid address");
    });

    it("2.2. Should be fail when recipient address is a contract address", async () => {
      await expect(
        erc721.mint(cashTestToken.address, tokenInput, sampleSignature)
      ).to.be.revertedWith("Invalid address");
    });

    it("2.3. Should be fail when token URI is empty", async () => {
      await expect(
        erc721.mint(users[0].address, tokenInput, sampleSignature)
      ).to.be.revertedWith("Empty URI");
    });

    it("2.4. Should be fail when amount is equal 0", async () => {
      tokenInput.tokenURI = "ipfs://URI";
      tokenInput.owner = government.address;
      tokenInput.price = ethers.utils.parseEther("1");
      await expect(
        erc721.mint(users[0].address, tokenInput, sampleSignature)
      ).to.be.revertedWith("Invalid price or amount");
    });

    it("2.5. Should be fail when price is equal 0", async () => {
      tokenInput.tokenURI = "ipfs://URI";
      tokenInput.owner = government.address;
      tokenInput.amount = ethers.utils.parseEther("1");
      await expect(
        erc721.mint(users[0].address, tokenInput, sampleSignature)
      ).to.be.revertedWith("Invalid price or amount");
    });

    it("2.6. Should be fail when amount is less than price", async () => {
      tokenInput.tokenURI = "ipfs://URI";
      tokenInput.price = ethers.utils.parseEther("1");
      tokenInput.amount = ethers.utils.parseEther("0.5");
      tokenInput.owner = government.address;
      await expect(
        erc721.mint(users[0].address, tokenInput, sampleSignature, {
          value: tokenInput.amount,
        })
      ).to.be.revertedWith("Invalid price or amount");
    });

    it("2.7. Should be fail when user pays native token and msg.value is not equal amount", async () => {
      tokenInput.tokenURI = "ipfs://URI";
      tokenInput.price = ethers.utils.parseEther("1");
      tokenInput.amount = ethers.utils.parseEther("2");
      tokenInput.owner = government.address;
      const signature = await getSignature(erc721, tokenInput, verifier);
      await expect(
        erc721.mint(users[0].address, tokenInput, signature, {
          value: ethers.utils.parseEther("1"),
        })
      ).to.be.revertedWith("Invalid price or amount");
    });

    it("2.8. Should be fail when user pays cash test token and payment token is not a contract address", async () => {
      tokenInput.tokenURI = "ipfs://URI";
      tokenInput.paymentToken = users[0].address;
      tokenInput.price = ethers.utils.parseUnits("1", DECIMALS);
      tokenInput.amount = ethers.utils.parseUnits("1", DECIMALS);
      tokenInput.owner = government.address;
      await expect(
        erc721.mint(users[0].address, tokenInput, sampleSignature)
      ).to.be.revertedWith("Invalid token address");
    });

    it("2.9. Should be fail when local government address is zero address", async () => {
      tokenInput.tokenURI = "ipfs://URI";
      tokenInput.price = ethers.utils.parseEther("1");
      tokenInput.amount = ethers.utils.parseEther("1");
      tokenInput.owner = ZERO_ADDRESS;
      await expect(
        erc721.mint(users[0].address, tokenInput, sampleSignature, {
          value: tokenInput.amount,
        })
      ).to.be.revertedWith("Invalid owner address");
    });

    it("2.10. Should be fail when local government address is a contract address", async () => {
      tokenInput.tokenURI = "ipfs://URI";
      tokenInput.price = ethers.utils.parseEther("1");
      tokenInput.amount = ethers.utils.parseEther("1");
      tokenInput.owner = cashTestToken.address;
      await expect(
        erc721.mint(users[0].address, tokenInput, sampleSignature, {
          value: tokenInput.amount,
        })
      ).to.be.revertedWith("Invalid owner address");
    });

    it("2.11. Should be fail when transaction is not signed by verifier", async () => {
      tokenInput.tokenURI = "ipfs://1.json";
      tokenInput.amount = ethers.utils.parseEther("1");
      tokenInput.price = ethers.utils.parseEther("1");
      tokenInput.owner = government.address;
      const signature = await getSignature(erc721, tokenInput, owner);
      await expect(
        erc721.mint(users[0].address, tokenInput, signature, {
          value: tokenInput.amount,
        })
      ).to.be.revertedWith("Invalid signature");
    });

    it("2.12. Should mint successfully when user pays native token", async () => {
      tokenInput.tokenURI = "ipfs://1.json";
      tokenInput.price = ethers.utils.parseEther("1");
      tokenInput.amount = ethers.utils.parseEther("2");
      tokenInput.owner = government.address;
      const tokenId = await erc721.lastId();
      const signature = await getSignature(erc721, tokenInput, verifier);

      await expect(
        erc721.connect(users[0]).mint(users[0].address, tokenInput, signature, {
          value: tokenInput.amount,
        })
      )
        .to.emit(erc721, "Transfer")
        .withArgs(ZERO_ADDRESS, users[0].address, tokenId.add(1))
        .to.changeEtherBalances(
          [users[0].address, erc721.address, government.address],
          [
            tokenInput.amount.mul(-1),
            tokenInput.amount.sub(tokenInput.price),
            tokenInput.price,
          ]
        );

      const currentBlockTimestamp = await blockTimestamp();
      const currentTokenId = await erc721.lastId();

      expect(await erc721.lastId()).to.be.equal(tokenId.add(1));
      expect(await erc721.tokenURI(currentTokenId)).to.be.equal(
        tokenInput.tokenURI
      );
      expect(await erc721.ownerOf(currentTokenId)).to.be.equal(
        users[0].address
      );
      expect(await erc721.isActiveOf(currentTokenId)).to.be.equal(true);
      expect(await erc721.expireOf(currentTokenId)).to.be.equal(
        currentBlockTimestamp.add(expiration)
      );
      expect(await erc721.tokenIdOf(signature)).to.be.equal(currentTokenId);
    });

    it("2.13. Should mint successfully when user pays cash test token", async () => {
      tokenInput.tokenURI = "ipfs://1.json";
      tokenInput.paymentToken = cashTestToken.address;
      tokenInput.price = ethers.utils.parseUnits("1", DECIMALS);
      tokenInput.amount = ethers.utils.parseUnits("2", DECIMALS);
      tokenInput.owner = government.address;
      const oldTokenId = await erc721.lastId();
      const signature = await getSignature(erc721, tokenInput, verifier);

      await expect(
        erc721.connect(users[0]).mint(users[0].address, tokenInput, signature)
      )
        .to.emit(erc721, "Transfer")
        .withArgs(ZERO_ADDRESS, users[0].address, oldTokenId.add(1))
        .to.changeTokenBalances(
          cashTestToken,
          [users[0].address, erc721.address, government.address],
          [
            tokenInput.amount.mul(-1),
            tokenInput.amount.sub(tokenInput.price),
            tokenInput.price,
          ]
        );

      const currentBlockTimestamp = await blockTimestamp();
      const currentTokenId = await erc721.lastId();

      expect(currentTokenId).to.be.equal(oldTokenId.add(1));
      expect(await erc721.tokenURI(currentTokenId)).to.be.equal(
        tokenInput.tokenURI
      );
      expect(await erc721.ownerOf(currentTokenId)).to.be.equal(
        users[0].address
      );
      expect(await erc721.isActiveOf(currentTokenId)).to.be.equal(true);
      expect(await erc721.expireOf(currentTokenId)).to.be.equal(
        currentBlockTimestamp.add(expiration)
      );
      expect(await erc721.tokenIdOf(signature)).to.be.equal(currentTokenId);
    });
  });

  describe("3. Mint With Royalty", () => {
    beforeEach(() => resetTokenInput());

    it("3.1. Should be fail when recipient address is zero address", async () => {
      await expect(
        erc721.mintWithRoyalty(
          ZERO_ADDRESS,
          tokenInput,
          sampleSignature,
          artist.address
        )
      ).to.be.revertedWith("Invalid address");
    });

    it("3.2. Should be fail when recipient address is a contract address", async () => {
      await expect(
        erc721.mintWithRoyalty(
          cashTestToken.address,
          tokenInput,
          sampleSignature,
          artist.address
        )
      ).to.be.revertedWith("Invalid address");
    });

    it("3.3. Should be fail when token URI is empty", async () => {
      await expect(
        erc721.mintWithRoyalty(
          users[0].address,
          tokenInput,
          sampleSignature,
          artist.address
        )
      ).to.be.revertedWith("Empty URI");
    });

    it("3.4. Should be fail when amount is equal 0", async () => {
      tokenInput.tokenURI = "ipfs://URI";
      tokenInput.owner = government.address;
      tokenInput.price = ethers.utils.parseEther("1");
      await expect(
        erc721.mintWithRoyalty(
          users[0].address,
          tokenInput,
          sampleSignature,
          artist.address
        )
      ).to.be.revertedWith("Invalid price or amount");
    });

    it("3.5. Should be fail when price is equal 0", async () => {
      tokenInput.tokenURI = "ipfs://URI";
      tokenInput.owner = government.address;
      tokenInput.amount = ethers.utils.parseEther("1");
      await expect(
        erc721.mintWithRoyalty(
          users[0].address,
          tokenInput,
          sampleSignature,
          artist.address
        )
      ).to.be.revertedWith("Invalid price or amount");
    });

    it("3.6. Should be fail when amount is less than price", async () => {
      tokenInput.tokenURI = "ipfs://URI";
      tokenInput.owner = government.address;
      tokenInput.price = ethers.utils.parseEther("1");
      tokenInput.amount = ethers.utils.parseEther("0.5");
      await expect(
        erc721.mintWithRoyalty(
          users[0].address,
          tokenInput,
          sampleSignature,
          artist.address
        )
      ).to.be.revertedWith("Invalid price or amount");
    });

    it("3.7. Should be fail when user pays native token and msg.value is not equal amount", async () => {
      tokenInput.tokenURI = "ipfs://URI";
      tokenInput.price = ethers.utils.parseEther("1");
      tokenInput.amount = ethers.utils.parseEther("2");
      tokenInput.owner = government.address;
      const signature = await getSignature(erc721, tokenInput, verifier);
      await expect(
        erc721.mintWithRoyalty(
          users[0].address,
          tokenInput,
          signature,
          artist.address,
          {
            value: ethers.utils.parseEther("1"),
          }
        )
      ).to.be.revertedWith("Invalid price or amount");
    });

    it("3.8. Should be fail when user pays native token and msg.value is not equal amount", async () => {
      tokenInput.tokenURI = "ipfs://URI";
      tokenInput.paymentToken = users[0].address;
      tokenInput.price = ethers.utils.parseEther("1");
      tokenInput.amount = ethers.utils.parseEther("2");
      tokenInput.owner = government.address;
      await expect(
        erc721.mintWithRoyalty(
          users[0].address,
          tokenInput,
          sampleSignature,
          artist.address,
          {
            value: tokenInput.amount,
          }
        )
      ).to.be.revertedWith("Invalid token address");
    });

    it("3.9. Should be fail when local government address is zero address", async () => {
      tokenInput.tokenURI = "ipfs://URI";
      tokenInput.price = ethers.utils.parseEther("1");
      tokenInput.amount = ethers.utils.parseEther("1");
      tokenInput.owner = ZERO_ADDRESS;
      await expect(
        erc721.mintWithRoyalty(
          users[0].address,
          tokenInput,
          sampleSignature,
          artist.address,
          { value: tokenInput.amount }
        )
      ).to.be.revertedWith("Invalid owner address");
    });

    it("3.10. Should be fail when local government address is a contract address", async () => {
      tokenInput.tokenURI = "ipfs://URI";
      tokenInput.price = ethers.utils.parseEther("1");
      tokenInput.amount = ethers.utils.parseEther("1");
      tokenInput.owner = cashTestToken.address;
      await expect(
        erc721.mintWithRoyalty(
          users[0].address,
          tokenInput,
          sampleSignature,
          artist.address,
          { value: tokenInput.amount }
        )
      ).to.be.revertedWith("Invalid owner address");
    });

    it("3.11. Should be fail when transaction is not signed by verifier", async () => {
      tokenInput.tokenURI = "ipfs://1.json";
      tokenInput.amount = ethers.utils.parseEther("1");
      tokenInput.price = ethers.utils.parseEther("1");
      tokenInput.owner = government.address;
      const signature = await getSignature(erc721, tokenInput, owner);
      await expect(
        erc721.mintWithRoyalty(
          users[0].address,
          tokenInput,
          signature,
          artist.address,
          {
            value: ethers.utils.parseEther("1"),
          }
        )
      ).to.be.revertedWith("Invalid signature");
    });

    it("3.12. Should mint successfully when user pays native token", async () => {
      tokenInput.tokenURI = "ipfs://1.json";
      tokenInput.price = ethers.utils.parseEther("1");
      tokenInput.amount = ethers.utils.parseEther("2");
      tokenInput.owner = government.address;
      const oldTokenId = await erc721.lastId();
      const signature = await getSignature(erc721, tokenInput, verifier);

      await expect(
        erc721
          .connect(users[0])
          .mintWithRoyalty(
            users[0].address,
            tokenInput,
            signature,
            artist.address,
            {
              value: tokenInput.amount,
            }
          )
      )
        .to.emit(erc721, "Transfer")
        .withArgs(ZERO_ADDRESS, users[0].address, oldTokenId.add(1))
        .to.changeEtherBalances(
          [users[0].address, erc721.address, government.address],
          [
            tokenInput.amount.mul(-1),
            tokenInput.amount.sub(tokenInput.price),
            tokenInput.price,
          ]
        );

      tokenId = await erc721.lastId();
      const [royaltyAddress, royaltyFraction] = await erc721.royaltyInfo(
        tokenId,
        tokenInput.price
      );
      const currentBlockTimestamp = await blockTimestamp();
      const currentTokenId = await erc721.lastId();

      expect(currentTokenId).to.be.equal(oldTokenId.add(1));
      expect(await erc721.tokenURI(currentTokenId)).to.be.equal(
        tokenInput.tokenURI
      );
      expect(await erc721.ownerOf(currentTokenId)).to.be.equal(
        users[0].address
      );
      expect(await erc721.isActiveOf(currentTokenId)).to.be.equal(true);
      expect(await erc721.expireOf(currentTokenId)).to.be.equal(
        currentBlockTimestamp.add(expiration)
      );
      expect(await erc721.tokenIdOf(signature)).to.be.equal(currentTokenId);
      expect(royaltyAddress).to.be.equal(artist.address);
      expect(royaltyFraction).to.be.equal(
        tokenInput.price.mul(ROYALTY_PERCENTAGE).div(100)
      );
    });

    it("3.13. Should mint successfully when user pay cash test token", async () => {
      const price = ethers.utils.parseUnits("1", DECIMALS);
      tokenInput.tokenURI = "ipfs://1.json";
      tokenInput.amount = price;
      tokenInput.price = price;
      tokenInput.paymentToken = cashTestToken.address;
      tokenInput.owner = government.address;
      const oldTokenId = await erc721.lastId();
      const signature = await getSignature(erc721, tokenInput, verifier);

      await expect(
        erc721
          .connect(users[0])
          .mintWithRoyalty(
            users[0].address,
            tokenInput,
            signature,
            artist.address
          )
      )
        .to.emit(erc721, "Transfer")
        .withArgs(ZERO_ADDRESS, users[0].address, oldTokenId.add(1))
        .to.changeTokenBalances(
          cashTestToken,
          [users[0].address, erc721.address, government.address],
          [
            tokenInput.amount.mul(-1),
            tokenInput.amount.sub(tokenInput.price),
            tokenInput.price,
          ]
        );

      const currentBlockTimestamp = await blockTimestamp();
      const tokenId = await erc721.lastId();
      const [royaltyAddress, royaltyFraction] = await erc721.royaltyInfo(
        tokenId,
        tokenInput.price
      );

      expect(tokenId).to.be.equal(oldTokenId.add(1));
      expect(await erc721.tokenURI(tokenId)).to.be.equal(tokenInput.tokenURI);
      expect(await erc721.ownerOf(tokenId)).to.be.equal(users[0].address);
      expect(await erc721.isActiveOf(tokenId)).to.be.equal(true);
      expect(await erc721.expireOf(tokenId)).to.be.equal(
        currentBlockTimestamp.add(expiration)
      );
      expect(await erc721.tokenIdOf(signature)).to.be.equal(tokenId);
      expect(royaltyAddress).to.be.equal(artist.address);
      expect(royaltyFraction).to.be.equal(
        tokenInput.price.mul(ROYALTY_PERCENTAGE).div(100)
      );
    });
  });

  describe("4. Set Admin", () => {
    it("4.1. Should be fail when caller is not the owner", async () => {
      await expect(
        erc721.connect(admin).setAdmin(users[0].address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("4.2. Should be fail when setting zero address", async () => {
      await expect(
        erc721.connect(owner).setAdmin(ZERO_ADDRESS)
      ).to.be.revertedWith("Ownable: Invalid address");
    });

    it("4.3. Should be fail when setting contract address", async () => {
      await expect(
        erc721.connect(owner).setAdmin(cashTestToken.address)
      ).to.be.revertedWith("Ownable: Invalid address");
    });

    it("4.4. Should set successfully", async () => {
      expect(await erc721.connect(owner).setAdmin(users[0].address))
        .to.emit(erc721, "SetAdmin")
        .withArgs(admin.address, users[0].address);
      expect(await erc721.admin()).to.be.equal(users[0].address);
    });
  });

  describe("5. Set Verifier", () => {
    it("5.1. Should be fail when caller is not the owner", async () => {
      await expect(
        erc721.connect(owner).setVerifier(users[0].address)
      ).to.be.revertedWith("Ownable: Caller is not admin");
    });

    it("5.2. Should be fail when setting zero address", async () => {
      await expect(
        erc721.connect(admin).setVerifier(ZERO_ADDRESS)
      ).to.be.revertedWith("Ownable: Invalid address");
    });

    it("5.3. Should be fail when setting a contract address", async () => {
      await expect(
        erc721.connect(admin).setVerifier(cashTestToken.address)
      ).to.be.revertedWith("Ownable: Invalid address");
    });

    it("5.4. Should set successfully", async () => {
      expect(await erc721.connect(admin).setVerifier(users[0].address))
        .to.emit(erc721, "SetVerifier")
        .withArgs(verifier.address, users[0].address);
      expect(await erc721.verifier()).to.be.equal(users[0].address);
    });
  });

  describe("6. Set Expiration", () => {
    it("6.1. Should be fail when caller is not the admin", async () => {
      await expect(
        erc721.connect(owner).setExpiration(YEAR_TO_SECONDS)
      ).to.be.revertedWith("Ownable: Caller is not admin");
    });

    it("6.2. Should be fail when setting 0", async () => {
      await expect(erc721.connect(admin).setExpiration(0)).to.be.revertedWith(
        "Invalid expiration"
      );
    });

    it("6.3. Should set successfully", async () => {
      const oldExpiration = await erc721.expiration();
      expect(await erc721.connect(admin).setExpiration(YEAR_TO_SECONDS))
        .to.emit(erc721, "SetExpiration")
        .withArgs(oldExpiration, YEAR_TO_SECONDS);
      expect(await erc721.expiration()).to.be.equal(YEAR_TO_SECONDS);
    });
  });

  describe("7. Set Token URI", () => {
    const tokenURI = "ipfs://newURI";
    beforeEach(async () => {
      resetTokenInput();
      tokenInput.tokenURI = "ipfs://1.json";
      tokenInput.amount = ethers.utils.parseEther("1");
      tokenInput.price = ethers.utils.parseEther("1");
      tokenInput.owner = government.address;
      await mintToken(erc721, users[0], users[0].address, tokenInput, verifier);
      tokenId = await erc721.lastId();
      resetTokenInput();
    });

    it("7.1. Should be fail when token ID is nonexistent", async () => {
      await expect(
        erc721.setTokenURI(NONEXISTENT_TOKEN_ID, tokenURI, sampleSignature)
      ).to.be.revertedWith("Nonexistent token");
    });

    it("7.2. Should be fail when new token URI is empty", async () => {
      await expect(
        erc721.setTokenURI(tokenId, "", sampleSignature)
      ).to.be.revertedWith("Empty URI");
    });

    it("7.3. Should be fail when transaction is not signed by verifier", async () => {
      tokenInput.tokenId = tokenId;
      tokenInput.tokenURI = "ipfs://2.json";
      const signature = await getSignature(erc721, tokenInput, owner);
      await expect(
        erc721.setTokenURI(tokenId, tokenInput.tokenURI, signature)
      ).to.be.revertedWith("Invalid signature");
    });

    it("7.4. Should be fail when signature data is invalid", async () => {
      const correctTokenURI = "ipfs://2.json";
      const wrongTokenURI = "ipfs://dump";
      const tokenId = await erc721.lastId();
      tokenInput.tokenId = tokenId;
      tokenInput.tokenURI = wrongTokenURI;
      const signature = await getSignature(erc721, tokenInput, verifier);

      await expect(
        erc721.setTokenURI(tokenId, correctTokenURI, signature)
      ).to.be.revertedWith("Invalid signature");
    });

    it("7.5. Should set successfully", async () => {
      const newTokenURI = "ipfs://2.json";
      const tokenId = await erc721.lastId();
      const oldTokenURI = await erc721.tokenURI(tokenId);
      tokenInput.tokenId = tokenId;
      tokenInput.tokenURI = newTokenURI;
      const signature = await getSignature(erc721, tokenInput, verifier);

      await expect(erc721.setTokenURI(tokenId, newTokenURI, signature))
        .to.emit(erc721, "SetTokenURI")
        .withArgs(tokenId, oldTokenURI, newTokenURI);
      expect(await erc721.tokenURI(tokenId)).to.be.equal(newTokenURI);
    });
  });

  describe("8. Set NFT Status", () => {
    let statusOfToken: boolean;

    beforeEach(async () => {
      resetTokenInput();
      tokenInput.tokenURI = "ipfs://1.json";
      tokenInput.amount = ethers.utils.parseEther("1");
      tokenInput.price = ethers.utils.parseEther("1");
      tokenInput.owner = government.address;

      await mintToken(erc721, users[0], users[0].address, tokenInput, verifier);
      tokenId = await erc721.lastId();
      statusOfToken = await erc721.isActiveOf(tokenId);
      resetTokenInput();
      tokenInput.tokenId = tokenId;
    });

    it("8.1. Should be fail when set a token is nonexistent", async () => {
      await expect(
        erc721.setNFTStatus(NONEXISTENT_TOKEN_ID, false, sampleSignature)
      ).to.be.revertedWith("Nonexistent token");
    });

    it("8.2. Should be fail when set value is equal status of current token", async () => {
      await expect(
        erc721.setNFTStatus(tokenId, statusOfToken, sampleSignature)
      ).to.be.revertedWith("Duplicate value");
    });

    it("8.3. Should be fail when transaction is not signed by verifier", async () => {
      const signature = await getSignature(erc721, tokenInput, owner);
      await expect(
        erc721.setNFTStatus(tokenId, !statusOfToken, signature)
      ).to.be.revertedWith("Invalid signature");
    });

    it("8.4. Should be fail when signature is invalid", async () => {
      tokenInput.status = statusOfToken;
      const signature = await getSignature(erc721, tokenInput, verifier);
      await expect(
        erc721.setNFTStatus(tokenId, !statusOfToken, signature)
      ).to.be.revertedWith("Invalid signature");
    });

    it("8.5. Should set successfully", async () => {
      tokenInput.status = !statusOfToken;
      const signature = await getSignature(erc721, tokenInput, verifier);
      await expect(erc721.setNFTStatus(tokenId, tokenInput.status, signature))
        .to.emit(erc721, "SetNFTStatus")
        .withArgs(tokenId, tokenInput.status);
      expect(await erc721.isActiveOf(tokenId)).to.be.equal(tokenInput.status);
    });
  });

  describe("9. Get Token URI", () => {
    beforeEach(async () => {
      resetTokenInput();
      tokenInput.tokenURI = "ipfs://1.json";
      tokenInput.amount = ethers.utils.parseEther("1");
      tokenInput.price = ethers.utils.parseEther("1");
      tokenInput.owner = government.address;
      await mintToken(erc721, users[0], users[0].address, tokenInput, verifier);
      tokenId = await erc721.lastId();
    });

    it("9.1. Should be fail when get a token is nonexistent", async () => {
      await expect(erc721.tokenURI(NONEXISTENT_TOKEN_ID)).to.be.revertedWith(
        "Nonexistent token."
      );
    });

    it("9.2. Should return exactly token URI", async () => {
      expect(await erc721.tokenURI(tokenId)).to.be.equal(tokenInput.tokenURI);
    });

    it("9.3. Should retrieve exacty token URI after setting token URI", async () => {
      const newTokenURI = "ipfs://new.json";
      resetTokenInput();
      tokenInput.tokenId = tokenId;
      tokenInput.tokenURI = newTokenURI;
      const signature = await getSignature(erc721, tokenInput, verifier);
      await erc721.setTokenURI(tokenId, tokenInput.tokenURI, signature);
      expect(await erc721.tokenURI(tokenId)).to.be.equal(newTokenURI);
    });
  });

  describe("10. Withdraw", () => {
    const price = ethers.utils.parseEther("1");
    const amount = ethers.utils.parseEther("5");
    const changeAmount = amount.sub(price);

    const tokenPrice = ethers.utils.parseUnits("1", DECIMALS);
    const tokenAmount = ethers.utils.parseUnits("5", DECIMALS);
    const tokenchangeAmount = tokenAmount.sub(tokenPrice);

    beforeEach(async () => {
      // Mint token with 5 native token but price is 1
      resetTokenInput();
      tokenInput.tokenURI = "ipfs://URI";
      tokenInput.price = price;
      tokenInput.amount = amount;
      tokenInput.owner = government.address;

      await mintToken(erc721, users[0], users[0].address, tokenInput, verifier);

      // Mint token with 5 cash test token but price is 1
      resetTokenInput();
      tokenInput.tokenURI = "ipfs://URI";
      tokenInput.paymentToken = cashTestToken.address;
      tokenInput.price = tokenPrice;
      tokenInput.amount = tokenAmount;
      tokenInput.owner = government.address;
      await mintToken(erc721, users[0], users[0].address, tokenInput, verifier);
    });

    it("10.1. Should be fail when caller is not owner", async () => {
      await expect(
        erc721
          .connect(admin)
          .withdraw(ZERO_ADDRESS, admin.address, changeAmount)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("10.2. Should be fail when recipient address is zero addess", async () => {
      await expect(
        erc721.connect(owner).withdraw(ZERO_ADDRESS, ZERO_ADDRESS, changeAmount)
      ).to.be.revertedWith("Invalid address");
    });

    it("10.3. Should be fail when amount is equal 0", async () => {
      await expect(
        erc721.connect(owner).withdraw(ZERO_ADDRESS, owner.address, 0)
      ).to.be.revertedWith("Invalid amount");
    });

    it("10.4. Should be fail when owner withdraw native token amount greater than withdrawable amount", async () => {
      await expect(
        erc721.connect(owner).withdraw(ZERO_ADDRESS, owner.address, amount)
      ).to.be.revertedWith("Address: insufficient balance");
    });

    it("10.5. Should be fail when owner withdraw test cash token amount greater than withdrawable amount", async () => {
      await expect(
        erc721
          .connect(owner)
          .withdraw(cashTestToken.address, owner.address, tokenAmount)
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });

    it("10.6. Should be successful when owner withdraws native token", async () => {
      await expect(
        erc721
          .connect(owner)
          .withdraw(ZERO_ADDRESS, owner.address, changeAmount)
      )
        .to.emit(erc721, "Withdrawn")
        .withArgs(ZERO_ADDRESS, owner.address, changeAmount)
        .changeEtherBalances(
          [erc721.address, owner.address],
          [changeAmount.mul(-1), changeAmount]
        );
    });

    it("10.7. Should be successful when owner withdraws cash test token", async () => {
      await expect(
        erc721
          .connect(owner)
          .withdraw(cashTestToken.address, owner.address, tokenchangeAmount)
      )
        .to.emit(erc721, "Withdrawn")
        .withArgs(cashTestToken.address, owner.address, tokenchangeAmount)
        .changeTokenBalances(
          cashTestToken,
          [erc721.address, owner.address],
          [tokenchangeAmount.mul(-1), tokenchangeAmount]
        );
    });
  });

  describe("11. Transfer", () => {
    beforeEach(async () => {
      resetTokenInput();
      tokenInput.tokenURI = "ipfs://1.json";
      tokenInput.price = ethers.utils.parseEther("1");
      tokenInput.amount = ethers.utils.parseEther("1");
      tokenInput.owner = government.address;
      await mintToken(erc721, users[0], users[0].address, tokenInput, verifier);
      tokenId = await erc721.lastId();
    });

    it("11.1. Should be fail when sender transfer token to self", async () => {
      await expect(
        erc721.connect(users[0]).transfer(users[0].address, tokenId)
      ).to.be.revertedWith("Transfer to yourself");
    });

    it("11.2. Should be fail when recipient address is zero address", async () => {
      await expect(
        erc721.connect(users[0]).transfer(ZERO_ADDRESS, tokenId)
      ).to.be.revertedWith("ERC721: transfer to the zero address");
    });

    it("11.3. Should be fail when token is nonexistent", async () => {
      await expect(
        erc721
          .connect(users[0])
          .transfer(users[1].address, NONEXISTENT_TOKEN_ID)
      ).to.be.revertedWith("Nonexistent token.");
    });

    it("11.4. Should be fail when token is deactive", async () => {
      resetTokenInput();
      tokenInput.tokenId = tokenId;
      tokenInput.status = false;
      const signature = await getSignature(erc721, tokenInput, verifier);
      await erc721.setNFTStatus(tokenId, tokenInput.status, signature);
      await expect(
        erc721.connect(users[0]).transfer(users[1].address, tokenId)
      ).to.be.revertedWith("Token is deactive");
    });

    it("11.5. Should be fail when token is not owned by sender", async () => {
      await expect(
        erc721.connect(users[1]).transfer(users[0].address, tokenId)
      ).to.be.revertedWith("ERC721: caller is not token owner or approved");
    });

    it("11.6. Should transfer successfully", async () => {
      resetTokenInput();
      tokenInput.tokenURI = "ipfs://4.json";
      tokenInput.price = ethers.utils.parseEther("1");
      tokenInput.amount = ethers.utils.parseEther("1");
      tokenInput.owner = government.address;
      await mintRoyaltyToken(
        erc721,
        users[0],
        users[0].address,
        tokenInput,
        artist.address,
        verifier
      );
      const tokenId = await erc721.lastId();
      const expiration = await erc721.expiration();

      await expect(erc721.connect(users[0]).transfer(users[1].address, tokenId))
        .to.emit(erc721, "Transfer")
        .withArgs(users[0].address, users[1].address, tokenId)
        .changeTokenBalances(
          erc721,
          [users[0].address, users[1].address],
          [-1, 1]
        );
      const currentBlockTimestamp = await blockTimestamp();

      expect(await erc721.expireOf(tokenId)).to.be.equal(
        currentBlockTimestamp.add(expiration)
      );
      expect(await erc721.ownerOf(tokenId)).to.be.equal(users[1].address);
    });
  });

  describe.only("12. Buy", () => {
    const price = ethers.utils.parseEther("1");
    const amount = ethers.utils.parseEther("1");
    const tokenPrice = ethers.utils.parseUnits("1", DECIMALS);
    const tokenAmount = ethers.utils.parseUnits("1", DECIMALS);

    beforeEach(async () => {
      // Mint token without royalty by paying native token
      resetTokenInput();
      tokenInput.tokenURI = "ipfs://1.json";
      tokenInput.price = price;
      tokenInput.amount = amount;
      tokenInput.owner = government.address;
      await mintToken(erc721, users[0], users[0].address, tokenInput, verifier);
      tokenId = await erc721.lastId();

      // Mint token without royalty by paying test cash token
      resetTokenInput();
      tokenInput.tokenURI = "ipfs://2.json";
      tokenInput.price = tokenPrice;
      tokenInput.amount = tokenAmount;
      tokenInput.paymentToken = cashTestToken.address;
      tokenInput.owner = government.address;
      await mintToken(erc721, users[0], users[0].address, tokenInput, verifier);

      // Mint token with royalty by paying native token
      resetTokenInput();
      tokenInput.tokenURI = "ipfs://2.json";
      tokenInput.price = price;
      tokenInput.amount = amount;
      tokenInput.owner = government.address;
      await mintRoyaltyToken(
        erc721,
        users[0],
        users[0].address,
        tokenInput,
        artist.address,
        verifier
      );

      // Mint token with royalty by paying test cash token
      resetTokenInput();
      tokenInput.tokenURI = "ipfs://2.json";
      tokenInput.price = tokenPrice;
      tokenInput.amount = tokenAmount;
      tokenInput.paymentToken = cashTestToken.address;
      tokenInput.owner = government.address;
      await mintRoyaltyToken(
        erc721,
        users[0],
        users[0].address,
        tokenInput,
        artist.address,
        verifier
      );
    });

    it("12.1. Should be fail when buy a nonexistent token", async () => {
      await expect(erc721.buy(NONEXISTENT_TOKEN_ID)).to.be.revertedWith(
        "Nonexistent token."
      );
    });

    it("12.2. Should be fail when buy an owned token", async () => {
      const tokenId = await erc721.lastId();
      await expect(erc721.connect(users[0]).buy(tokenId)).to.be.revertedWith(
        "Already owned"
      );
    });

    it("12.3. Should be fail when token is deactive", async () => {
      resetTokenInput();
      tokenInput.tokenId = tokenId;
      tokenInput.status = false;
      const signature = await getSignature(erc721, tokenInput, verifier);
      await erc721.setNFTStatus(tokenId, false, signature);
      await expect(erc721.buy(tokenId)).to.be.revertedWith("Token is deactive");
    });

    describe("12.4. Buy without royalty", () => {
      it("12.4.1. Should be successful when user buys a token paid by native token", async () => {
        const [_, royaltyFraction] = await erc721.royaltyInfo(1, price);
        await expect(erc721.connect(users[1]).buy(1, { value: price }))
          .to.emit(erc721, "Transfer")
          .withArgs(users[0].address, users[1].address, 1)
          .to.emit(erc721, "Bought")
          .withArgs(users[1].address, 1)
          .changeTokenBalances(
            erc721,
            [users[0].address, users[1].address],
            [-1, 1]
          )
          .changeEtherBalances(
            [
              erc721.address,
              users[0].address,
              users[1].address,
              artist.address,
            ],
            [0, price.sub(royaltyFraction), price.mul(-1), royaltyFraction]
          );
      });

      it("12.4.2. Should be successful when user buys a token paid by test cash token", async () => {
        await expect(erc721.connect(users[1]).buy(2))
          .to.emit(erc721, "Transfer")
          .withArgs(users[0].address, users[1].address, 2)
          .to.emit(erc721, "Bought")
          .withArgs(users[1].address, 2)
          .changeTokenBalances(
            erc721,
            [users[0].address, users[1].address],
            [-1, 1]
          )
          .changeTokenBalances(
            cashTestToken,
            [users[0].address, users[1].address],
            [tokenPrice, tokenPrice.mul(-1)]
          );
      });
    });

    describe("12.5. Buy with royalty", () => {
      it("12.5.1. Should be successful when user buys a token paid by native token", async () => {
        const [_, royaltyFraction] = await erc721.royaltyInfo(3, price);

        await expect(erc721.connect(users[1]).buy(3, { value: price }))
          .to.emit(erc721, "Transfer")
          .withArgs(users[0].address, users[1].address, 3)
          .to.emit(erc721, "Bought")
          .withArgs(users[1].address, 3)
          .changeTokenBalances(
            erc721,
            [users[0].address, users[1].address],
            [-1, 1]
          )
          .changeEtherBalances(
            [users[0].address, users[1].address, artist.address],
            [price.sub(royaltyFraction), price.mul(-1), royaltyFraction]
          );
      });

      it("12.5.2. Should be successful when user buys a token paid by test cash token", async () => {
        const [_, royaltyFraction] = await erc721.royaltyInfo(4, tokenPrice);
        await expect(erc721.connect(users[1]).buy(4))
          .to.emit(erc721, "Transfer")
          .withArgs(users[0].address, users[1].address, 4)
          .to.emit(erc721, "Bought")
          .withArgs(users[1].address, 4)
          .changeTokenBalances(
            erc721,
            [users[0].address, users[1].address],
            [-1, 1]
          )
          .changeTokenBalances(
            cashTestToken,
            [users[0].address, users[1].address, artist.address],
            [
              tokenPrice.sub(royaltyFraction),
              tokenPrice.mul(-1),
              royaltyFraction,
            ]
          );
      });
    });
  });
});
