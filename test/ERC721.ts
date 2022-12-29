import { TokenInputStruct } from "./../typechain-types/contracts/ERC721";
import { upgrades } from "hardhat";
import hre from "hardhat";
import { expect } from "chai";
import { ZERO_ADDRESS } from "@openzeppelin/test-helpers/src/constants";
import { BigNumber, Bytes, Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { blockTimestamp } from "./utils";

const MAX_UINT256 = ethers.constants.MaxUint256;
const provider = ethers.provider;
const tokenName = "Token";
const symbol = "TKN";
const tokenURI = "ipfs://tokenURI";
const sampleSignature =
  "0x1c8aff950685c2ed4bc3174f3472287b56d9517b9c948127319a09a7a36deac8";
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
  let users: SignerWithAddress[];
  let expiration: BigNumber;
  let tokenInput: TokenInputStruct = {
    tokenId: 0,
    tokenURI: "",
    paymentToken: ZERO_ADDRESS,
    amount: 0,
    price: 0,
    status: true,
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
      tokenInput.status
    );
    const signature = await signer.signMessage(ethers.utils.arrayify(hash));
    return signature;
  };

  const mintToken = async (caller: SignerWithAddress, to: string) => {
    tokenInput.tokenId = 0;
    tokenInput.tokenURI = "ipfs://1.json";
    tokenInput.amount = ethers.utils.parseEther("1");
    tokenInput.price = ethers.utils.parseEther("1");
    const signature = await getSignature(tokenInput, verifier);

    if (tokenInput.paymentToken === ZERO_ADDRESS) {
      await erc721.connect(caller).mint(to, tokenInput, signature, {
        value: ethers.utils.parseEther("1"),
      });
    } else {
      await erc721.connect(caller).mint(to, tokenInput, signature);
    }
  };

  beforeEach(async () => {
    const ERC721 = await hre.ethers.getContractFactory("ERC721");
    const CashTestToken = await hre.ethers.getContractFactory("CashTestToken");

    const [_owner, _admin, _verifier, _royaltyReceiver, ..._users] =
      await hre.ethers.getSigners();
    owner = _owner;
    admin = _admin;
    verifier = _verifier;
    users = _users;
    royaltyReceiver = _royaltyReceiver;

    erc721 = await upgrades.deployProxy(ERC721, [
      owner.address,
      tokenName,
      symbol,
      YEAR_TO_SECONDS,
      royaltyReceiver.address,
      royaltyPercentage,
    ]);
    await erc721.deployed();

    cashTestToken = await CashTestToken.deploy("Test Token", "TKN", 12);
    await cashTestToken.deployed();

    await erc721.connect(owner).setAdmin(admin.address);
    await erc721.connect(admin).setVerifier(verifier.address);
    expiration = await erc721.expiration();

    const allowance = ethers.utils.parseUnits("1000", 12);
    await cashTestToken.mintForList(
      [users[0].address, users[1].address, users[2].address],
      allowance
    );
    await cashTestToken.connect(users[0]).approve(erc721.address, allowance);
    await cashTestToken.connect(users[0]).approve(erc721.address, allowance);
    await cashTestToken.connect(users[0]).approve(erc721.address, allowance);
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
      tokenInput = {
        tokenId: 0,
        tokenURI: "",
        status: true,
        paymentToken: ZERO_ADDRESS,
        amount: 0,
        price: 0,
      };
    });

    it("2.1. Should be fail when address is zero address", async () => {
      await expect(
        erc721.mint(ZERO_ADDRESS, tokenInput, sampleSignature)
      ).to.be.revertedWith("Invalid address");
    });

    it("2.2. Should be fail when amount is equal 0", async () => {
      tokenInput.paymentToken = cashTestToken.address;
      await expect(
        erc721.mint(users[0].address, tokenInput, sampleSignature)
      ).to.be.revertedWith("Invalid amount of money");
    });

    it("2.3. Should be fail when price of token is equal 0", async () => {
      tokenInput.amount = 1;
      await expect(
        erc721.mint(users[0].address, tokenInput, sampleSignature)
      ).to.be.revertedWith("Invalid amount of money");
    });

    it("2.4. Should be fail when user pay native token and msg.value is not equal amount", async () => {
      tokenInput.price = 1;
      await expect(
        erc721.mint(users[0].address, tokenInput, sampleSignature, {
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
      tokenInput.paymentToken = cashTestToken.address;
      await expect(
        erc721.mint(users[0].address, tokenInput, sampleSignature)
      ).to.be.revertedWith("Not enough money");
    });

    it("2.7. Should be fail when transaction is not signed by verifier", async () => {
      tokenInput.tokenURI = "ipfs://1.json";
      tokenInput.amount = ethers.utils.parseEther("1");
      tokenInput.price = ethers.utils.parseEther("1");
      const hash = await erc721.getMessageHash(
        tokenInput.tokenId,
        tokenInput.tokenURI,
        tokenInput.paymentToken,
        tokenInput.amount,
        tokenInput.price,
        tokenInput.status
      );
      // Owner sign message
      const sig = await owner.signMessage(ethers.utils.arrayify(hash));
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
      tokenInput.amount = price;
      tokenInput.price = price;
      const oldTokenId = await erc721.lastId();
      const hash = await erc721.getMessageHash(
        tokenInput.tokenId,
        tokenInput.tokenURI,
        tokenInput.paymentToken,
        tokenInput.amount,
        tokenInput.price,
        tokenInput.status
      );
      const sig = await verifier.signMessage(ethers.utils.arrayify(hash));

      await expect(
        erc721.connect(users[0]).mint(users[0].address, tokenInput, sig, {
          value: ethers.utils.parseEther("1"),
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
        await erc721.ownerBalanceOf(tokenInput.paymentToken, users[0].address)
      ).to.be.equal(price);
    });

    it("2.9. Should mint successfully when user pay other token", async () => {
      const price = ethers.utils.parseUnits("1", 12);
      const negativePrice = ethers.utils.parseUnits("-1", 12);
      tokenInput.tokenURI = "ipfs://1.json";
      tokenInput.amount = price;
      tokenInput.price = price;
      tokenInput.paymentToken = cashTestToken.address;
      const oldTokenId = await erc721.lastId();

      const hash = await erc721.getMessageHash(
        tokenInput.tokenId,
        tokenInput.tokenURI,
        tokenInput.paymentToken,
        tokenInput.amount,
        tokenInput.price,
        tokenInput.status
      );

      const sig = await verifier.signMessage(ethers.utils.arrayify(hash));

      await expect(
        erc721.connect(users[0]).mint(users[0].address, tokenInput, sig)
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
        await erc721.ownerBalanceOf(tokenInput.paymentToken, users[0].address)
      ).to.be.equal(price);
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
      tokenInput = {
        tokenId: 0,
        tokenURI: "ipfs://1.json",
        paymentToken: ZERO_ADDRESS,
        amount: ethers.utils.parseEther("1"),
        price: ethers.utils.parseEther("1"),
        status: true,
      };

      const hash = await erc721.getMessageHash(
        tokenInput.tokenId,
        tokenInput.tokenURI,
        tokenInput.paymentToken,
        tokenInput.amount,
        tokenInput.price,
        tokenInput.status
      );
      const sig = await verifier.signMessage(ethers.utils.arrayify(hash));

      await erc721.connect(users[0]).mint(users[0].address, tokenInput, sig, {
        value: ethers.utils.parseEther("1"),
      });
    });

    it("6.1. Should be fail when token ID is nonexistent", async () => {
      await expect(
        erc721.setTokenURI(NONEXISTENT_TOKEN_ID, tokenURI, sampleSignature)
      ).to.be.revertedWith("ERC721Metadata: URI set of nonexistent token");
    });

    it("6.2. Should be fail when transaction is not signed by verifier", async () => {
      const tokenId = await erc721.lastId();
      tokenInput.tokenId = tokenId;
      tokenInput.tokenURI = "ipfs://2.json";
      tokenInput.amount = 0;
      tokenInput.price = 0;

      const hash = await erc721.getMessageHash(
        tokenInput.tokenId,
        tokenInput.tokenURI,
        tokenInput.paymentToken,
        tokenInput.price,
        tokenInput.amount,
        tokenInput.status
      );
      const sig = await owner.signMessage(ethers.utils.arrayify(hash));

      await expect(
        erc721.setTokenURI(tokenId, tokenURI, sig)
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

      const correctHash = await erc721.getMessageHash(
        tokenInput.tokenId,
        tokenInput.tokenURI,
        tokenInput.paymentToken,
        tokenInput.price,
        tokenInput.amount,
        tokenInput.status
      );
      const sig = await verifier.signMessage(
        ethers.utils.arrayify(correctHash)
      );
      await expect(
        erc721.setTokenURI(tokenId, correctTokenURI, sig)
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
      const correctHash = await erc721.getMessageHash(
        tokenInput.tokenId,
        tokenInput.tokenURI,
        tokenInput.paymentToken,
        tokenInput.price,
        tokenInput.amount,
        tokenInput.status
      );
      const signature = await verifier.signMessage(
        ethers.utils.arrayify(correctHash)
      );

      await expect(erc721.setTokenURI(tokenId, newTokenURI, signature))
        .to.emit(erc721, "SetTokenURI")
        .withArgs(tokenId, oldTokenURI, newTokenURI);
      expect(await erc721.tokenURI(tokenId)).to.be.equal(newTokenURI);
    });
  });

  describe("7. Set Token Status", () => {
    let currentTokenId: BigNumber;
    let currentStatusOfToken: boolean;

    beforeEach(async () => {
      // Create params to mint token
      tokenInput = {
        tokenId: 0,
        tokenURI: "ipfs://1.json",
        paymentToken: ZERO_ADDRESS,
        amount: ethers.utils.parseEther("1"),
        price: ethers.utils.parseEther("1"),
        status: true,
      };

      const hash = await erc721.getMessageHash(
        tokenInput.tokenId,
        tokenInput.tokenURI,
        tokenInput.paymentToken,
        tokenInput.amount,
        tokenInput.price,
        tokenInput.status
      );
      const sig = await verifier.signMessage(ethers.utils.arrayify(hash));

      await erc721.connect(users[0]).mint(users[0].address, tokenInput, sig, {
        value: ethers.utils.parseEther("1"),
      });

      currentTokenId = await erc721.lastId();
      currentStatusOfToken = await erc721.statusOf(currentTokenId);

      // Create params to set token URI
      tokenInput.tokenId = currentTokenId;
      tokenInput.tokenURI = "";
      tokenInput.amount = 0;
      tokenInput.price = 0;
    });

    it("7.1. Should be fail when set a token is nonexistent", async () => {
      await expect(
        erc721.setTokenStatus(NONEXISTENT_TOKEN_ID, false, sampleSignature)
      ).to.be.revertedWith("ERC721Metadata: URI set of nonexistent token");
    });

    it("7.2. Should be fail when set value is equal status of current token", async () => {
      await expect(
        erc721.setTokenStatus(
          currentTokenId,
          currentStatusOfToken,
          sampleSignature
        )
      ).to.be.revertedWith("Duplicate value");
    });

    it("7.3. Should be fail when transaction is not signed by verifier", async () => {
      const signature = await getSignature(tokenInput, owner);
      await expect(
        erc721.setTokenStatus(currentTokenId, !currentStatusOfToken, signature)
      ).to.be.revertedWith("SetTokenStatus: Invalid signature");
    });

    it("7.4. Should be fail when signature is invalid", async () => {
      tokenInput.status = currentStatusOfToken;
      const signature = await getSignature(tokenInput, verifier);
      await expect(
        erc721.setTokenStatus(currentTokenId, !currentStatusOfToken, signature)
      ).to.be.revertedWith("SetTokenStatus: Invalid signature");
    });

    it("7.5. Should set successfully", async () => {
      tokenInput.status = !currentStatusOfToken;
      const signature = await getSignature(tokenInput, verifier);
      await expect(
        erc721.setTokenStatus(currentTokenId, tokenInput.status, signature)
      )
        .to.emit(erc721, "SetTokenStatus")
        .withArgs(currentTokenId, tokenInput.status);
      expect(await erc721.statusOf(currentTokenId)).to.be.equal(
        tokenInput.status
      );
    });
  });

  describe("8. Get token URI", () => {
    let currentTokenId: BigNumber;

    beforeEach(async () => {
      tokenInput = {
        tokenId: 0,
        tokenURI: "",
        paymentToken: ZERO_ADDRESS,
        price: ethers.utils.parseEther("1"),
        amount: ethers.utils.parseEther("1"),
        status: true,
      };
      const signature = await getSignature(tokenInput, verifier);
      await erc721.mint(users[0].address, tokenInput, signature, {
        value: ethers.utils.parseEther("1"),
      });
      currentTokenId = await erc721.lastId();
    });

    it("8.1. Should be fail when get a token is nonexistent", async () => {
      await expect(erc721.tokenURI(NONEXISTENT_TOKEN_ID)).to.be.revertedWith(
        "ERC721Metadata: URI query for nonexistent token."
      );
    });

    it("8.2. Should return exact token URI", async () => {
      expect(await erc721.tokenURI(currentTokenId)).to.be.equal(
        tokenInput.tokenURI
      );
    });

    it("8.3. Should retrieve exacty token URI after setting", async () => {
      const newTokenURI = "ipfs://new.json";
      tokenInput.tokenId = currentTokenId;
      tokenInput.tokenURI = newTokenURI;
      tokenInput.price = 0;
      tokenInput.amount = 0;
      const signature = await getSignature(tokenInput, verifier);
      await erc721.setTokenURI(currentTokenId, tokenInput.tokenURI, signature);
      expect(await erc721.tokenURI(currentTokenId)).to.be.equal(newTokenURI);
    });
  });

  describe("9. Withdraw", () => {
    let currentTokenId: BigNumber;

    beforeEach(async () => {
      await mintToken(users[0], users[0].address);
      currentTokenId = await erc721.lastId();
    });

    it("9.1. Should be fail when caller is not owner", async () => {
      await expect(
        erc721
          .connect(admin)
          .withdraw(ZERO_ADDRESS, admin.address, ethers.utils.parseEther("1"))
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("9.2. Should be fail when address is zero addess", async () => {
      await expect(
        erc721
          .connect(owner)
          .withdraw(ZERO_ADDRESS, ZERO_ADDRESS, ethers.utils.parseEther("1"))
      ).to.be.revertedWith("Invalid address");
    });

    it("9.3. Should be fail when amount is equal 0", async () => {
      await expect(
        erc721
          .connect(owner)
          .withdraw(ZERO_ADDRESS, owner.address, ethers.utils.parseEther("0"))
      ).to.be.revertedWith("Invalid amount");
    });

    it("9.4. Should be successfull when owner withdraw native token", async () => []);
  });

  describe("10. Claim", () => {});

  describe("11. Transfer", () => {});
});
