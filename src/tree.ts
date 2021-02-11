import { Gindex, gindexIterator, Bit, toGindexBitstring } from "./gindex";
import { Node, BranchNode, Link, compose, identity, LeafNode } from "./node";
import { zeroNode } from "./zeroNode";

export type Hook = (v: Tree) => void;

const ERR_INVALID_TREE = "Invalid tree operation";
const ERR_PARAM_LT_ZERO = "Param must be >= 0"
const ERR_COUNT_GT_DEPTH = "Count extends beyond depth limit"

export class Tree {
  private _node: Node;
  hook?: Hook;
  constructor(node: Node, hook?: Hook) {
    this._node = node;
    this.hook = hook;
  }
  get rootNode(): Node {
    return this._node;
  }
  set rootNode(n: Node) {
    this._node = n;
    if (this.hook) {
      this.hook(this);
    }
  }
  get root(): Uint8Array {
    return this.rootNode.root;
  }
  getNode(index: Gindex): Node {
    let node = this.rootNode;
    for (const i of gindexIterator(index)) {
      if (i) {
        if (node.isLeaf()) throw new Error(ERR_INVALID_TREE);
        node = node.right;
      } else {
        if (node.isLeaf()) throw new Error(ERR_INVALID_TREE);
        node = node.left;
      }
    }
    return node;
  }
  setter(index: Gindex, expand=false): Link {
    let link = identity;
    let node = this.rootNode;
    const iterator = gindexIterator(index);
    for (const i of iterator) {
      if (i) {
        if (node.isLeaf()) {
          if (!expand) throw new Error(ERR_INVALID_TREE);
          else {
            const child = zeroNode(iterator.remainingBitLength() - 1);
            node = new BranchNode(child, child);
          }
        }
        link = compose(node.rebindRight.bind(node), link);
        node = node.right;
      } else {
        if (node.isLeaf()) {
          if (!expand) throw new Error(ERR_INVALID_TREE);
          else {
            const child = zeroNode(iterator.remainingBitLength() - 1);
            node = new BranchNode(child, child);
          }
        }
        link = compose(node.rebindLeft.bind(node), link);
        node = node.left;
      }
    }
    return compose(identity, link);
  }
  setNode(index: Gindex, n: Node, expand=false): void {
    this.rootNode = this.setter(index, expand)(n);
  }
  getRoot(index: Gindex): Uint8Array {
    return this.getNode(index).root;
  }
  setRoot(index: Gindex, root: Uint8Array, expand=false): void {
    this.setNode(index, new LeafNode(root), expand);
  }
  getSubtree(index: Gindex): Tree {
    return new Tree(
      this.getNode(index),
      (v: Tree): void => this.setNode(index, v.rootNode)
    );
  }
  setSubtree(index: Gindex, v: Tree, expand=false): void {
    this.setNode(index, v.rootNode, expand);
  }
  clone(): Tree {
    return new Tree(this.rootNode);
  }

  getSingleProof(index: Gindex): Uint8Array[] {
    const proof: Uint8Array[] = [];
    let node = this.rootNode;
    for (const i of gindexIterator(index)) {
      if (i) {
        if (node.isLeaf()) throw new Error(ERR_INVALID_TREE);
        proof.push(node.left.root);
        node = node.right;
      } else {
        if (node.isLeaf()) throw new Error(ERR_INVALID_TREE);
        proof.push(node.right.root);
        node = node.left;
      }
    }
    return proof.reverse();
  }
  /**
   * Fast read-only iteration
   * In-order traversal of nodes at `depth`
   * starting from the `startIndex`-indexed node
   * iterating through `count` nodes
   */
  *iterateNodesAtDepth(depth: number, startIndex: number, count: number): IterableIterator<Node> {
    // Strategy:
    // First nagivate to the starting Gindex node,
    // At each level record the tuple (current node, the navigation direction) in a list (Left=0, Right=1)
    // Once we reach the starting Gindex node, the list will be length == depth
    // Begin emitting nodes: Outer loop:
    //   Yield the current node
    //   Inner loop
    //     pop off the end of the list
    //     If its (N, Left) (we've nav'd the left subtree, but not the right subtree)
    //       push (N, Right) and set set node as the n.right
    //       push (N, Left) and set node as n.left until list length == depth
    //   Inner loop until the list length == depth
    // Outer loop until the list is empty or the yield count == count
    if (startIndex < 0 || count < 0 || depth < 0) {
      throw new Error(ERR_PARAM_LT_ZERO);
    }
    if ((BigInt(1) << BigInt(depth)) < startIndex + count) {
      throw new Error(ERR_COUNT_GT_DEPTH);
    }
    if (count === 0) {
      return;
    }
    if (depth === 0) {
      yield this.rootNode;
      return
    }
    let node = this.rootNode;
    let currCount = 0;
    const startGindex = toGindexBitstring(depth, BigInt(startIndex));
    const nav: [Node, Bit][] = [];
    for (const i of gindexIterator(startGindex)) {
      nav.push([node, i]);
      if (i) {
        if (node.isLeaf()) throw new Error(ERR_INVALID_TREE);
        node = node.right;
      } else {
        if (node.isLeaf()) throw new Error(ERR_INVALID_TREE);
        node = node.left;
      }
    }
    while (nav.length && currCount < count) {
      yield node;
      currCount++;
      if (currCount === count) {
        return;
      }
      do {
        const [
          parentNode,
          direction,
        ] = nav.pop()!;
        // if direction was left
        if (!direction) {
          // now navigate right
          nav.push([parentNode, 1]);
          if (parentNode.isLeaf()) throw new Error(ERR_INVALID_TREE);
          node = parentNode.right;

          // and then left as far as possible
          while (nav.length !== depth) {
            nav.push([node, 0])
            if (node.isLeaf()) throw new Error(ERR_INVALID_TREE);
            node = node.left;
          }
        }
      } while (nav.length && nav.length !== depth);
    }
  }

