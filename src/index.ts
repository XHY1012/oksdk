/**
 * Config
 */

import {
  OK_MOB_URL,
  OK_API_SERVER,
  OK_CONNECT_URL,
  OK_ANDROID_APP_UA
} from "./config/servers";

declare const OKSDK: any;

/**
 * Utils
 */

import { isFunc, isString, toString } from "./utils/index";

/**
 * Libs
 */

import { md5 } from "./lib/Util/index";

/**
 * Helpers
 */

/** stub func */
const nop = (str?: string) => {};

/**
 * Expo
 */

const state = {
  app_id: 0,
  app_key: "",
  sessionKey: "",
  accessToken: "",
  sessionSecretKey: "",
  apiServer: "",
  widgetServer: "",
  mobServer: "",
  baseUrl: "",
  container: false,
  header_widget: ""
};

let ads_state: any = {
  init: false,
  ready: false
};

const ads_widget_style: any = {
  border: 0,
  position: "fixed",
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  width: "100%",
  height: "100%",
  zIndex: 1000,
  display: "none"
};

let sdk_success = nop;
let sdk_failure = nop;

// ---------------------------------------------------------------------------------------------------
// General
// ---------------------------------------------------------------------------------------------------

/**
 * initializes the SDK<br/>
 * If launch parameters are not detected, switches to OAUTH (via redirect)
 *
 * @param args
 * @param {Number} args.app_id application id
 * @param {String} args.app_key application key
 * @param [args.oauth] - OAUTH configuration
 * @param {String} [args.oauth.scope='VALUABLE_ACCESS'] scope
 * @param {String} [args.oauth.url=location.href] return url
 * @param {String} [args.oauth.state=''] state for security checking
 * @param {String} [args.oauth.layout='a'] authorization layout (w - web, m - mobile)
 * @param {Function} success success callback
 * @param {Function} failure failure callback
 */
export const init = (args: any, success: () => void, failure: () => void) => {
  args.oauth = args.oauth || {};
  sdk_success = isFunc(success) ? success : nop;
  sdk_failure = isFunc(failure) ? failure : nop;

  const params = getRequestParameters(
    args.location_search || window.location.search
  );
  const hParams = getRequestParameters(
    args.location_hash || window.location.hash
  );

  state.app_id = args.app_id;
  state.app_key = params.application_key || args.app_key;
  state.sessionKey = params.session_key;
  state.accessToken = hParams.access_token;
  state.sessionSecretKey =
    params.session_secret_key || hParams.session_secret_key;
  state.apiServer = args.api_server || params.api_server || OK_API_SERVER;
  state.widgetServer = encodeURI(
    getRemoteUrl([args.widget_server, params.widget_server], OK_CONNECT_URL)
  );
  state.mobServer = encodeURI(
    getRemoteUrl([args.mob_server, params.mob_server], OK_MOB_URL)
  );
  state.baseUrl = state.apiServer + "fb.do";
  state.header_widget = params.header_widget;
  state.container = params.container;

  if (!state.app_id || !state.app_key) {
    sdk_failure("Required arguments app_id/app_key not passed");
    return;
  }

  if (!params.api_server) {
    if (hParams.access_token == null && hParams.error == null) {
      (window as any).location =
        state.widgetServer +
        "oauth/authorize" +
        "?client_id=" +
        args.app_id +
        "&scope=" +
        (args.oauth.scope || "VALUABLE_ACCESS") +
        "&response_type=" +
        "token" +
        "&redirect_uri=" +
        (args.oauth.url || window.location.href) +
        "&layout=" +
        (args.oauth.layout || "a") +
        "&state=" +
        (args.oauth.state || "");
      return;
    }
    if (hParams.error != null) {
      sdk_failure("Error with OAUTH authorization: " + hParams.error);
      return;
    }
  }
  sdk_success();
};

/**
 * @param {Array} sources
 * @param {String} fallback
 */
function getRemoteUrl(sources: any, fallback: string) {
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    if (
      source &&
      (source.startsWith("http://") || source.startsWith("https://"))
    ) {
      return source;
    }
  }
  return fallback;
}

// ---------------------------------------------------------------------------------------------------
// REST
// ---------------------------------------------------------------------------------------------------

