import {expect} from "chai";
import * as N from "../src/node";
import * as NBI from "../src/nodeBigint";

describe("Node - BigInt", () => {
  it("should hash nodes identically", () => {
    const a = Buffer.alloc(32, 0);
    a[0] = 255;
    const b = Buffer.alloc(32, 1);
    b[0] = 255;
    const c = Buffer.alloc(32, 2);
    c[0] = 255;
    const d = Buffer.alloc(32, 3);
    d[0] = 255;

    const t1 = new N.BranchNode(
      new N.BranchNode(
        new N.LeafNode(a),
        new N.LeafNode(b)
      ),
      new N.BranchNode(
        new N.LeafNode(c),
        new N.LeafNode(d)
      )
    );
    const t2 = new NBI.BranchNode(
      new NBI.BranchNode(
        new NBI.LeafNode(a),
        new NBI.LeafNode(b)
      ),
      new NBI.BranchNode(
        new NBI.LeafNode(c),
        new NBI.LeafNode(d)
      )
    );
    expect(t2.root).to.deep.equal(t1.root);
  });
});
