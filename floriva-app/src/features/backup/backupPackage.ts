import { Buffer } from 'buffer';

import * as Crypto from 'expo-crypto';
import { gcm } from '@noble/ciphers/aes.js';
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';

import { backupEnvelopeSchema, backupSnapshotSchema } from '@/src/db/validators';
import type { BackupEnvelope, BackupSnapshot } from '@/src/types/domain';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const backupFormatVersion = 1 as const;
const backupKeyLengthBytes = 32;
const backupSaltLengthBytes = 16;
const backupNonceLengthBytes = 12;
const backupKeyCheckLengthBytes = 32;
const backupPbkdf2Iterations = 210000;

// Iteration-count bounds enforced at *decrypt* time so an attacker-controlled
// header cannot be used to weaken KDF cost (low bound) or cause a DoS (high
// bound).  The lower bound must be at least 1 (schema requires positive()) but
// we enforce a meaningful minimum here.  The upper bound is generous enough to
// accommodate future legitimate increases while preventing runaway computation.
const backupPbkdf2MinIterations = 100_000;
const backupPbkdf2MaxIterations = 10_000_000;

export type BackupPackageErrorCode =
  | 'invalid_backup_file'
  | 'unsupported_backup_format'
  | 'wrong_passphrase';

export class BackupPackageError extends Error {
  readonly code: BackupPackageErrorCode;

  constructor(code: BackupPackageErrorCode) {
    super(code);
    this.name = 'BackupPackageError';
    this.code = code;
  }
}

function bytesToBase64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString('base64');
}

function base64ToBytes(base64: string) {
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

function bytesEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) {
    return false;
  }

  let result = 0;

  for (let index = 0; index < left.length; index += 1) {
    result |= left[index] ^ right[index];
  }

  return result === 0;
}

// A passphrase whose UTF-8 encoding is empty or consists solely of NUL bytes
// derives the SAME key as an empty passphrase: HMAC (inside PBKDF2) zero-pads
// the key block, so an all-zero key is indistinguishable from a zero-length
// key. Treating such passphrases as usable would let an empty passphrase
// decrypt a backup that was (e.g. via miscoded input) sealed with NUL bytes.
// Reject the whole collision class at the trust boundary.
function isUsablePassphrase(passphrase: string) {
  const bytes = textEncoder.encode(passphrase);
  return bytes.some((byte) => byte !== 0);
}

function buildKeyCheckBytes(derivedKey: Uint8Array) {
  return sha256(
    new Uint8Array([
      ...derivedKey,
      ...textEncoder.encode('floriva-backup-key-check'),
    ]),
  ).slice(0, backupKeyCheckLengthBytes);
}

function parseBackupEnvelope(payload: unknown) {
  const parseResult = backupEnvelopeSchema.safeParse(payload);

  if (!parseResult.success) {
    throw new BackupPackageError('invalid_backup_file');
  }

  return parseResult.data;
}

function parseBackupSnapshot(payload: unknown) {
  const parseResult = backupSnapshotSchema.safeParse(payload);

  if (!parseResult.success) {
    throw new BackupPackageError('invalid_backup_file');
  }

  return parseResult.data;
}

async function deriveEncryptionKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
) {
  return pbkdf2Async(sha256, textEncoder.encode(passphrase), salt, {
    c: iterations,
    dkLen: backupKeyLengthBytes,
  });
}

export async function createBackupPackage({
  snapshot,
  passphrase,
}: {
  snapshot: BackupSnapshot;
  passphrase: string;
}) {
  const parsedSnapshot = parseBackupSnapshot(snapshot);
  const salt = Crypto.getRandomBytes(backupSaltLengthBytes);
  const nonce = Crypto.getRandomBytes(backupNonceLengthBytes);
  const derivedKey = await deriveEncryptionKey(passphrase, salt, backupPbkdf2Iterations);
  const plaintextBytes = textEncoder.encode(JSON.stringify(parsedSnapshot));
  const ciphertextBytes = gcm(derivedKey, nonce).encrypt(plaintextBytes);

  const envelope: BackupEnvelope = {
    formatVersion: backupFormatVersion,
    createdAt: new Date().toISOString(),
    kdf: {
      algorithm: 'pbkdf2-sha256',
      iterations: backupPbkdf2Iterations,
      saltBase64: bytesToBase64(salt),
    },
    encryption: {
      algorithm: 'aes-256-gcm',
      nonceBase64: bytesToBase64(nonce),
      ciphertextBase64: bytesToBase64(ciphertextBytes),
      keyCheckBase64: bytesToBase64(buildKeyCheckBytes(derivedKey)),
    },
  };

  return JSON.stringify(envelope);
}

export async function decryptBackupPackage({
  serializedPackage,
  passphrase,
}: {
  serializedPackage: string;
  passphrase: string;
}) {
  let parsedPayload: unknown;

  try {
    parsedPayload = JSON.parse(serializedPackage) as unknown;
  } catch {
    throw new BackupPackageError('invalid_backup_file');
  }

  const formatVersion =
    typeof parsedPayload === 'object' && parsedPayload !== null && 'formatVersion' in parsedPayload
      ? (parsedPayload as { formatVersion?: unknown }).formatVersion
      : undefined;

  if (formatVersion === undefined) {
    throw new BackupPackageError('invalid_backup_file');
  }

  if (formatVersion !== backupFormatVersion) {
    throw new BackupPackageError('unsupported_backup_format');
  }

  const envelope = parseBackupEnvelope(parsedPayload);

  // Reject iteration counts outside the trusted range BEFORE running the KDF.
  // Too low → attacker weakens brute-force resistance; too high → DoS.
  if (
    envelope.kdf.iterations < backupPbkdf2MinIterations ||
    envelope.kdf.iterations > backupPbkdf2MaxIterations
  ) {
    throw new BackupPackageError('invalid_backup_file');
  }

  if (!isUsablePassphrase(passphrase)) {
    throw new BackupPackageError('wrong_passphrase');
  }

  const salt = base64ToBytes(envelope.kdf.saltBase64);
  const nonce = base64ToBytes(envelope.encryption.nonceBase64);
  const derivedKey = await deriveEncryptionKey(
    passphrase,
    salt,
    envelope.kdf.iterations,
  );
  const expectedKeyCheck = base64ToBytes(envelope.encryption.keyCheckBase64);

  if (!bytesEqual(buildKeyCheckBytes(derivedKey), expectedKeyCheck)) {
    throw new BackupPackageError('wrong_passphrase');
  }

  try {
    const plaintextBytes = gcm(derivedKey, nonce).decrypt(
      base64ToBytes(envelope.encryption.ciphertextBase64),
    );

    return parseBackupSnapshot(JSON.parse(textDecoder.decode(plaintextBytes)) as unknown);
  } catch {
    throw new BackupPackageError('invalid_backup_file');
  }
}