const REST_NO_SIGN_ARGS: ReadonlyArray<any> = ["sig", "access_token"];

const executeRemoteRequest = (query: string, usePost: boolean, callback: (status: string, data: object | null, error: object | null) => void) => {
  const xhr = new XMLHttpRequest();
  if (usePost) {
    xhr.open("POST", state.baseUrl, true);
    xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
  } else {
    xhr.open("GET", state.baseUrl + "?" + query, true);
    xhr.setRequestHeader("Content-type", "application/json");
  }
  xhr.onreadystatechange = function() {
    if (xhr.readyState === XMLHttpRequest.DONE) {
      if (!isFunc(callback)) return;
      let responseJson;

      try {
        responseJson = JSON.parse(xhr.responseText);
      } catch (e) {
        responseJson = { result: xhr.responseText };
      }

      if (xhr.status != 200 || responseJson.hasOwnProperty("error_msg")) {
        callback("error", null, responseJson);
      } else {
        callback("ok", responseJson, null);
      }
    }
  };
  xhr.send(usePost ? query : null);
}

/**
 * Calls a REST request
 *
 * @param {String} method
 * @param {Object} [params]
 * @param {restCallback} [callback]
 * @param {Object} [callOpts]
 * @param {boolean} [callOpts.no_session] true if REST method prohibits session
 * @param {boolean} [callOpts.no_sig] true if no signature is required for the method
 * @param {string} [callOpts.app_secret_key] required for non-session requests
 * @param {string} [callOpts.use_post] send request via POST
 */
function restCall(method: string, params: any, callback: () => void, callOpts: any) {
  params = params || {};
  params.method = method;
  params = restFillParams(params);
  if (callOpts && callOpts.no_session) {
    delete params.session_key;
    delete params.access_token;
  }

  let key;
  for (key in params) {
    if (params.hasOwnProperty(key)) {
      const param = params[key];
      if (typeof param === "object") {
        params[key] = JSON.stringify(param);
      }
    }
  }

  if (!callOpts || !callOpts.no_sig) {
    const secret =
      callOpts && callOpts.app_secret_key
        ? callOpts.app_secret_key
        : state.sessionSecretKey;
    params.sig = calcSignature(params, secret);
  }

  let query = "";
  for (key in params) {
    if (params.hasOwnProperty(key)) {
      if (query.length !== 0) query += "&";
      query += key + "=" + encodeURIComponent(params[key]);
    }
  }

  return executeRemoteRequest(query, callOpts && callOpts.use_post, callback);
}

/**
 * Calculates request signature basing on the specified call arguments
 *
 * @param {Object} query
 * @param {string} [secretKey] alternative secret_key (fe: app secret key for non-session requests)
 * @returns {string}
 */
function calcSignatureExternal(query: string, secretKey: string) {
  return calcSignature(restFillParams(query), secretKey);
}

function calcSignature(query: object | any, secretKey: string) {
  let i,
    keys: Array<any> = [];
  for (i in query) {
    keys.push(i.toString());
  }
  keys.sort();
  let sign = "";
  for (i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (REST_NO_SIGN_ARGS.indexOf(key) == -1) {
      sign += keys[i] + "=" + query[keys[i]];
    }
  }
  sign += secretKey || state.sessionSecretKey;
  sign = encodeUtf8(sign);
  return md5(sign);
}

function restFillParams(params: object | any) {
  params = params || {};
  params.application_key = state.app_key;
  if (state.sessionKey) {
    params.session_key = state.sessionKey;
  } else {
    params.access_token = state.accessToken;
  }
  params.format = "JSON";
  return params;
}

// ---------------------------------------------------------------------------------------------------
// Payment
// ---------------------------------------------------------------------------------------------------

/**
 * Opens a payment window for a selected product
 *
 * @param {String} productName      product's name to be displayed in a payment window
 * @param {Number} productPrice     product's price to be displayed in a payment window
 * @param {String} productCode      product's code used for validation in a server callback and displayed in transaction info
 * @param {Object} options          additional payment parameters
 */
function paymentShow(productName: string, productPrice: number, productCode: number, options: object) {
  return window.open(
    getPaymentQuery(productName, productPrice, productCode, options)
  );
}

