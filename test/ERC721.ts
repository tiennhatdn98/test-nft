import { upgrades } from "hardhat";
import hre from "hardhat";
import { expect } from "chai";
import { ZERO_ADDRESS } from "@openzeppelin/test-helpers/src/constants";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const baseURI = "ipfs://";
const tokenName = "Token";
const symbol = "TKN";
const tokenURI = "ipfs://tokenURI";
const signature =
  "0x1c8aff950685c2ed4bc3174f3472287b56d9517b9c948127319a09a7a36deac8";
const YEAR_TO_SECONDS = 31556926;

describe("ERC721", () => {
  let erc721: Contract;
  let owner: SignerWithAddress;
  let admin: SignerWithAddress;
  let verifier: SignerWithAddress;
  let users: SignerWithAddress[];

  beforeEach(async () => {
    const ERC721 = await hre.ethers.getContractFactory("ERC721");

    const [_owner, _admin, _verifier, ..._users] =
      await hre.ethers.getSigners();
    owner = _owner;
    admin = _admin;
    verifier = _verifier;
    users = _users;

    erc721 = await upgrades.deployProxy(ERC721, [
      owner.address,
      tokenName,
      symbol,
      baseURI,
      YEAR_TO_SECONDS,
    ]);
    await erc721.deployed();

    await erc721.connect(owner).setAdmin(admin.address);
    await erc721.connect(admin).setVerifier(verifier.address);
  });

  describe.only("1. Initialize", () => {
    it("1.1. Should assign state successfully", async () => {
      expect(await erc721.owner()).to.be.equal(owner.address);
      expect(await erc721.baseURI()).to.be.equal(baseURI);
      expect(await erc721.name()).to.be.equal(tokenName);
      expect(await erc721.symbol()).to.be.equal(symbol);
      expect(await erc721.lastId()).to.be.equal(0);
      expect(await erc721.expiration()).to.be.equal(YEAR_TO_SECONDS);
    });
  });

  describe("2. Set Base URI", () => {
    const newURI = "ipfs://newURI";

    it("2.1. Should be fail when caller is not owner or controller", async () => {
      await expect(
        erc721.connect(users[0]).setBaseURI(newURI)
      ).to.be.revertedWith("Ownable: Caller is not owner/controller");
    });

    it("2.2. Should be fail when set new URI is same as current base URI", async () => {
      await expect(
        erc721.connect(owner).setBaseURI(baseURI)
      ).to.be.revertedWith("Duplicate base URI");
    });

    it("2.3. Should successfully set when caller is owner", async () => {
      await expect(erc721.connect(owner).setBaseURI(newURI))
        .to.emit(erc721, "SetBaseURI")
        .withArgs(baseURI, newURI);
      expect(await erc721.baseURI()).to.equal(newURI);
    });

    it("2.4. Should successfully set when caller is controller", async () => {
      await expect(erc721.connect(controller).setBaseURI(newURI))
        .to.emit(erc721, "SetBaseURI")
        .withArgs(baseURI, newURI);
      expect(await erc721.baseURI()).to.equal(newURI);
    });
  });

  describe.only("3. Set Token URI", () => {
    it("3.1. Should be fail when caller is not owner or controller", async () => {
      const tokenId = await erc721.lastTokenId();
      await expect(
        erc721.connect(users[0]).setTokenURI(tokenId, tokenURI)
      ).to.be.revertedWith("Ownable: Caller is not owner/controller");
    });

    it("3.2. Should be fail when token ID is invalid", async () => {
      const lastId = await erc721.lastTokenId();
      await expect(
        erc721.connect(owner).setTokenURI(lastId, tokenURI)
      ).to.be.revertedWith("ERC721Metadata: URI set of nonexistent token");
    });

    it("3.3. Should be fail when token is transfered", async () => {
      await erc721.connect(owner).mint(users[0].address);
      const tokenId = await erc721.lastTokenId();
      await erc721.connect(users[0]).transfer(users[1].address, tokenId);
      await expect(erc721.setTokenURI(tokenId, tokenURI)).to.be.revertedWith(
        "Token is transfered"
      );
    });

    it("3.4. Should set successfully when caller is owner", async () => {
      await erc721.connect(owner).mint(users[0].address, signature);

      const tokenId = await erc721.lastId();
      await expect(erc721.connect(owner).setTokenURI(tokenId, tokenURI))
        .to.emit(erc721, "SetTokenURI")
        .withArgs(tokenId, "", tokenURI);
      expect(await erc721.tokenURI(tokenId)).to.be.equal(tokenURI);
    });

    it("3.5. Should set successfully when caller is controller", async () => {
      await erc721.connect(owner).mint(users[0].address);
      const tokenId = await erc721.lastTokenId();
      await expect(erc721.connect(owner).setTokenURI(tokenId, tokenURI))
        .to.emit(erc721, "SetTokenURI")
        .withArgs(tokenId, "", tokenURI);
      expect(await erc721.tokenURI(tokenId)).to.be.equal(tokenURI);
    });
  });

  describe("4. Get token URI", () => {
    it("4.1. Should be fail when token ID is invalid", async () => {
      const lastId = await erc721.lastTokenId();
      await expect(erc721.tokenURI(lastId)).to.be.revertedWith(
        "ERC721Metadata: URI query for nonexistent token."
      );
    });

    it("4.2. Should return empty string after minting token", async () => {
      await erc721.connect(owner).mint(users[0].address);
      const lastId = await erc721.lastTokenId();
      const tokenURI = await erc721.tokenURI(lastId);
      expect(tokenURI).to.be.equal("");
    });

    it("4.3. Should return exact token URI after setting it for a token", async () => {
      await erc721.connect(owner).mint(users[0].address);
      const lastId = await erc721.lastTokenId();
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
      await expect(erc721.connect(controller).mint(users[0].address))
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
          erc721.connect(controller).renounceOwnership()
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("8.4.2. Should renounce successfully", async () => {
        await erc721.connect(owner).renounceOwnership();
        expect(await erc721.owner()).to.be.equal(ZERO_ADDRESS);
      });
    });
  });
});
