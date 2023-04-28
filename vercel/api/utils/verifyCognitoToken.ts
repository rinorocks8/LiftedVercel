import fetch from "node-fetch"
import { AuthenticationError } from "./errors";
import { Base64 } from 'js-base64';

async function jwkToCryptoKey(jwk) {
  const { n, e, alg } = jwk;

  const keyData = {
    kty: 'RSA',
    e: e,
    n: n,
    alg: alg,
    ext: true,
  };

  return await crypto.subtle.importKey(
    'jwk',
    keyData,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-' + alg.slice(2),
    },
    true,
    ['verify']
  );
}

async function verifySignature(jwt, jwk) {
  const [header, payload, signature] = jwt.split('.');
  const data = header + '.' + payload;
  const dataBuffer = new TextEncoder().encode(data);
  const signatureBuffer = Base64.toUint8Array(signature);
  
  const cryptoKey = await jwkToCryptoKey(jwk);

  return await crypto.subtle.verify(
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-' + jwk.alg.slice(2),
    },
    cryptoKey,
    signatureBuffer,
    dataBuffer
  );
}

function parseJwt(jwt) {
  const parts = jwt.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT token");
  }
  const header = JSON.parse(Base64.decode(parts[0]));
  const payload = JSON.parse(Base64.decode(parts[1]));
  return { header, payload };
}

function findJwk(jwks, kid) {
  const jwk = jwks.keys.find((key) => key.kid === kid);
  if (!jwk) {
    throw new Error("JWK not found");
  }
  return jwk;
}

async function fetchJwks(url) {
  const response = await fetch(url);
  const jwks = await response.json();
  return jwks;
}

async function verifyJwt(jwt, jwks) {
  const { header, payload } = parseJwt(jwt);
  const jwk = findJwk(jwks, header.kid);

  if (!(await verifySignature(jwt, jwk))) {
    throw new Error("Invalid signature");
  }

  return payload;
}

export async function verifyCognitoToken(jwt: string) {
  const jwksUrl = `https://cognito-idp.us-east-1.amazonaws.com/${process.env.userPoolID}/.well-known/jwks.json`;
  try {
    const jwks = await fetchJwks(jwksUrl);
    const payload = await verifyJwt(jwt, jwks);
    return payload;
  } catch (error) {
    throw new AuthenticationError(error)
  }
}