/**
 * Opens a payment window for a selected product in an embedded iframe
 * Opens a payment window for a selected product as an embedded iframe
 * You can either create frame container element by yourself or leave element creation for this method
 *
 * @param {String} productName      product's name to be displayed in a payment window
 * @param {Number} productPrice     product's price to be displayed in a payment window
 * @param {String} productCode      product's code used for validation in a server callback and displayed in transaction info
 * @param {Object} options          additional payment parameters
 * @param {String} frameId          id of a frame container element
 */
function paymentShowInFrame(
  productName: string,
  productPrice: number,
  productCode: number,
  options: object,
  frameId: string
) {
  const frameElement =
    "<iframe 'style='position: absolute; left: 0px; top: 0px; background-color: white; z-index: 9999;' src='" +
    getPaymentQuery(productName, productPrice, productCode, options) +
    "'; width='100%' height='100%' frameborder='0'></iframe>";

  let frameContainer = window.document.getElementById(frameId);
  if (!frameContainer) {
    frameContainer = window.document.createElement("div");
    frameContainer.id = frameId;
    document.body.appendChild(frameContainer);
  }

  frameContainer.innerHTML = frameElement;
  frameContainer.style.display = "block";
  frameContainer.style.position = "fixed";
  frameContainer.style.left = "0px";
  frameContainer.style.top = "0px";
  frameContainer.style.width = "100%";
  frameContainer.style.height = "100%";
}

/**
 * Closes a payment window and hides it's container on game's page
 *
 * @param {String} frameId  id of a frame container element
 */
function closePaymentFrame(frameId: string) {
  if (window.parent) {
    let frameContainer;
    try {
      frameContainer =
        window.document.getElementById(frameId) ||
        window.parent.document.getElementById(frameId);
    } catch (e) {
      console.log(e);
    }

    if (frameContainer) {
      frameContainer.innerHTML = "";
      frameContainer.style.display = "none";
      frameContainer.style.position = "";
      frameContainer.style.left = "";
      frameContainer.style.top = "";
      frameContainer.style.width = "";
      frameContainer.style.height = "";
    }
  }
}

/**
 * Genrates an OK payment service URL for a selected product
 */
function getPaymentQuery(productName: string, productPrice: number, productCode: number, options: object | any) {
  const params: any = {};
  params.name = productName;
  params.price = productPrice;
  params.code = productCode;

  options = options || {};
  const host = options.mob_pay_url || state.mobServer;

  params.application_key = state.app_key;
  if (state.sessionKey) {
    params.session_key = state.sessionKey;
  } else {
    params.access_token = state.accessToken;
  }
  params.sig = calcSignature(params, state.sessionSecretKey);

  let query = host + "api/show_payment?";
  for (const key in params) {
    if (params.hasOwnProperty(key)) {
      query += key + "=" + encodeURIComponent(params[key]) + "&";
    }
  }

  return query;
}

// ---------------------------------------------------------------------------------------------------
// Ads
// ---------------------------------------------------------------------------------------------------

/**
 * Injects an OK Ads Widget to a game's page
 *
 * @param {string}      [frameId]   optional frame element id. If not present "ok-ads-frame" id will be used
 * @param {function}    [callbackFunction] callbackFunction used for all ad methods. Takes a single object input parameter
 */
function injectAdsWidget(frameId: string, callbackFunction: () => void) {
  if (ads_state.frame_element) {
    return;
  }
  const frame = document.createElement("iframe") as any;
  const framesCount = window.frames.length;
  frame.id = frameId || "ok-ads-frame";

  frame.src = getAdsWidgetSrc();
  for (let prop in ads_widget_style) {
    (frame as any).style[prop] = ads_widget_style[prop];
  }
  frame.style.display = "none";
  document.body.appendChild(frame);
  ads_state.frame_element = frame;
  ads_state.window_frame = (window as any).frames[framesCount];

  const callback = callbackFunction || defaultAdCallback;
  window.addEventListener("message", callback);
}

/**
 * Requests an ad to be shown for a user from ad providers
 */
