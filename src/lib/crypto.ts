import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey() {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw || Buffer.byteLength(raw, "utf-8") < 32) {
    throw new Error("加密配置错误：ENCRYPTION_KEY 未配置或长度不足 32 字节");
  }
  return Buffer.from(raw, "utf-8").subarray(0, 32);
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

function isHexBytes(value: string) {
  return value.length > 0 && value.length % 2 === 0 && /^[0-9a-f]+$/i.test(value);
}

export function isEncryptedValue(data: string): boolean {
  const parts = data.split(":");
  if (parts.length !== 3) return false;

  const [ivHex, authTagHex, encryptedHex] = parts;
  return ivHex.length === 32
    && authTagHex.length === 32
    && isHexBytes(ivHex)
    && isHexBytes(authTagHex)
    && isHexBytes(encryptedHex);
}

export function decrypt(data: string): string {
  const parts = data.split(":");
  if (parts.length !== 3) {
    throw new Error("解密失败：加密数据格式不正确，期望 iv:authTag:ciphertext 三段内容");
  }
  const [ivHex, authTagHex, encryptedHex] = parts;
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  return decipher.update(Buffer.from(encryptedHex, "hex")) + decipher.final("utf8");
}

export function decryptIfEncrypted(data: string): string {
  return isEncryptedValue(data) ? decrypt(data) : data;
}
