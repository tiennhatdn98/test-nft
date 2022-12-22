import { upgrades } from "hardhat";
import { ethers } from "hardhat";
import hre from "hardhat";
import { expect } from "chai";
import { ZERO_ADDRESS } from "@openzeppelin/test-helpers/src/constants";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const baseURI = "ipfs://";
const tokenName = "Token";
const symbol = "TKN";
const tokenURI = "ipfs://tokenURI";

describe("ERC721 Integration", () => {
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
      baseURI,
    ]);
    await erc721.deployed();
  });

  describe("1. Mint token => Transfer token => Store history", () => {
    it("1.1. Should be successfull", async () => {
      await erc721.connect(owner).mint(users[0].address);
      const tokenId = await erc721.lastId();
      await erc721.connect(owner).setTokenURI(tokenId, tokenURI);
      await erc721
        .connect(users[0])
        .transfer(users[0].address, users[1].address, tokenId);
      expect(await erc721.ownerOf(tokenId)).to.be.equal(users[1].address);
      expect(await erc721.tokenURI(tokenId)).to.be.equal(tokenURI);
      expect(await erc721.balanceOf(users[0].address)).to.be.equal(0);
      expect(await erc721.balanceOf(users[1].address)).to.be.equal(1);
      expect(
        await erc721.getHistoryTransfer(users[0].address, users[1].address)
      ).to.be.equal(tokenId);
    });
  });
});