  /**
   * Read-only tree traversal - pre-order
   */
  *traversePreOrder(): IterableIterator<[Node, Gindex]> {
    let node = this.rootNode;
    let nodeDirection: Bit = 0;
    const nav: [Node, Bit][] = [];
    do {
      yield [
        node,
        BigInt("0b1" + nav.map((v) => v[1]).join("")),
      ];

      if (!node.isLeaf()) {
        nav.push([node, nodeDirection]);
        if (!nodeDirection) {
          node = node.left;
        } else {
          node = node.right;
          nodeDirection = 0;
        }
      } else {
        let parentNode;
        let parentDirection;
        do {
          [parentNode, parentDirection] = nav.pop()!;
        } while (parentDirection && nav.length);
        if (!parentDirection) {
          nav.push([parentNode, 1]);
          node = parentNode.right;
          nodeDirection = 0;
        }
      }
    } while(nav.length);
  }

  /**
   * Read-only tree traversal - post-order
   */
  *traversePostOrder(): IterableIterator<[Node, Gindex]> {
    let node = this.rootNode;
    let nodeDirection: Bit = 0;
    const nav: [Node, Bit][] = [];
    do {
      if (!node.isLeaf()) {
        nav.push([node, nodeDirection]);
        if (!nodeDirection) {
          node = node.left;
        } else {
          node = node.right;
          nodeDirection = 0;
        }
      } else {
        yield [
          node,
          BigInt("0b1" + nav.map((v) => v[1]).join("")),
        ];
        let parentNode;
        let parentDirection;
        do {
          [parentNode, parentDirection] = nav.pop()!;
          if (parentDirection) {
            yield [
              parentNode,
              BigInt("0b1" + nav.map((v) => v[1]).join("")),
            ];
          }
        } while (parentDirection && nav.length);
        if (!parentDirection) {
          nav.push([parentNode, 1]);
          node = parentNode.right;
          nodeDirection = 0;
        }
      }
    } while(nav.length);
  }

  /**
   * Read-only tree traversal - in-order
   */
  *traverseInOrder(): IterableIterator<[Node, Gindex]> {
    let node = this.rootNode;
    let nodeDirection: Bit = 0;
    const nav: [Node, Bit][] = [];
    do {
      if (!node.isLeaf()) {
        nav.push([node, nodeDirection]);
        if (!nodeDirection) {
          node = node.left;
        } else {
          node = node.right;
          nodeDirection = 0;
        }
      } else {
        yield [
          node,
          BigInt("0b1" + nav.map((v) => v[1]).join("")),
        ];
        let parentNode;
        let parentDirection;
        do {
          [parentNode, parentDirection] = nav.pop()!;
          if (!parentDirection) {
            yield [
              parentNode,
              BigInt("0b1" + nav.map((v) => v[1]).join("")),
            ];
          }
        } while (parentDirection && nav.length);
        if (!parentDirection) {
          nav.push([parentNode, 1]);
          node = parentNode.right;
          nodeDirection = 0;
        }
      }
    } while(nav.length);
  }

}
