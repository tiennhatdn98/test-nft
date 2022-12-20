import { upgrades } from "hardhat";
import { ethers } from "hardhat";
import hre from "hardhat";
import { expect } from "chai";
import { ZERO_ADDRESS } from "@openzeppelin/test-helpers/src/constants";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const baseUri = "ipfs://";

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
      "Token",
      "TKN",
      baseUri,
    ]);
    await erc721.deployed();
  });

  describe("1. Setter", () => {
    describe("1.1. Owner", () => {
      it("1.1.1. Should successfully set and retrieve baseURI", async () => {
        const newURI = "ipfs://testuri";
        await erc721.setBaseURI(newURI);
        await expect(await erc721.baseURI()).to.equal(newURI);
      });
    });

    describe("1.2. Non-owner", async () => {
      it("1.2.1. Should not be able to set new base URI", async () => {
        await expect(
          erc721.connect(users[0]).setBaseURI("ipfs://123")
        ).to.be.revertedWith("Ownable: Caller is not owner/controller");
      });
    });

    describe("1.3. Emits", async () => {
      it("1.3.1. SetBaseURI event", async () => {
        const oldBaseURI = await erc721.baseURI();
        const newBaseURI = "ipfs://456";
        await expect(erc721.setBaseURI(newBaseURI))
          .to.emit(erc721, "SetBaseURI")
          .withArgs(oldBaseURI, newBaseURI);
      });

      it("1.3.2. Minted event", async () => {
        const lastId = await erc721.lastId();
        await expect(erc721.mint(users[0].address))
          .to.emit(erc721, "Minted")
          .withArgs(users[0].address, lastId.add(1));
      });

      it("1.3.3. Transfered event", async () => {
        await erc721.mint(users[0].address);
        const lastId = await erc721.lastId();
        await expect(
          erc721
            .connect(users[0])
            .transfer(users[0].address, users[1].address, lastId)
        )
          .to.emit(erc721, "Transfered")
          .withArgs(users[0].address, users[1].address, lastId);
      });
    });
  });

  describe("2. Mint", async () => {
    it("2.1. Should not mint when caller is not owner/controller", async () => {
      await expect(
        erc721.connect(users[0]).mint(users[0].address)
      ).to.be.revertedWith("Ownable: Caller is not owner/controller");
    });

    describe("2.2. Upon successfully mint to users[0]", async () => {
      it("2.2.1. Should emit Minted event", async () => {
        const lastId = await erc721.lastId();
        await expect(await erc721.connect(owner).mint(users[0].address))
          .to.emit(erc721, "Minted")
          .withArgs(users[0].address, lastId.add(1));
      });

      it("2.2.2. Should be owned by users[0]", async () => {
        await erc721.connect(owner).mint(users[0].address);
        const lastId = await erc721.lastId();

        await expect(await erc721.ownerOf(lastId)).to.be.equal(
          users[0].address
        );
      });
    });
  });

  describe.only("3. Transfer", async () => {
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

    describe("3.2. Should transfer successfully when ", async () => {
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
});
