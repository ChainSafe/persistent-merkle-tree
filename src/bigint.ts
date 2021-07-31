import {toBufferBE, toBigIntBE} from "bigint-buffer";
import {getHasher, HashType} from "bigint-hash";

export function bigIntToUint8Array(a: bigint): Uint8Array {
  return new Uint8Array(toBufferBE(a, 32));
}

export function uint8ArrayToBigInt(a: Uint8Array): bigint {
  return toBigIntBE(Buffer.from(a));
}

export function hashBigInt(a: bigint, b: bigint): bigint {
  const input = Buffer.allocUnsafe(64);
  input.set(bigIntToUint8Array(a), 0);
  input.set(bigIntToUint8Array(b), 32);
  return getHasher(HashType.SHA256).update(input).digestBigInt();
}
