import { TokenInputStruct } from "../typechain-types/contracts/ERC721";
import { ethers, upgrades } from "hardhat";
import { expect } from "chai";
import { BigNumber, Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { blockTimestamp } from "./utils";

const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");
const tokenName = "Token";
const symbol = "TKN";
const decimal = 8;
const tokenURI = "ipfs://tokenURI";
const sampleSignature =
  "0xe061bcd7ddefb1dbef4bb6e16bc0fc8f5c1edebbd3a94c3e7bfafae9966fae5936458df7c8cc4bf664641978b79d915c95db6907057f2bfe9610a323a2dad7281c";
const YEAR_TO_SECONDS = 31_556_926;
const NONEXISTENT_TOKEN_ID = 9999;
const royaltyPercentage = 10;

describe("ERC721", () => {
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
      tokenInput.amount,
      tokenInput.price,
      tokenInput.owner,
      tokenInput.status
    );
    const signature = await signer.signMessage(ethers.utils.arrayify(hash));
    return signature;
  };

  const mintToken = async (
    caller: SignerWithAddress,
    to: string,
    tokenInput: TokenInputStruct
  ) => {
    const signature = await getSignature(tokenInput, verifier);

    if (tokenInput.paymentToken === ZERO_ADDRESS) {
      await erc721.connect(caller).mint(to, tokenInput, signature, {
        value: tokenInput.amount,
      });
    } else {
      await erc721.connect(caller).mint(to, tokenInput, signature);
    }
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
    expiration = await erc721.expiration();

    const allowance = ethers.utils.parseUnits("10000000", decimal);
    await cashTestToken.mintForList(
      [users[0].address, users[1].address, users[2].address],
      allowance
    );
    await cashTestToken.connect(users[0]).approve(erc721.address, allowance);
    await cashTestToken.connect(users[1]).approve(erc721.address, allowance);
    await cashTestToken.connect(users[2]).approve(erc721.address, allowance);
  });

  describe("1. Initialize", () => {
    it("1.1. Should assign state successfully", async () => {
      expect(await erc721.owner()).to.be.equal(owner.address);
      expect(await erc721.name()).to.be.equal(tokenName);
      expect(await erc721.symbol()).to.be.equal(symbol);
      expect(await erc721.lastId()).to.be.equal(0);
      expect(await erc721.expiration()).to.be.equal(YEAR_TO_SECONDS);
    });
  });

  describe("2. Mint", () => {
    beforeEach(() => {
      resetTokenInput();
    });
    it("2.1. Should be fail when address is zero address", async () => {
      await expect(
        erc721.mint(ZERO_ADDRESS, tokenInput, sampleSignature)
      ).to.be.revertedWith("Invalid address");
    });

    it("2.2. Should be fail when amount is equal 0", async () => {
      tokenInput.price = ethers.utils.parseEther("1");
      await expect(
        erc721.mint(users[0].address, tokenInput, sampleSignature)
      ).to.be.revertedWith("Invalid price and amount");
    });

    it("2.3. Should be fail when price is equal 0", async () => {
      tokenInput.amount = ethers.utils.parseEther("1");
      await expect(
        erc721.mint(users[0].address, tokenInput, sampleSignature)
      ).to.be.revertedWith("Invalid price and amount");
    });

    it("2.4. Should be fail when user pay native token and msg.value is not equal amount", async () => {
      tokenInput.price = ethers.utils.parseEther("1");
      tokenInput.amount = ethers.utils.parseEther("2");
      const signature = await getSignature(tokenInput, verifier);
      await expect(
        erc721.mint(users[0].address, tokenInput, signature, {
          value: ethers.utils.parseEther("1"),
        })
      ).to.be.revertedWith("Invalid amount of money");
    });

    it("2.5. Should be fail when user pay native token less than price of token", async () => {
      tokenInput.price = ethers.utils.parseEther("1");
      tokenInput.amount = ethers.utils.parseEther("0.5");
      await expect(
        erc721.mint(users[0].address, tokenInput, sampleSignature, {
          value: ethers.utils.parseEther("0.5"),
        })
      ).to.be.revertedWith("Not enough money");
    });

    it("2.6. Should be fail when user pay other token less than price of token", async () => {
      tokenInput.price = ethers.utils.parseEther("1");
      tokenInput.amount = ethers.utils.parseEther("0.5");
      await expect(
        erc721.mint(users[0].address, tokenInput, sampleSignature)
      ).to.be.revertedWith("Not enough money");
    });

    it("2.7. Should be fail when transaction is not signed by verifier", async () => {
      tokenInput.tokenURI = "ipfs://1.json";
      tokenInput.amount = ethers.utils.parseEther("1");
      tokenInput.price = ethers.utils.parseEther("1");
      const sig = await getSignature(tokenInput, owner);
      await expect(
        erc721.mint(users[0].address, tokenInput, sig, {
          value: ethers.utils.parseEther("1"),
        })
      ).to.be.revertedWith("Mint: Invalid signature");
    });

    it("2.8. Should mint successfully when user pay native token", async () => {
      const price = ethers.utils.parseEther("1");
      const negativePrice = ethers.utils.parseEther("-1");
      tokenInput.tokenURI = "ipfs://1.json";
      tokenInput.amount = price.add(price);
      tokenInput.price = price;
      tokenInput.owner = government.address;
      const oldTokenId = await erc721.lastId();
      const signature = await getSignature(tokenInput, verifier);

      await expect(
        erc721.connect(users[0]).mint(users[0].address, tokenInput, signature, {
          value: tokenInput.amount,
        })
      ).to.changeEtherBalances(
        [users[0].address, erc721.address],
        [negativePrice, price]
      );

      const currentBlockTimestamp = BigNumber.from(await blockTimestamp());
      const currentTokenId = await erc721.lastId();

      expect(currentTokenId).to.be.equal(oldTokenId.add(1));
      expect(await erc721.tokenURI(currentTokenId)).to.be.equal(
        tokenInput.tokenURI
      );
      expect(await erc721.ownerOf(currentTokenId)).to.be.equal(
        users[0].address
      );
      expect(await erc721.statusOf(currentTokenId)).to.be.equal(true);
      expect(await erc721.expirationOf(currentTokenId)).to.be.equal(
        currentBlockTimestamp.add(expiration)
      );
      expect(
        await erc721.ownerBalanceOf(tokenInput.paymentToken, government.address)
      ).to.be.equal(tokenInput.amount);
      expect(await erc721.tokenIdOf(signature)).to.be.equal(currentTokenId);
    });

    it("2.9. Should mint successfully when user pay other token", async () => {
      const price = ethers.utils.parseUnits("1", decimal);
      const negativePrice = ethers.utils.parseUnits("-1", decimal);
      tokenInput.tokenURI = "ipfs://1.json";
      tokenInput.amount = price;
      tokenInput.price = price;
      tokenInput.paymentToken = cashTestToken.address;
      tokenInput.owner = government.address;
      const oldTokenId = await erc721.lastId();
      const signature = await getSignature(tokenInput, verifier);

      await expect(
        erc721.connect(users[0]).mint(users[0].address, tokenInput, signature)
      ).to.changeTokenBalances(
        cashTestToken,
        [users[0].address, erc721.address],
        [negativePrice, price]
      );

      const currentBlockTimestamp = BigNumber.from(await blockTimestamp());
      const currentTokenId = await erc721.lastId();

      expect(currentTokenId).to.be.equal(oldTokenId.add(1));
      expect(await erc721.tokenURI(currentTokenId)).to.be.equal(
        tokenInput.tokenURI
      );
      expect(await erc721.ownerOf(currentTokenId)).to.be.equal(
        users[0].address
      );
      expect(await erc721.statusOf(currentTokenId)).to.be.equal(true);
      expect(await erc721.expirationOf(currentTokenId)).to.be.equal(
        currentBlockTimestamp.add(expiration)
      );
      expect(
        await erc721.ownerBalanceOf(tokenInput.paymentToken, government.address)
      ).to.be.equal(tokenInput.amount);
      expect(await erc721.tokenIdOf(signature)).to.be.equal(currentTokenId);
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

    it("3.3. Should set successfully", async () => {
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

    it("4.3. Should set successfully", async () => {
      expect(await erc721.connect(admin).setVerifier(users[0].address))
        .to.emit(erc721, "SetVerifier")
        .withArgs(verifier.address, users[0].address);
      expect(await erc721.verifier()).to.be.equal(users[0].address);
    });
  });

  describe("5. Set Expiration", () => {
    it("5.1. Should be fail when caller is not the admin", async () => {
      await expect(
        erc721.connect(owner).setExpiration(YEAR_TO_SECONDS)
      ).to.be.revertedWith("Ownable: Caller is not admin");
    });

    it("5.2. Should be fail when setting 0", async () => {
      await expect(erc721.connect(admin).setExpiration(0)).to.be.revertedWith(
        "Invalid expired period"
      );
    });

    it("5.3. Should set successfully", async () => {
      const oldExpiration = await erc721.expiration();
      expect(await erc721.connect(admin).setExpiration(YEAR_TO_SECONDS))
        .to.emit(erc721, "SetExpiration")
        .withArgs(oldExpiration, YEAR_TO_SECONDS);
      expect(await erc721.expiration()).to.be.equal(YEAR_TO_SECONDS);
    });
  });

  describe("6. Set Token URI", () => {
    beforeEach(async () => {
      resetTokenInput();
      tokenInput.tokenURI = "ipfs://1.json";
      tokenInput.amount = ethers.utils.parseEther("1");
      tokenInput.price = ethers.utils.parseEther("1");
      await mintToken(users[0], users[0].address, tokenInput);
      tokenId = await erc721.lastId();
    });

    it("6.1. Should be fail when token ID is nonexistent", async () => {
      await expect(
        erc721.setTokenURI(NONEXISTENT_TOKEN_ID, tokenURI, sampleSignature)
      ).to.be.revertedWith("ERC721Metadata: URI set of nonexistent token");
    });

    it("6.2. Should be fail when transaction is not signed by verifier", async () => {
      tokenInput.tokenId = tokenId;
      tokenInput.tokenURI = "ipfs://2.json";
      tokenInput.amount = 0;
      tokenInput.price = 0;
      const signature = await getSignature(tokenInput, verifier);

      await expect(
        erc721.setTokenURI(tokenId, tokenURI, signature)
      ).to.be.revertedWith("SetTokenURI: Invalid signature");
    });

    it("6.3. Should be fail when signature data is invalid", async () => {
      const correctTokenURI = "ipfs://2.json";
      const wrongTokenURI = "ipfs://dump";
      const tokenId = await erc721.lastId();
      tokenInput.tokenId = tokenId;
      tokenInput.tokenURI = wrongTokenURI;
      tokenInput.amount = 0;
      tokenInput.price = 0;
      const signature = await getSignature(tokenInput, verifier);

      await expect(
        erc721.setTokenURI(tokenId, correctTokenURI, signature)
      ).to.be.revertedWith("SetTokenURI: Invalid signature");
    });

    it("6.4. Should set successfully", async () => {
      const newTokenURI = "ipfs://2.json";
      const tokenId = await erc721.lastId();
      const oldTokenURI = await erc721.tokenURI(tokenId);
      tokenInput.tokenId = tokenId;
      tokenInput.tokenURI = newTokenURI;
      tokenInput.amount = 0;
      tokenInput.price = 0;
      const signature = await getSignature(tokenInput, verifier);

      await expect(erc721.setTokenURI(tokenId, newTokenURI, signature))
        .to.emit(erc721, "SetTokenURI")
        .withArgs(tokenId, oldTokenURI, newTokenURI);
      expect(await erc721.tokenURI(tokenId)).to.be.equal(newTokenURI);
    });
  });

  describe("7. Set Token Status", () => {
    let statusOfToken: boolean;

    beforeEach(async () => {
      resetTokenInput();
      tokenInput.tokenURI = "ipfs://1.json";
      tokenInput.amount = ethers.utils.parseEther("1");
      tokenInput.price = ethers.utils.parseEther("1");

      await mintToken(users[0], users[0].address, tokenInput);
      tokenId = await erc721.lastId();
      statusOfToken = await erc721.statusOf(tokenId);
      resetTokenInput();
      tokenInput.tokenId = tokenId;
    });

    it("7.1. Should be fail when set a token is nonexistent", async () => {
      await expect(
        erc721.setTokenStatus(NONEXISTENT_TOKEN_ID, false, sampleSignature)
      ).to.be.revertedWith("ERC721Metadata: URI set of nonexistent token");
    });

    it("7.2. Should be fail when set value is equal status of current token", async () => {
      await expect(
        erc721.setTokenStatus(tokenId, statusOfToken, sampleSignature)
      ).to.be.revertedWith("Duplicate value");
    });

    it("7.3. Should be fail when transaction is not signed by verifier", async () => {
      const signature = await getSignature(tokenInput, owner);
      await expect(
        erc721.setTokenStatus(tokenId, !statusOfToken, signature)
      ).to.be.revertedWith("SetTokenStatus: Invalid signature");
    });

    it("7.4. Should be fail when signature is invalid", async () => {
      tokenInput.status = statusOfToken;
      const signature = await getSignature(tokenInput, verifier);
      await expect(
        erc721.setTokenStatus(tokenId, !statusOfToken, signature)
      ).to.be.revertedWith("SetTokenStatus: Invalid signature");
    });

    it("7.5. Should set successfully", async () => {
      tokenInput.status = !statusOfToken;
      const signature = await getSignature(tokenInput, verifier);
      await expect(erc721.setTokenStatus(tokenId, tokenInput.status, signature))
        .to.emit(erc721, "SetTokenStatus")
        .withArgs(tokenId, tokenInput.status);
      expect(await erc721.statusOf(tokenId)).to.be.equal(tokenInput.status);
    });
  });

  describe("8. Get token URI", () => {
    beforeEach(async () => {
      resetTokenInput();
      tokenInput.tokenURI = "ipfs://1.json";
      tokenInput.amount = ethers.utils.parseEther("1");
      tokenInput.price = ethers.utils.parseEther("1");
      await mintToken(users[0], users[0].address, tokenInput);
      tokenId = await erc721.lastId();
      tokenId = await erc721.lastId();
    });

    it("8.1. Should be fail when get a token is nonexistent", async () => {
      await expect(erc721.tokenURI(NONEXISTENT_TOKEN_ID)).to.be.revertedWith(
        "ERC721Metadata: URI query for nonexistent token."
      );
    });

    it("8.2. Should return exact token URI", async () => {
      expect(await erc721.tokenURI(tokenId)).to.be.equal(tokenInput.tokenURI);
    });

    it("8.3. Should retrieve exacty token URI after setting token URI", async () => {
      const newTokenURI = "ipfs://new.json";
      resetTokenInput();
      tokenInput.tokenId = tokenId;
      tokenInput.tokenURI = newTokenURI;
      const signature = await getSignature(tokenInput, verifier);
      await erc721.setTokenURI(tokenId, tokenInput.tokenURI, signature);
      expect(await erc721.tokenURI(tokenId)).to.be.equal(newTokenURI);
    });
  });

  describe("9. Withdraw", () => {
    const price = ethers.utils.parseEther("1");
    const amount = ethers.utils.parseEther("5");
    const redundant = amount.sub(price);
    const negativeRedundant = redundant.mul(-1);
    const tokenPrice = ethers.utils.parseUnits("1", decimal);
    const tokenAmount = ethers.utils.parseUnits("5", decimal);
    const tokenRedundant = tokenAmount.sub(tokenPrice);
    const negativeTokenRedundant = tokenRedundant.mul(-1);

    beforeEach(async () => {
      // Mint token with 5 native token
      resetTokenInput();
      tokenInput.price = price;
      tokenInput.amount = amount;
      tokenInput.owner = government.address;
      await mintToken(users[0], users[0].address, tokenInput);

      // Mint token with 5 cash test token
      resetTokenInput();
      tokenInput.paymentToken = cashTestToken.address;
      tokenInput.price = tokenPrice;
      tokenInput.amount = tokenAmount;
      tokenInput.owner = government.address;
      await mintToken(users[0], users[0].address, tokenInput);
    });

    it("9.1. Should be fail when caller is not owner", async () => {
      await expect(
        erc721.connect(admin).withdraw(ZERO_ADDRESS, admin.address, redundant)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("9.2. Should be fail when address is zero addess", async () => {
      await expect(
        erc721.connect(owner).withdraw(ZERO_ADDRESS, ZERO_ADDRESS, redundant)
      ).to.be.revertedWith("Invalid address");
    });

    it("9.3. Should be fail when amount is equal 0", async () => {
      await expect(
        erc721.connect(owner).withdraw(ZERO_ADDRESS, owner.address, 0)
      ).to.be.revertedWith("Invalid amount");
    });

    it("9.4. Should be fail when owner withdraw amount greater than withdrawable amount", async () => {
      await expect(
        erc721.connect(owner).withdraw(ZERO_ADDRESS, owner.address, amount)
      ).to.be.revertedWith("Invalid amount");
    });

    it("9.5. Should be successfull when owner withdraw native token", async () => {
      await expect(
        erc721.connect(owner).withdraw(ZERO_ADDRESS, owner.address, redundant)
      ).changeEtherBalances(
        [erc721.address, owner.address],
        [negativeRedundant, redundant]
      );
    });

    it.only("9.6. Should withdraw successfully when owner withdraw other token", async () => {
      await expect(
        erc721
          .connect(owner)
          .withdraw(cashTestToken.address, owner.address, tokenRedundant)
      ).changeTokenBalances(
        cashTestToken,
        [erc721.address, owner.address],
        [negativeTokenRedundant, tokenRedundant]
      );
    });
  });

  describe("10. Claim", () => {
    const price = ethers.utils.parseEther("1");
    const amount = ethers.utils.parseEther("1");
    const negativeAmount = ethers.utils.parseEther("-1");
    const tokenPrice = ethers.utils.parseUnits("1", decimal);
    const tokenAmount = ethers.utils.parseUnits("1", decimal);
    const negativeTokenAmount = ethers.utils.parseUnits("-1", decimal);
    beforeEach(async () => {
      // Mint token with 1 native token
      resetTokenInput();
      tokenInput.price = price;
      tokenInput.amount = amount;
      tokenInput.owner = government.address;
      await mintToken(users[0], users[0].address, tokenInput);

      // Mint token with 1 cash test token
      resetTokenInput();
      tokenInput.paymentToken = cashTestToken.address;
      tokenInput.price = tokenPrice;
      tokenInput.amount = tokenAmount;
      tokenInput.owner = government.address;
      await mintToken(users[0], users[0].address, tokenInput);
    });

    it("10.1. Should be fail when recipient address is zero address", async () => {
      await expect(
        erc721.claim(
          ZERO_ADDRESS,
          ZERO_ADDRESS,
          ethers.utils.parseUnits("1", decimal)
        )
      ).to.be.revertedWith("Invalid address");
    });

    it("10.2. Should be fail when amount of money want to claim is greater than current balance", async () => {
      await expect(
        erc721.claim(
          ZERO_ADDRESS,
          government.address,
          ethers.utils.parseEther("0")
        )
      ).to.be.revertedWith("Invalid amount");
    });

    it("10.3. Should withdraw successfully with native token", async () => {
      const ownerBalanceBefore = await erc721.ownerBalanceOf(
        ZERO_ADDRESS,
        government.address
      );
      const tx = erc721.claim(ZERO_ADDRESS, government.address, amount);

      await expect(tx)
        .to.emit(erc721, "Claimed")
        .withArgs(ZERO_ADDRESS, government.address, amount);
      await expect(tx).changeEtherBalances(
        [erc721.address, government.address],
        [negativeAmount, amount]
      );
      expect(
        await erc721.ownerBalanceOf(ZERO_ADDRESS, government.address)
      ).to.be.equal(ownerBalanceBefore.sub(amount));
    });

    // @todo Test transfer from contract to account
    it("10.4. Should withdraw successfully with native token", async () => {
      const ownerBalanceBefore = await erc721.ownerBalanceOf(
        erc721.address,
        government.address
      );

      await expect(
        erc721
          .connect(government)
          .claim(cashTestToken.address, government.address, amount)
      ).changeTokenBalances(
        cashTestToken,
        [erc721.address, government.address],
        [negativeAmount, amount]
      );
      expect(
        await erc721.ownerBalanceOf(ZERO_ADDRESS, government.address)
      ).to.be.equal(ownerBalanceBefore.sub(amount));
    });
  });

  describe("11. Transfer", () => {
    beforeEach(async () => {
      resetTokenInput();
      tokenInput.tokenURI = "ipfs://1.json";
      tokenInput.price = ethers.utils.parseEther("1");
      tokenInput.amount = ethers.utils.parseEther("1");
      await mintToken(users[0], users[0].address, tokenInput);
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
      ).to.be.revertedWith("ERC721Metadata: URI query for nonexistent token.");
    });

    it("11.4. Should be fail when token is deactive", async () => {
      resetTokenInput();
      tokenInput.tokenId = tokenId;
      tokenInput.status = false;
      const signature = await getSignature(tokenInput, verifier);
      await erc721.setTokenStatus(tokenId, tokenInput.status, signature);
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
      const expiration = await erc721.expiration();
      const tx = erc721.connect(users[0]).transfer(users[1].address, tokenId);
      await expect(tx)
        .to.emit(erc721, "Transfer")
        .withArgs(users[0].address, users[1].address, tokenId);
      await expect(tx).changeTokenBalances(
        erc721,
        [users[0].address, users[1].address],
        [-1, 1]
      );
      const currentBlockTimestamp = await blockTimestamp();
      expect(await erc721.expirationOf(tokenId)).to.be.equal(
        currentBlockTimestamp.add(expiration)
      );
      expect(await erc721.ownerOf(tokenId)).to.be.equal(users[1].address);
    });
  });
});
