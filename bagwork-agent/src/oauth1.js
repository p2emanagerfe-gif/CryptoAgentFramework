import crypto from "node:crypto";

/**
 * Minimal OAuth 1.0a request signer — just enough to authenticate a
 * user-context POST to the X (Twitter) API v2, which still requires
 * OAuth 1.0a (or an interactive OAuth2 user-token flow we're not
 * building here) to post on behalf of an account. No external
 * dependency; this is a well-defined, stable algorithm (RFC 5849) and
 * hand-rolling it keeps this project's dependency footprint the same
 * as mint-agent's (dotenv + whatever the platform's own SDK would add).
 *
 * Deliberately does NOT sign JSON request bodies — per X API v2's own
 * documented behavior, only oauth_* parameters (and query-string
 * parameters, which this project doesn't use) go into the signature
 * base string for JSON-bodied requests. Getting this wrong produces a
 * silent 401, not a helpful error, so it's called out explicitly here.
 */

function percentEncode(str) {
  return encodeURIComponent(str).replace(/[!*'()]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

function buildSignatureBaseString(method, url, params) {
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(params[key])}`)
    .join("&");
  return [method.toUpperCase(), percentEncode(url), percentEncode(sortedParams)].join("&");
}

function buildSigningKey(consumerSecret, tokenSecret) {
  return `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret ?? "")}`;
}

/**
 * Returns a ready-to-use `Authorization` header value for a POST request
 * with a JSON body (no form-encoded/query params to include in signing).
 */
export function buildOAuth1Header({ method, url, consumerKey, consumerSecret, accessToken, accessTokenSecret }) {
  const oauthParams = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: "1.0",
  };

  const baseString = buildSignatureBaseString(method, url, oauthParams);
  const signingKey = buildSigningKey(consumerSecret, accessTokenSecret);
  const signature = crypto.createHmac("sha1", signingKey).update(baseString).digest("base64");

  const headerParams = { ...oauthParams, oauth_signature: signature };
  const headerString =
    "OAuth " +
    Object.keys(headerParams)
      .sort()
      .map((key) => `${percentEncode(key)}="${percentEncode(headerParams[key])}"`)
      .join(", ");

  return headerString;
}
