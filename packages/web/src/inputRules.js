import { cryptoHelpers } from "./crypto";
export const acceptsEth = (value) =>
  value.length <= 79 && /^\d*(?:\.\d{0,18})?$/.test(value);
export const acceptsAddress = (value) =>
  /^(?:0|0[xX][0-9a-fA-F]{0,40})?$/.test(value);
export const acceptsField = (value) =>
  /^(?:[0-9]{0,78}|0[xX][0-9a-fA-F]{0,64})$/.test(value);
export const validField = (value) => {
  try {
    cryptoHelpers.normalizeField(value);
    return true;
  } catch {
    return false;
  }
};
