import CryptoJS from 'crypto-js';

// Generate a unique key for this session/device
// In production, this should be derived from user credentials or stored securely
const getEncryptionKey = (): string => {
  // Check if we have a stored key in sessionStorage
  let key = sessionStorage.getItem('app_encryption_key');
  
  if (!key) {
    // Generate a new key for this session
    key = CryptoJS.lib.WordArray.random(256/8).toString();
    sessionStorage.setItem('app_encryption_key', key);
  }
  
  return key;
};

export const encryptData = (data: any): string => {
  try {
    const jsonString = JSON.stringify(data);
    const encrypted = CryptoJS.AES.encrypt(jsonString, getEncryptionKey()).toString();
    return encrypted;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Encryption failed:', error);
    }
    throw new Error('Failed to encrypt data');
  }
};

export const decryptData = <T>(encryptedData: string): T => {
  try {
    const decrypted = CryptoJS.AES.decrypt(encryptedData, getEncryptionKey());
    const jsonString = decrypted.toString(CryptoJS.enc.Utf8);
    
    if (!jsonString) {
      throw new Error('Failed to decrypt data');
    }
    
    return JSON.parse(jsonString);
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Decryption failed:', error);
    }
    throw new Error('Failed to decrypt data');
  }
};

// Validate data integrity
export const generateChecksum = (data: any): string => {
  const jsonString = JSON.stringify(data);
  return CryptoJS.SHA256(jsonString).toString();
};

export const validateChecksum = (data: any, checksum: string): boolean => {
  return generateChecksum(data) === checksum;
};