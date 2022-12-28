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
const baseURI = "ipfs://";
const tokenName = "Token";
const symbol = "TKN";
const tokenURI = "ipfs://tokenURI";
const sampleSignature =
  "0x1c8aff950685c2ed4bc3174f3472287b56d9517b9c948127319a09a7a36deac8";
const YEAR_TO_SECONDS = 31_556_926;
const NONEXISTENT_TOKEN_ID = 9999;
const royaltyPercentage = 20;

describe("ERC721", () => {
  let erc721: Contract;
  let cashTestToken: Contract;
  let owner: SignerWithAddress;
  let admin: SignerWithAddress;
  let verifier: SignerWithAddress;
  let royaltyReceiver: SignerWithAddress;
  let users: SignerWithAddress[];
  let tokenInput: TokenInputStruct;
  let tokenStatus: boolean = true;
  let paymentToken = ZERO_ADDRESS;
  let amount: BigNumber = BigNumber.from(10);
  let expiration: BigNumber;

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
      // expect(await erc721.baseURI()).to.be.equal(baseURI);
      expect(await erc721.name()).to.be.equal(tokenName);
      expect(await erc721.symbol()).to.be.equal(symbol);
      expect(await erc721.lastId()).to.be.equal(0);
      expect(await erc721.expiration()).to.be.equal(YEAR_TO_SECONDS);
    });
  });

  describe("2. Mint", () => {
    let sampleInput: TokenInputStruct;

    beforeEach(() => {
      sampleInput = {
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
        erc721.mint(ZERO_ADDRESS, sampleInput, sampleSignature)
      ).to.be.revertedWith("Invalid address");
    });

    it("2.2. Should be fail when amount is equal 0", async () => {
      sampleInput.paymentToken = cashTestToken.address;
      await expect(
        erc721.mint(users[0].address, sampleInput, sampleSignature)
      ).to.be.revertedWith("Invalid amount of money");
    });

    it("2.3. Should be fail when price of token is equal 0", async () => {
      sampleInput.amount = 1;
      await expect(
        erc721.mint(users[0].address, sampleInput, sampleSignature)
      ).to.be.revertedWith("Invalid amount of money");
    });

    it("2.4. Should be fail when user pay native token and msg.value is not equal amount", async () => {
      sampleInput.price = 1;
      await expect(
        erc721.mint(users[0].address, sampleInput, sampleSignature, {
          value: ethers.utils.parseEther("1"),
        })
      ).to.be.revertedWith("Invalid amount of money");
    });

    it("2.5. Should be fail when user pay native token less than price of token", async () => {
      sampleInput.price = ethers.utils.parseEther("1");
      sampleInput.amount = ethers.utils.parseEther("0.5");
      await expect(
        erc721.mint(users[0].address, sampleInput, sampleSignature, {
          value: ethers.utils.parseEther("0.5"),
        })
      ).to.be.revertedWith("Not enough money");
    });

    it("2.6. Should be fail when user pay other token less than price of token", async () => {
      sampleInput.price = ethers.utils.parseEther("1");
      sampleInput.amount = ethers.utils.parseEther("0.5");
      sampleInput.paymentToken = cashTestToken.address;
      await expect(
        erc721.mint(users[0].address, sampleInput, sampleSignature)
      ).to.be.revertedWith("Not enough money");
    });

    it("2.7. Should be fail when transaction is not signed by verifier", async () => {
      sampleInput.tokenURI = "ipfs://1.json";
      sampleInput.amount = ethers.utils.parseEther("1");
      sampleInput.price = ethers.utils.parseEther("1");
      const hash = await erc721.getMessageHash(
        sampleInput.tokenId,
        sampleInput.tokenURI,
        sampleInput.paymentToken,
        sampleInput.amount,
        sampleInput.price,
        sampleInput.status
      );
      // Owner sign message
      const sig = await owner.signMessage(ethers.utils.arrayify(hash));
      await expect(
        erc721.mint(users[0].address, sampleInput, sig, {
          value: ethers.utils.parseEther("1"),
        })
      ).to.be.revertedWith("Mint: Invalid signature");
    });

    it("2.8. Should mint successfully when user pay native token", async () => {
      const price = ethers.utils.parseEther("1");
      const negativePrice = ethers.utils.parseEther("-1");

      sampleInput.tokenURI = "ipfs://1.json";
      sampleInput.amount = price;
      sampleInput.price = price;
      const oldTokenId = await erc721.lastId();

      const hash = await erc721.getMessageHash(
        sampleInput.tokenId,
        sampleInput.tokenURI,
        sampleInput.paymentToken,
        sampleInput.amount,
        sampleInput.price,
        sampleInput.status
      );

      const sig = await verifier.signMessage(ethers.utils.arrayify(hash));

      await expect(
        erc721.connect(users[0]).mint(users[0].address, sampleInput, sig, {
          value: ethers.utils.parseEther("1"),
        })
      ).to.changeEtherBalances(
        [users[0].address, erc721.address],
        [negativePrice, price]
      );

      const currentBlockTimestamp = BigNumber.from(await blockTimestamp());
      const currentTokenId = await erc721.lastId();

      expect(currentTokenId).to.be.equal(oldTokenId.add(1));
      expect(await erc721.ownerOf(currentTokenId)).to.be.equal(
        users[0].address
      );
      expect(await erc721.statusOf(currentTokenId)).to.be.equal(true);
      expect(await erc721.expirationOf(currentTokenId)).to.be.equal(
        currentBlockTimestamp.add(expiration)
      );
      expect(
        await erc721.ownerBalanceOf(sampleInput.paymentToken, users[0].address)
      ).to.be.equal(price);
    });

    it("2.9. Should mint successfully when user pay other token", async () => {
      const price = ethers.utils.parseUnits("1", 12);
      const negativePrice = ethers.utils.parseUnits("-1", 12);
      sampleInput.tokenURI = "ipfs://1.json";
      sampleInput.amount = price;
      sampleInput.price = price;
      sampleInput.paymentToken = cashTestToken.address;
      const oldTokenId = await erc721.lastId();

      const hash = await erc721.getMessageHash(
        sampleInput.tokenId,
        sampleInput.tokenURI,
        sampleInput.paymentToken,
        sampleInput.amount,
        sampleInput.price,
        sampleInput.status
      );

      const sig = await verifier.signMessage(ethers.utils.arrayify(hash));

      await expect(
        erc721.connect(users[0]).mint(users[0].address, sampleInput, sig)
      ).to.changeTokenBalances(
        cashTestToken,
        [users[0].address, erc721.address],
        [negativePrice, price]
      );

      const currentBlockTimestamp = BigNumber.from(await blockTimestamp());
      const currentTokenId = await erc721.lastId();

      expect(currentTokenId).to.be.equal(oldTokenId.add(1));
      expect(await erc721.ownerOf(currentTokenId)).to.be.equal(
        users[0].address
      );
      expect(await erc721.statusOf(currentTokenId)).to.be.equal(true);
      expect(await erc721.expirationOf(currentTokenId)).to.be.equal(
        currentBlockTimestamp.add(expiration)
      );
      expect(
        await erc721.ownerBalanceOf(sampleInput.paymentToken, users[0].address)
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
        .to.emit(erc721, "SetAdmin")
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
        .to.emit(erc721, "SetAdmin")
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

    it("6.2. Should be fail when signature is invalid", async () => {
      const tokenId = (await erc721.lastId()).add(1);
      console.log("Token ID: ", tokenId);

      const hash = await erc721.getMessageHash(
        tokenId,
        tokenURI,
        tokenStatus,
        paymentToken,
        amount
      );
      const signature = await verifier.signMessage(ethers.utils.arrayify(hash));

      await erc721.setTokenURI(users[0].address);
      await erc721.connect(users[0]).transfer(users[1].address, tokenId);
      await expect(erc721.setTokenURI(tokenId, tokenURI)).to.be.revertedWith(
        "Token is transfered"
      );
    });
  });

  describe("4. Get token URI", () => {
    it("4.1. Should be fail when token ID is invalid", async () => {
      const lastId = await erc721.lastId();
      await expect(erc721.tokenURI(lastId)).to.be.revertedWith(
        "ERC721Metadata: URI query for nonexistent token."
      );
    });

    it("4.2. Should return empty string after minting token", async () => {
      await erc721.connect(owner).mint(users[0].address);
      const lastId = await erc721.lastId();
      const tokenURI = await erc721.tokenURI(lastId);
      expect(tokenURI).to.be.equal("");
    });

    it("4.3. Should return exact token URI after setting it for a token", async () => {
      await erc721.connect(owner).mint(users[0].address);
      const lastId = await erc721.lastId();
      await erc721.connect(owner).setTokenURI(lastId, tokenURI);
      expect(await erc721.tokenURI(lastId)).to.be.equal(tokenURI);
    });
  });

  describe("5. Mint", () => {
    it("5.1. Should not mint when caller is not owner/controller", async () => {
      await expect(
        erc721.connect(users[0]).mint(users[0].address)
      ).to.be.revertedWith("Ownable: Caller is not owner/controller");
    });

    it("5.2. Should mint successfully when caller is owner", async () => {
      const tokenId = await erc721.lastTokenId();
      const balanceOfUser0 = await erc721.balanceOf(users[0].address);

      await expect(erc721.connect(owner).mint(users[0].address))
        .to.emit(erc721, "Transfer")
        .withArgs(ZERO_ADDRESS, users[0].address, tokenId.add(1));

      const currentTokenId = await erc721.lastTokenId();

      expect(await erc721.ownerOf(tokenId.add(1))).to.be.equal(
        users[0].address
      );
      expect(await erc721.balanceOf(users[0].address)).to.be.equal(
        balanceOfUser0.add(1)
      );
      expect(currentTokenId).to.be.equal(tokenId.add(1));
    });

    it("5.3. Should mint successfully when caller is controller", async () => {
      const tokenId = await erc721.lastTokenId();
      const balanceOfUser0 = await erc721.balanceOf(users[0].address);
      await expect(erc721.connect(owner).mint(users[0].address))
        .to.emit(erc721, "Transfer")
        .withArgs(ZERO_ADDRESS, users[0].address, tokenId.add(1));
      const currentTokenId = await erc721.lastTokenId();
      expect(await erc721.ownerOf(currentTokenId)).to.be.equal(
        users[0].address
      );
      expect(await erc721.balanceOf(users[0].address)).to.be.equal(
        balanceOfUser0.add(1)
      );
      expect(currentTokenId).to.be.equal(tokenId.add(1));
    });
  });

  describe("6. Transfer", () => {
    beforeEach(async () => {
      await erc721.connect(owner).mint(users[0].address);
    });

    it("6.1. Should be fail when recipient address is zero address", async () => {
      const lastId = await erc721.lastTokenId();
      await expect(
        erc721.connect(users[0]).transfer(ZERO_ADDRESS, lastId)
      ).to.be.revertedWith("Invalid address");
    });

    it("6.2. Should be fail when caller does not own token", async () => {
      const lastId = await erc721.lastTokenId();
      await expect(
        erc721.connect(users[1]).transfer(users[0].address, lastId)
      ).to.be.revertedWith("ERC721: caller is not token owner or approved");
    });

    it("6.3. Should be fail when token ID is invalid", async () => {
      const lastTokenId = await erc721.lastTokenId();
      await expect(
        erc721.connect(users[1]).transfer(users[0].address, lastTokenId.add(1))
      ).to.be.revertedWith("ERC721: invalid token ID");
    });

    it("6.4. Should transfer successfully", async () => {
      const tokenId = await erc721.lastTokenId();
      const historyId = await erc721.lastHistoryId();
      const balanceOfUser0Before = await erc721.balanceOf(users[0].address);
      const balanceOfUser1Before = await erc721.balanceOf(users[1].address);

      await expect(erc721.connect(users[0]).transfer(users[1].address, tokenId))
        .to.emit(erc721, "Transfered")
        .withArgs(
          historyId.add(1),
          users[0].address,
          users[1].address,
          tokenId
        );

      const history = await erc721.getHistoryTransfer(historyId.add(1));

      expect(history.id).to.be.equal(historyId.add(1));
      expect(history.tokenId).to.be.equal(tokenId);
      expect(history.sender).to.be.equal(users[0].address);
      expect(history.recipient).to.be.equal(users[1].address);

      expect(await erc721.transfered(tokenId)).to.be.equal(true);
      expect(await erc721.ownerOf(tokenId)).to.be.equal(users[1].address);
      expect(await erc721.balanceOf(users[0].address)).to.be.equal(
        balanceOfUser0Before.sub(1)
      );
      expect(await erc721.balanceOf(users[1].address)).to.be.equal(
        balanceOfUser1Before.add(1)
      );
    });
  });

  describe("7. Get History Transfer", () => {
    beforeEach(async () => {
      await erc721.connect(owner).mint(users[0].address);
      const tokenId = await erc721.lastTokenId();
      await erc721.connect(users[0]).transfer(users[1].address, tokenId);
    });

    it("7.1. Should be fail history ID is invalid", async () => {
      const INVALID_ID = 0;
      await expect(erc721.getHistoryTransfer(INVALID_ID)).to.be.revertedWith(
        "Invalid history ID"
      );
    });

    it("7.2 Should get successfully", async () => {
      const tokenId = await erc721.lastTokenId();
      const historyId = await erc721.lastHistoryId();
      const history = await erc721.getHistoryTransfer(historyId);

      expect(history.id).to.be.equal(historyId);
      expect(history.tokenId).to.be.equal(tokenId);
      expect(history.sender).to.be.equal(users[0].address);
      expect(history.recipient).to.be.equal(users[1].address);
    });
  });

  describe("8. Authorizable", () => {
    describe("8.1. Set Controller", () => {
      it("8.1.1. Should be fail when caller is not owner or controller", async () => {
        await expect(
          erc721.connect(users[0]).setController(users[0].address, true)
        ).to.be.revertedWith("Ownable: Caller is not owner/controller");
      });

      it("8.1.2. Should be fail when address that want to set is zero address", async () => {
        await expect(
          erc721.connect(owner).setController(ZERO_ADDRESS, true)
        ).to.be.revertedWith("Ownable: Invalid address");
      });

      it("8.1.3. Should be fail when set an address that has already been a controller", async () => {
        await erc721.connect(owner).setController(users[0].address, true);
        await expect(
          erc721.connect(owner).setController(users[0].address, true)
        ).to.be.revertedWith("Ownable: Duplicate value");
      });

      it("8.1.4. Should be fail when set an address that has not been a controller yet", async () => {
        await expect(
          erc721.connect(owner).setController(users[0].address, false)
        ).to.be.revertedWith("Ownable: Duplicate value");
      });

      it("8.1.5. Should set a controller successfully and emit SetController event", async () => {
        await expect(
          erc721.connect(owner).setController(users[0].address, true)
        )
          .to.emit(erc721, "SetController")
          .withArgs(users[0].address, true);
        expect(await erc721.isOwnerOrController(users[0].address)).to.be.equal(
          true
        );
      });

      it("8.1.6. Should remove a controller successfully and emit SetController event", async () => {
        await erc721.connect(owner).setController(users[0].address, true);
        await expect(
          erc721.connect(owner).setController(users[0].address, false)
        )
          .to.emit(erc721, "SetController")
          .withArgs(users[0].address, false);
        expect(await erc721.isOwnerOrController(users[0].address)).to.be.equal(
          false
        );
      });
    });

    describe("8.2. Is Owner Or Controller", () => {
      it("8.2.1. Should be fail when address is zero address", async () => {
        await expect(
          erc721.isOwnerOrController(ZERO_ADDRESS)
        ).to.be.revertedWith("Ownable: Invalid address");
      });

      it("8.2.2. Should return false if address is not an owner or a controller", async () => {
        expect(await erc721.isOwnerOrController(users[0].address)).to.be.equal(
          false
        );
      });

      it("8.2.3. Should return true if address is an owner", async () => {
        expect(await erc721.isOwnerOrController(owner.address)).to.be.equal(
          true
        );
      });

      it("8.2.4. Should return true if address is a controller", async () => {
        await erc721.connect(owner).setController(users[0].address, true);
        expect(await erc721.isOwnerOrController(users[0].address)).to.be.equal(
          true
        );
      });
    });

    describe("8.3. Transfer Ownership", () => {
      it("8.3.1. Should be fail when caller is not owner", async () => {
        await expect(
          erc721.connect(users[0]).transferOwnership(users[1].address)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("8.3.2. Should be fail when new owner is zero address", async () => {
        await expect(
          erc721.connect(owner).transferOwnership(ZERO_ADDRESS)
        ).to.be.revertedWith("Ownable: new owner is the zero address");
      });

      it("8.3.3. Should transfer successfully", async () => {
        await expect(erc721.connect(owner).transferOwnership(users[0].address))
          .to.emit(erc721, "OwnershipTransferred")
          .withArgs(owner.address, users[0].address);
        expect(await erc721.owner()).to.be.equal(users[0].address);
      });
    });

    describe("8.4. Renounce Ownership", () => {
      it("8.4.1. Should be fail when caller is not owner", async () => {
        await expect(
          erc721.connect(owner).renounceOwnership()
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("8.4.2. Should renounce successfully", async () => {
        await erc721.connect(owner).renounceOwnership();
        expect(await erc721.owner()).to.be.equal(ZERO_ADDRESS);
      });
    });
  });
});