function prepareMidroll() {
  if (!ads_state.window_frame) {
    console.log("Ads are not initialized. Please initialize them first");
    return;
  }
  ads_state.window_frame.postMessage(
    JSON.stringify({ method: "prepare", arguments: ["midroll"] }),
    "*"
  );
}

/**
 * Shows previously prepared ad to a user
 */
function showMidroll() {
  if (!ads_state.window_frame) {
    console.log("Ads are not initialized. Please initialize them first");
    return;
  }
  if (!ads_state.ready) {
    console.log("Ad is not ready. Please make sure ad is ready to be shown");
  }
  ads_state.frame_element.style.display = "";
  setTimeout(function() {
    ads_state.window_frame.postMessage(JSON.stringify({ method: "show" }), "*");
  }, 10);
}

/**
 * Removed an Ok Ads Widget from page source and completely resets ads status
 */
function removeAdsWidget() {
  if (ads_state.frame_element) {
    ads_state.frame_element.parentNode.removeChild(ads_state.frame_element);
    OKSDK.Ads.State.init = ads_state.init = false;
    OKSDK.Ads.State.ready = ads_state.ready = false;
    OKSDK.Ads.State.frame_element = ads_state.frame_element = null;
    OKSDK.Ads.State.window_frame = ads_state.window_frame = null;
  }
}

/**
 * Generates an URL for OK Ads Widget
 */
function getAdsWidgetSrc() {
  const sig = md5("call_id=1" + state.sessionSecretKey).toString();
  const widgetSrc =
    state.widgetServer +
    "dk?st.cmd=WidgetVideoAdv&st.app=" +
    state.app_id +
    "&st.sig=" +
    sig +
    "&st.call_id=1&st.session_key=" +
    state.sessionKey;
  return widgetSrc;
}

/**
 * Default callback function used for OK Ads Widget
 */
function defaultAdCallback(message: object | any) {
  if (!message.data) {
    return;
  }

  const data = JSON.parse(message.data);

  if (!data.call || !data.call.method) {
    return;
  }

  if (!data.result || !data.result.status) {
    return;
  }

  switch (data.call.method) {
    case "init":
      if (data.result.status === "ok") {
        console.log("OK Ads initialization complete");
        ads_state.init = true;
      } else {
        console.log("OK Ads failed to initialize");
        ads_state.init = false;
      }
      break;
    case "prepare":
      if (data.result.status === "ok") {
        if (data.result.code === "ready") {
          console.log("Ad is ready to be shown");
          ads_state.ready = true;
        }
      } else {
        console.log(
          "Ad is not ready to be shown. Status: " +
            data.result.status +
            ". Code: " +
            data.result.code
        );
        ads_state.ready = false;
      }
      break;
    case "show":
      ads_state.frame_element.style.display = "none";
      if (data.result.status === "ok") {
        if (data.result.code === "complete") {
          console.log("Ad is successfully shown");
          ads_state.ready = false;
        }
      } else {
        console.log(
          "An ad can't be shown. Status: " +
            data.result.status +
            ". Code: " +
            data.result.code
        );
        ads_state.ready = false;
      }
      break;
  }
}

// ---------------------------------------------------------------------------------------------------
// Widgets
// ---------------------------------------------------------------------------------------------------

const WIDGET_SIGNED_ARGS: ReadonlyArray<any> = [
  "st.attachment",
  "st.return",
  "st.redirect_uri",
  "st.state"
];

/**
 * Opens mediatopic post widget
 *
 * @param {String} returnUrl callback url (if null, result will be posted via postmessage and popup closed)
 * @param {Object} options options
 * @param {Object} options.attachment mediatopic (feed) to be posted
 */
function widgetMediatopicPost(returnUrl: string, options: any) {
  options = options || {};
  if (!options.attachment) {
    options = { attachment: options };
  }
  options.attachment = btoa(
    unescape(encodeURIComponent((toString(options.attachment) as string))
  ));
  widgetOpen("WidgetMediatopicPost", options, returnUrl);
}

/**
 * Opens app invite widget (invite friends to app)
 *
 * @see widgetSuggest widgetSuggest() for more details on arguments
 */
function widgetInvite(returnUrl: string, options: any) {
  widgetOpen("WidgetInvite", options, returnUrl);
}

