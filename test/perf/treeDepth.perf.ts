import {itBench, setBenchOpts} from "@dapplion/benchmark";
import {Tree, subtreeFillToDepth, iterateAtDepth, LeafNode} from "../../src";

describe("Tree", () => {
  setBenchOpts({
    maxMs: 60 * 1000,
    minMs: 1 * 1000,
    runs: 1024,
  });

  for (const depth of [8, 16, 32]) {
    const n = subtreeFillToDepth(new LeafNode(Buffer.alloc(32, 1)), depth);
    const n2 = new LeafNode(Buffer.alloc(32, 2));
    const backing = new Tree(n);
    const gindex = Array.from(iterateAtDepth(depth, BigInt(0), BigInt(1)))[0];

    itBench(`set at depth ${depth}`, () => {
      backing.setNode(gindex, n2);
    });
  }

  for (const depth of [8, 16, 32, 40]) {
    const n = subtreeFillToDepth(new LeafNode(Buffer.alloc(32, 1)), depth);
    const backing = new Tree(n);
    const startIndex = 0;
    const count = Math.min(250_000, 2 ** depth);

    itBench(`iterateNodesAtDepth ${depth} ${count}`, () => {
      Array.from(backing.iterateNodesAtDepth(depth, startIndex, count));
    });

    itBench(`getNodesAtDepth ${depth} ${count}`, () => {
      backing.getNodesAtDepth(depth, startIndex, count);
    });
  }

  for (const changesCount of [8, 32, 256]) {
    const depth = 40;
    const tree = new Tree(zeroNode(depth));
    const startGindex = 2 ** depth;
    const maxIndex = 200_000;

    const gindexesContiguous: bigint[] = [];
    const gindexesSpread: bigint[] = [];

    for (let i = 0; i < changesCount; i++) {
      gindexesContiguous.push(BigInt(startGindex + i));
    }

    for (let i = 0; i < maxIndex; i += Math.floor(maxIndex / changesCount)) {
      gindexesSpread.push(BigInt(startGindex + i));
    }

    function getNodes(): LeafNode[] {
      const nodes: LeafNode[] = [];
      for (let i = 0; i < changesCount; i++) {
        nodes.push(new LeafNode(Buffer.alloc(32, i)));
      }
      return nodes;
    }

    for (const [key, gindexes] of Object.entries({contiguous: gindexesContiguous, spread: gindexesSpread})) {
      itBench({id: `depth ${depth} count ${changesCount} ${key} - setNode`, beforeEach: getNodes}, (nodes) => {
        for (let i = 0; i < changesCount; i++) {
          tree.setNode(gindexes[i], nodes[i]);
        }
      });

      itBench({id: `depth ${depth} count ${changesCount} ${key} - setNodes`, beforeEach: getNodes}, (nodes) => {
        tree.setNodes(gindexes, nodes);
      });
    }
  }
});
