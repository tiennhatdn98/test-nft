import { ethers, upgrades } from "hardhat";
import { BigNumber, Contract } from "ethers";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import * as helpers from "@nomicfoundation/hardhat-network-helpers";
import { MintParamsStruct } from "./../typechain-types/contracts/ERC721";
import { TokenType } from "./utils/constant";
import {
  getSignatureMint,
  getSignatureSetTokenURI,
  getSignatureSetType,
  mintToken,
  setTokenType,
} from "./utils/ERC721";
import {
  ZERO_ADDRESS,
  MAX_UINT256,
  TOKEN_NAME,
  SYMBOL,
  DECIMALS,
  NONEXISTENT_TOKEN_ID,
  ROYALTY_PERCENT,
} from "./utils/constant";

const sampleSignature =
  "0xe061bcd7ddefb1dbef4bb6e16bc0fc8f5c1edebbd3a94c3e7bfafae9966fae5936458df7c8cc4bf664641978b79d915c95db6907057f2bfe9610a323a2dad7281c";
const royaltyPercent = ROYALTY_PERCENT * 100;

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
  let tokenId: BigNumber;
  let params: MintParamsStruct;

  const initParams = () => {
    params = {
      to: users[0].address,
      owner: government.address,
      paymentToken: ZERO_ADDRESS,
      royaltyReceiver: artist.address,
      price: ethers.utils.parseEther("1"),
      amount: ethers.utils.parseEther("1"),
      royaltyPercent,
      tokenURI: "ipfs://test",
      typeToken: TokenType.Normal,
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
  });

  describe("1. Initialize", () => {
    it("1.1. Should assign states successfully", async () => {
      expect(await erc721.owner()).to.be.equal(owner.address);
      expect(await erc721.name()).to.be.equal(TOKEN_NAME);
      expect(await erc721.symbol()).to.be.equal(SYMBOL);
      expect(await erc721.lastId()).to.be.equal(0);
    });
  });

  describe("2. Mint", () => {
    beforeEach(() => initParams());

    it("2.1. Should be fail when recipient address is zero address", async () => {
      await expect(
        erc721.mint(ZERO_ADDRESS, params, sampleSignature)
      ).to.be.revertedWith("Invalid address");
    });

    it("2.2. Should be fail when recipient address is a contract address", async () => {
      await expect(
        erc721.mint(cashTestToken.address, params, sampleSignature)
      ).to.be.revertedWith("Invalid address");
    });

    it("2.3. Should be fail when token URI is empty", async () => {
      params.tokenURI = "";
      await expect(
        erc721.mint(users[0].address, params, sampleSignature)
      ).to.be.revertedWith("Empty URI");
    });

    it("2.4. Should be fail when amount is equal 0", async () => {
      params.amount = 0;
      await expect(
        erc721.mint(users[0].address, params, sampleSignature)
      ).to.be.revertedWith("Invalid price or amount");
    });

    it("2.5. Should be fail when price is equal 0", async () => {
      params.price = 0;
      await expect(
        erc721.mint(users[0].address, params, sampleSignature)
      ).to.be.revertedWith("Invalid price or amount");
    });

    it("2.6. Should be fail when amount is less than price", async () => {
      params.price = ethers.utils.parseEther("1");
      params.amount = ethers.utils.parseEther("0.5");
      await expect(
        erc721.mint(users[0].address, params, sampleSignature, {
          value: params.amount,
        })
      ).to.be.revertedWith("Invalid price or amount");
    });

    it("2.7. Should be fail when user pays native token and msg.value is not equal amount", async () => {
      const signature = await getSignatureMint(erc721, params, verifier);
      await expect(
        erc721.mint(users[0].address, params, signature, {
          value: ethers.utils.parseEther("0.5"),
        })
      ).to.be.revertedWith("Invalid price or amount");
    });

    it("2.8. Should be fail when user pays cash test token and payment token is not a contract address", async () => {
      params.paymentToken = users[0].address;
      await expect(
        erc721.mint(users[0].address, params, sampleSignature)
      ).to.be.revertedWith("Invalid token address");
    });

    it("2.9. Should be fail when local government address is zero address", async () => {
      params.owner = ZERO_ADDRESS;
      await expect(
        erc721.mint(users[0].address, params, sampleSignature, {
          value: params.amount,
        })
      ).to.be.revertedWith("Invalid owner address");
    });

    it("2.10. Should be fail when local government address is a contract address", async () => {
      params.owner = cashTestToken.address;
      await expect(
        erc721.mint(users[0].address, params, sampleSignature, {
          value: params.amount,
        })
      ).to.be.revertedWith("Invalid owner address");
    });

    it("2.11. Should be fail when transaction is not signed by verifier", async () => {
      const signature = await getSignatureMint(erc721, params, owner);
      await expect(
        erc721.mint(users[0].address, params, signature, {
          value: params.amount,
        })
      ).to.be.revertedWith("Invalid signature");
    });

    it("2.12. Should mint successfully when user pays native token", async () => {
      const tokenId = await erc721.lastId();
      const signature = await getSignatureMint(erc721, params, verifier);

      await expect(
        erc721.connect(users[0]).mint(users[0].address, params, signature, {
          value: params.amount,
        })
      )
        .to.emit(erc721, "Transfer")
        .withArgs(ZERO_ADDRESS, users[0].address, tokenId.add(1))
        .to.changeEtherBalances(
          [users[0].address, erc721.address, government.address],
          [params.amount.mul(-1), params.amount.sub(params.price), params.price]
        );

      const currentTokenId = await erc721.lastId();

      expect(await erc721.lastId()).to.be.equal(tokenId.add(1));
      expect(await erc721.tokenURI(currentTokenId)).to.be.equal(
        params.tokenURI
      );
      expect(await erc721.ownerOf(currentTokenId)).to.be.equal(
        users[0].address
      );
      expect(await erc721.typeOf(currentTokenId)).to.be.equal(TokenType.Normal);
      expect(await erc721.tokenIdOf(signature)).to.be.equal(currentTokenId);
      const [royaltyReceiver, royaltyFraction] = await erc721.royaltyInfo(
        currentTokenId,
        params.price
      );
      expect(royaltyReceiver).to.be.equal(artist.address);
      expect(royaltyFraction).to.be.equal(
        params.price.mul(ROYALTY_PERCENT).div(100)
      );
    });

    it("2.13. Should mint successfully when user pays cash test token", async () => {
      params.paymentToken = cashTestToken.address;
      params.price = ethers.utils.parseUnits("1", DECIMALS);
      params.amount = ethers.utils.parseUnits("2", DECIMALS);
      const oldTokenId = await erc721.lastId();
      const signature = await getSignatureMint(erc721, params, verifier);

      await expect(
        erc721.connect(users[0]).mint(users[0].address, params, signature)
      )
        .to.emit(erc721, "Transfer")
        .withArgs(ZERO_ADDRESS, users[0].address, oldTokenId.add(1))
        .to.changeTokenBalances(
          cashTestToken,
          [users[0].address, erc721.address, government.address],
          [params.amount.mul(-1), params.amount.sub(params.price), params.price]
        );

      const currentTokenId = await erc721.lastId();

      expect(currentTokenId).to.be.equal(oldTokenId.add(1));
      expect(await erc721.tokenURI(currentTokenId)).to.be.equal(
        params.tokenURI
      );
      expect(await erc721.ownerOf(currentTokenId)).to.be.equal(
        users[0].address
      );
      expect(await erc721.typeOf(currentTokenId)).to.be.equal(TokenType.Normal);
      expect(await erc721.tokenIdOf(signature)).to.be.equal(currentTokenId);
      const [royaltyReceiver, royaltyFraction] = await erc721.royaltyInfo(
        currentTokenId,
        params.price
      );
      expect(royaltyReceiver).to.be.equal(artist.address);
      expect(royaltyFraction).to.be.equal(
        params.price.mul(ROYALTY_PERCENT).div(100)
      );
    });
  });

  describe("3. Set Admin", () => {
    it("3.1. Should be fail when caller is not the owner", async () => {
      await expect(
        erc721.connect(admin).setAdmin(users[0].address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("3.2. Should be fail when setting zero address", async () => {
      await expect(
        erc721.connect(owner).setAdmin(ZERO_ADDRESS)
      ).to.be.revertedWith("Ownable: Invalid address");
    });

    it("3.3. Should be fail when setting contract address", async () => {
      await expect(
        erc721.connect(owner).setAdmin(cashTestToken.address)
      ).to.be.revertedWith("Ownable: Invalid address");
    });

    it("3.4. Should set successfully", async () => {
      expect(await erc721.connect(owner).setAdmin(users[0].address))
        .to.emit(erc721, "SetAdmin")
        .withArgs(admin.address, users[0].address);
      expect(await erc721.admin()).to.be.equal(users[0].address);
    });
  });

  describe("4. Set Verifier", () => {
    it("4.1. Should be fail when caller is not the owner", async () => {
      await expect(
        erc721.connect(owner).setVerifier(users[0].address)
      ).to.be.revertedWith("Ownable: Caller is not admin");
    });

    it("4.2. Should be fail when setting zero address", async () => {
      await expect(
        erc721.connect(admin).setVerifier(ZERO_ADDRESS)
      ).to.be.revertedWith("Ownable: Invalid address");
    });

    it("4.3. Should be fail when setting a contract address", async () => {
      await expect(
        erc721.connect(admin).setVerifier(cashTestToken.address)
      ).to.be.revertedWith("Ownable: Invalid address");
    });

    it("4.4. Should set successfully", async () => {
      expect(await erc721.connect(admin).setVerifier(users[0].address))
        .to.emit(erc721, "SetVerifier")
        .withArgs(verifier.address, users[0].address);
      expect(await erc721.verifier()).to.be.equal(users[0].address);
    });
  });

  describe("5. Set Token URI", () => {
    let tokenURI: string = "ipfs://test";
    beforeEach(async () => {
      initParams();
      await mintToken(erc721, users[0], users[0].address, params, verifier);
      tokenId = await erc721.lastId();
    });

    it("5.1. Should be fail when token ID is nonexistent", async () => {
      await expect(
        erc721.setTokenURI(NONEXISTENT_TOKEN_ID, tokenURI, sampleSignature)
      ).to.be.revertedWith("Nonexistent token");
    });

    it("5.2. Should be fail when new token URI is empty", async () => {
      await expect(
        erc721.setTokenURI(tokenId, "", sampleSignature)
      ).to.be.revertedWith("Empty URI");
    });

    it("5.3. Should be fail when transaction is not signed by verifier", async () => {
      const signature = await getSignatureSetTokenURI(
        erc721,
        tokenId,
        tokenURI,
        owner
      );
      await expect(
        erc721.setTokenURI(tokenId, params.tokenURI, signature)
      ).to.be.revertedWith("Invalid signature");
    });

    it("5.4. Should be fail when signature data is invalid", async () => {
      const correctTokenURI = "ipfs://2.json";
      const wrongTokenURI = "ipfs://dump";
      const signature = await getSignatureSetTokenURI(
        erc721,
        tokenId,
        wrongTokenURI,
        verifier
      );

      await expect(
        erc721.setTokenURI(tokenId, correctTokenURI, signature)
      ).to.be.revertedWith("Invalid signature");
    });

    it("5.5. Should set successfully", async () => {
      const newTokenURI = "ipfs://2.json";
      const oldTokenURI = await erc721.tokenURI(tokenId);
      tokenURI = newTokenURI;
      const signature = await getSignatureSetTokenURI(
        erc721,
        tokenId,
        tokenURI,
        verifier
      );

      await expect(erc721.setTokenURI(tokenId, newTokenURI, signature))
        .to.emit(erc721, "SetTokenURI")
        .withArgs(tokenId, oldTokenURI, newTokenURI);
      expect(await erc721.tokenURI(tokenId)).to.be.equal(newTokenURI);
    });
  });

  describe("6. Withdraw", () => {
    const price = ethers.utils.parseEther("1");
    const amount = ethers.utils.parseEther("5");
    const changeAmount = amount.sub(price);

    const tokenPrice = ethers.utils.parseUnits("1", DECIMALS);
    const tokenAmount = ethers.utils.parseUnits("5", DECIMALS);
    const tokenchangeAmount = tokenAmount.sub(tokenPrice);

    beforeEach(async () => {
      // Mint token with 5 native token but price is 1
      initParams();
      params.price = price;
      params.amount = amount;

      await mintToken(erc721, users[0], users[0].address, params, verifier);

      // Mint token with 5 cash test token but price is 1
      params.paymentToken = cashTestToken.address;
      params.price = tokenPrice;
      params.amount = tokenAmount;
      await mintToken(erc721, users[0], users[0].address, params, verifier);
    });

    it("6.1. Should be fail when caller is not owner", async () => {
      await expect(
        erc721
          .connect(admin)
          .withdraw(ZERO_ADDRESS, admin.address, changeAmount)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("6.2. Should be fail when recipient address is zero addess", async () => {
      await expect(
        erc721.connect(owner).withdraw(ZERO_ADDRESS, ZERO_ADDRESS, changeAmount)
      ).to.be.revertedWith("Invalid address");
    });

    it("6.3. Should be fail when amount is equal 0", async () => {
      await expect(
        erc721.connect(owner).withdraw(ZERO_ADDRESS, owner.address, 0)
      ).to.be.revertedWith("Invalid amount");
    });

    it("6.4. Should be fail when owner withdraw native token amount greater than withdrawable amount", async () => {
      await expect(
        erc721.connect(owner).withdraw(ZERO_ADDRESS, owner.address, amount)
      ).to.be.revertedWith("Address: insufficient balance");
    });

    it("6.5. Should be fail when owner withdraw test cash token amount greater than withdrawable amount", async () => {
      await expect(
        erc721
          .connect(owner)
          .withdraw(cashTestToken.address, owner.address, tokenAmount)
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });

    it("6.6. Should be successful when owner withdraws native token", async () => {
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

    it("6.7. Should be successful when owner withdraws cash test token", async () => {
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

  describe("7. Transfer", () => {
    beforeEach(async () => {
      initParams();
      await mintToken(erc721, users[0], users[0].address, params, verifier);
      tokenId = await erc721.lastId();
    });

    it("7.1. Should be fail when sender transfer token to self", async () => {
      await expect(
        erc721.connect(users[0]).transfer(users[0].address, tokenId)
      ).to.be.revertedWith("Transfer to yourself");
    });

    it("7.2. Should be fail when recipient address is zero address", async () => {
      await expect(
        erc721.connect(users[0]).transfer(ZERO_ADDRESS, tokenId)
      ).to.be.revertedWith("ERC721: transfer to the zero address");
    });

    it("7.3. Should be fail when token is nonexistent", async () => {
      await expect(
        erc721
          .connect(users[0])
          .transfer(users[1].address, NONEXISTENT_TOKEN_ID)
      ).to.be.revertedWith("Nonexistent token.");
    });

    it('7.4. Should be fail when type of token is not "Normal"', async () => {
      const newType = TokenType.Furusato;
      const signature = await getSignatureSetType(
        erc721,
        tokenId,
        newType,
        verifier
      );
      await erc721.setType(tokenId, newType, signature);
      await expect(
        erc721.connect(users[0]).transfer(users[1].address, tokenId)
      ).to.be.revertedWith("Can not transfer token");
    });

    it("7.5. Should be fail when token is not owned by sender", async () => {
      await expect(
        erc721.connect(users[1]).transfer(users[0].address, tokenId)
      ).to.be.revertedWith("ERC721: caller is not token owner or approved");
    });

    it("7.6. Should transfer successfully", async () => {
      await expect(erc721.connect(users[0]).transfer(users[1].address, tokenId))
        .to.emit(erc721, "Transfer")
        .withArgs(users[0].address, users[1].address, tokenId)
        .changeTokenBalances(
          erc721,
          [users[0].address, users[1].address],
          [-1, 1]
        );
      expect(await erc721.ownerOf(tokenId)).to.be.equal(users[1].address);
    });
  });

  describe("8. Buy", () => {
    const price = ethers.utils.parseEther("1");
    const amount = ethers.utils.parseEther("1");
    const tokenPrice = ethers.utils.parseUnits("1", DECIMALS);
    const tokenAmount = ethers.utils.parseUnits("1", DECIMALS);

    beforeEach(async () => {
      // Mint token by paying native token
      initParams();
      params.price = price;
      params.amount = amount;
      await mintToken(erc721, users[0], users[0].address, params, verifier);
      tokenId = await erc721.lastId();

      // Mint token by paying test cash token
      params.price = tokenPrice;
      params.amount = tokenAmount;
      params.paymentToken = cashTestToken.address;
      await mintToken(erc721, users[0], users[0].address, params, verifier);
    });

    it("8.1. Should be fail when buy a nonexistent token", async () => {
      await expect(erc721.buy(NONEXISTENT_TOKEN_ID)).to.be.revertedWith(
        "Nonexistent token."
      );
    });

    it("8.2. Should be fail when buy an owned token", async () => {
      const tokenId = await erc721.lastId();
      await expect(erc721.connect(users[0]).buy(tokenId)).to.be.revertedWith(
        "Already owned"
      );
    });

    it("8.3. Should be fail when type of token is not normal", async () => {
      const newType = TokenType.Furusato;
      const signature = await getSignatureSetType(
        erc721,
        tokenId,
        newType,
        verifier
      );
      await erc721.setType(tokenId, newType, signature);
      await expect(erc721.buy(tokenId)).to.be.revertedWith(
        "Token is not normal"
      );
    });

    it("8.4. Should be successful when user buys a token paid by native token", async () => {
      const [_, royaltyFraction] = await erc721.royaltyInfo(1, price);

      await expect(erc721.connect(users[1]).buy(1, { value: price }))
        .to.emit(erc721, "Transfer")
        .withArgs(users[0].address, users[1].address, 1)
        .to.emit(erc721, "Bought")
        .withArgs(users[0].address, users[1].address, 1)
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

    it("8.5. Should be successful when user buys a token paid by test cash token", async () => {
      const [_, royaltyFraction] = await erc721.royaltyInfo(2, tokenPrice);
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
          [users[0].address, users[1].address, artist.address],
          [tokenPrice.sub(royaltyFraction), tokenPrice.mul(-1), royaltyFraction]
        );
    });
  });

  describe("9. Donate", () => {
    beforeEach(async () => {
      // Mint token
      initParams();
      await mintToken(erc721, users[0], users[0].address, params, verifier);
      tokenId = await erc721.lastId();
    });

    it("9.1. Should be fail when token is nonexistent", async () => {
      await expect(
        erc721.connect(users[0]).donate(NONEXISTENT_TOKEN_ID, users[1].address)
      ).to.be.revertedWith("Nonexistent token");
    });

    it("9.2. Should be fail when caller does not own token", async () => {
      await expect(
        erc721.connect(users[1]).donate(tokenId, users[1].address)
      ).to.be.revertedWith("Not token owner");
    });

    it('9.3. Should be fail when type of token is not "Furusato" or "Donated"', async () => {
      await expect(
        erc721.connect(users[0]).donate(tokenId, users[1].address)
      ).to.be.revertedWith("Can not donate token");
    });

    it("9.4. Should donate successfully", async () => {
      // Set type of token into Furusato
      await setTokenType(erc721, tokenId, TokenType.Furusato, verifier);
      await expect(erc721.connect(users[0]).donate(tokenId, users[1].address))
        .to.emit(erc721, "Donated")
        .withArgs(users[0].address, users[1].address, tokenId);
      expect(await erc721.typeOf(tokenId)).to.be.equal(TokenType.Donated);
      expect(await erc721.ownerOf(tokenId)).to.be.equal(users[1].address);
    });
  });

  describe("10. Get Token URI", () => {
    beforeEach(async () => {
      initParams();
      await mintToken(erc721, users[0], users[0].address, params, verifier);
      tokenId = await erc721.lastId();
    });

    it("10.1. Should be fail when get a token is nonexistent", async () => {
      await expect(erc721.tokenURI(NONEXISTENT_TOKEN_ID)).to.be.revertedWith(
        "Nonexistent token."
      );
    });

    it("10.2. Should return exactly token URI", async () => {
      expect(await erc721.tokenURI(tokenId)).to.be.equal(params.tokenURI);
    });

    it("10.3. Should retrieve exacty token URI after setting token URI", async () => {
      const newTokenURI = "ipfs://new.json";
      params.tokenURI = newTokenURI;
      const signature = await getSignatureSetTokenURI(
        erc721,
        tokenId,
        newTokenURI,
        verifier
      );
      await erc721.setTokenURI(tokenId, params.tokenURI, signature);
      expect(await erc721.tokenURI(tokenId)).to.be.equal(newTokenURI);
    });
  });
});
