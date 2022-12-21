import { upgrades } from "hardhat";
import { ethers } from "hardhat";
import hre from "hardhat";
import { expect } from "chai";
import { ZERO_ADDRESS } from "@openzeppelin/test-helpers/src/constants";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const baseUri = "ipfs://";
const tokenName = "Token";
const symbol = "TKN";

describe("ERC721", () => {
  let erc721: Contract;
  let owner: SignerWithAddress;
  let users: SignerWithAddress[];

  beforeEach(async () => {
    const ERC721 = await hre.ethers.getContractFactory("ERC721");

    const [_owner, ..._users] = await hre.ethers.getSigners();
    owner = _owner;
    users = _users;

    erc721 = await upgrades.deployProxy(ERC721, [
      owner.address,
      tokenName,
      symbol,
      baseUri,
    ]);
    await erc721.deployed();
  });

  describe("1. Initialize", () => {
    it("1.1. Should assign state successfully", async () => {
      expect(await erc721.owner()).to.be.equal(owner.address);
      expect(await erc721.baseURI()).to.be.equal(baseUri);
      expect(await erc721.lastId()).to.be.equal(0);
    });
  });
  describe("2. Set Base URI", () => {
    const newURI = "ipfs://testuri";

    it("2.1. Should be fail when caller is not owner or controller", async () => {
      await expect(
        erc721.connect(users[0]).setBaseURI(newURI)
      ).to.be.revertedWith("Ownable: Caller is not owner/controller");
    });

    it("2.2. Should successfully set and retrieve baseURI", async () => {
      await expect(erc721.setBaseURI(newURI))
        .to.emit(erc721, "SetBaseURI")
        .withArgs(baseUri, newURI);
      expect(await erc721.baseURI()).to.equal(newURI);
    });
  });

  describe.only("3. Get token URI", async () => {
    it("Should be fail when token ID is invalid", async () => {
      const lastId = await erc721.lastId();
      await expect(erc721.tokenURI(lastId)).to.be.revertedWith(
        "ERC721Metadata: URI query for nonexistent token."
      );
    });

    it("Should get token URI successfully when token ID is valid", async () => {
      await erc721.connect(owner).mint(users[0].address);
      const lastId = await erc721.lastId();
      const tokenURI = await erc721.tokenURI(lastId);
      console.log("Token URI: ", tokenURI);
    });
  });

  describe("2. Mint", async () => {
    it("2.1. Should not mint when caller is not owner/controller", async () => {
      await expect(
        erc721.connect(users[0]).mint(users[0].address)
      ).to.be.revertedWith("Ownable: Caller is not owner/controller");
    });

    it("2.2. Should mint successfully", async () => {
      const lastId = await erc721.lastId();

      await expect(erc721.connect(owner).mint(users[0].address))
        .to.emit(erc721, "Minted")
        .withArgs(users[0].address, lastId.add(1));
      expect(await erc721.ownerOf(lastId.add(1))).to.be.equal(users[0].address);
    });
  });

  describe("3. Transfer", async () => {
    beforeEach(async () => {
      await erc721.connect(owner).mint(users[0].address);
    });
    describe("3.1. Should be fail", async () => {
      it("3.1.1. One of addresses is zero address", async () => {
        const lastId = await erc721.lastId();
        await expect(
          erc721
            .connect(users[0])
            .transfer(ZERO_ADDRESS, users[1].address, lastId)
        ).to.be.revertedWith("Invalid address");
      });

      it("3.1.2. When caller is not own token", async () => {
        const lastId = await erc721.lastId();
        await expect(
          erc721
            .connect(users[1])
            .transfer(users[1].address, users[0].address, lastId)
        ).to.be.revertedWith("ERC721: caller is not token owner or approved");
      });

      it("3.1.3. When token ID is invalid", async () => {
        const lastId = await erc721.lastId();
        await expect(
          erc721
            .connect(users[1])
            .transfer(users[1].address, users[0].address, lastId.add(1))
        ).to.be.revertedWith("ERC721: invalid token ID");
      });
    });

    describe("3.2. Upon transfer successfully ", async () => {
      it("3.2.1. Should emit Transfered event", async () => {
        const lastId = await erc721.lastId();
        await expect(
          erc721
            .connect(users[0])
            .transfer(users[0].address, users[1].address, lastId)
        )
          .to.emit(erc721, "Transfered")
          .withArgs(users[0].address, users[1].address, lastId);
      });

      it("3.2.2. Should store history transfer", async () => {
        const lastId = await erc721.lastId();
        await erc721
          .connect(users[0])
          .transfer(users[0].address, users[1].address, lastId);
        expect(
          await erc721.getHistoryTransfer(users[0].address, users[1].address)
        ).to.be.equal(lastId);
      });
    });
  });

  describe("4. Authorizable", async () => {
    describe("4.1. Set Controller", async () => {
      it("4.1.1. Should be fail when caller is not owner or controller", async () => {
        await expect(
          erc721.connect(users[0]).setController(users[0].address, true)
        ).to.be.revertedWith("Ownable: Caller is not owner/controller");
      });

      it("4.1.2. Should be fail when address that want to set is zero address", async () => {
        await expect(
          erc721.connect(owner).setController(ZERO_ADDRESS, true)
        ).to.be.revertedWith("Ownable: Invalid address");
      });

      it("4.1.3. Should be fail when set an address that has already been a controller", async () => {
        await erc721.connect(owner).setController(users[0].address, true);
        await expect(
          erc721.connect(owner).setController(users[0].address, true)
        ).to.be.revertedWith("Duplicate value");
      });

      it("4.1.4. Should be fail when set an address that has not already been a controller", async () => {
        await expect(
          erc721.connect(owner).setController(users[0].address, false)
        ).to.be.revertedWith("Duplicate value");
      });

      it("4.1.5. Should set a controller successfully and emit SetController event", async () => {
        await expect(
          erc721.connect(owner).setController(users[0].address, true)
        )
          .to.emit(erc721, "SetController")
          .withArgs(users[0].address, true);
        expect(await erc721.isOwnerOrController(users[0].address)).to.be.equal(
          true
        );
      });

      it("4.1.6. Should remove a controller successfully and emit SetController event", async () => {
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
  });
});