/**
 * Opens app suggest widget (suggest app to friends, both already playing and not yet)
 *
 * @param {String} returnUrl callback url (if null, result will be posted via postmessage and popup closed)
 * @param {Object} [options] options
 * @param {int} [options.autosel] amount of friends to be preselected
 * @param {String} [options.comment] default text set in the suggestion text field
 * @param {String} [options.custom_args] custom args to be passed when app opened from suggestion
 * @param {String} [options.state] custom args to be passed to return url
 * @param {String} [options.target] comma-separated friend IDs that should be preselected by default
 */
function widgetSuggest(returnUrl: string, options: any) {
  widgetOpen("WidgetSuggest", options, returnUrl);
}

function widgetOpen(widget: string, args: any, returnUrl: string) {
  args = args || {};
  if (returnUrl !== null) {
    args.return = returnUrl;
  }

  const keys: Array<any> = [];
  for (const arg in args) {
    keys.push(arg.toString());
  }
  keys.sort();

  let sigSource = "";
  let query =
    state.widgetServer + "dk?st.cmd=" + widget + "&st.app=" + state.app_id;
  for (let i = 0; i < keys.length; i++) {
    const key = "st." + keys[i];
    const val = args[keys[i]];
    if (WIDGET_SIGNED_ARGS.indexOf(key) != -1) {
      sigSource += key + "=" + val;
    }
    query += "&" + key + "=" + encodeURIComponent(val);
  }
  sigSource += state.sessionSecretKey;
  query += "&st.signature=" + md5(sigSource);
  if (state.accessToken != null) {
    query += "&st.access_token=" + state.accessToken;
  }
  if (state.sessionKey) {
    query += "&st.session_key=" + state.sessionKey;
  }
  window.open(query);
}

// ---------------------------------------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------------------------------------

/**
 * Parses parameters to a JS map<br/>
 * Supports both window.location.search and window.location.hash)
 * @param {String} [source=window.location.search] string to parse
 * @returns {Object}
 */
function getRequestParameters(source: string) {
  let res: any = {};
  let url = source || window.location.search;

  if (url) {
    url = url.substr(1); // Drop the leading '?' / '#'
    const nameValues = url.split("&");

    for (let i = 0; i < nameValues.length; i += 1) {
      const nameValue = nameValues[i].split("=");
      const name = nameValue[0];
      let value = nameValue[1];

      value = decodeURIComponent(value.replace(/\+/g, " "));
      res[name] = value;
    }
  }
  return res;
}

const encodeUtf8 = (str: string = "") => unescape(encodeURIComponent(str));

const decodeUtf8 = (utftext: string = "") =>
  decodeURIComponent(escape(utftext));

/**
 * Checks if a game was opened in OK Android app's WebView
 * Checks if a game is opened in an OK Android app's WebView
 */
const isLaunchedInOKAndroidWebView = ((window: Window) => {
  const userAgent = window.navigator.userAgent;

  return (
    userAgent &&
    userAgent.length >= 0 &&
    userAgent.indexOf(OK_ANDROID_APP_UA) > -1
  );
}).bind(null, window);

/**
 * @callback onSuccessCallback
 * @param {String} result
 */

/**
 * @callback restCallback
 * @param {String} code (either 'ok' or 'error')
 * @param {Object} data success data
 * @param {Object} error error data
 */

// ---------------------------------------------------------------------------------------------------

export const REST = {
  call: restCall,
  calcSignature: calcSignatureExternal
};

export const Payment = {
  show: paymentShow,
  showInFrame: paymentShowInFrame,
  query: getPaymentQuery,
  closePaymentFrame
};

export const Widgets = {
  getBackButtonHtml: nop,
  post: widgetMediatopicPost,
  invite: widgetInvite,
  suggest: widgetSuggest
};

export const Ads = {
  init: injectAdsWidget,
  prepareMidroll,
  showMidroll,
  destroy: removeAdsWidget,
  State: ads_state
};

export const Util = {
  md5,
  encodeUtf8,
  decodeUtf8,
  encodeBase64: btoa,
  decodeBase64: atob,
  getRequestParameters,
  toString,
  isLaunchedFromOKApp: isLaunchedInOKAndroidWebView
};
