/**
 * Utils
 */

import isString from "./isString";

/**
 * Expo
 */

export default (obj: any): string | object =>
  isString(obj) ? obj : JSON.stringify(obj);
