// utils/queryCognitoUser.ts

const AWS_ACCESS_KEY_ID = "AKIAXCKDHW3N7NCXH2VG";
const AWS_SECRET_ACCESS_KEY = "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";
const AWS_REGION = "us-east-1";
const AWS_SERVICE_NAME = "cognito-idp";
const AWS_API_ENDPOINT = `${AWS_SERVICE_NAME}.${AWS_REGION}.amazonaws.com`;
const AWS_HTTP_METHOD = "POST";
const AWS_API_PATH = "/";
const AWS_API_QUERY_PARAMS = {};
const TARGET = "com.amazonaws.cognito.identity.idp.model.AWSCognitoIdentityProviderService"

const encoder = new TextEncoder();

function bufferToHex(buffer: ArrayBuffer): string {
  const byteArray = new Uint8Array(buffer);
  const hexCodes = Array.from(byteArray).map(value => {
    const hexCode = value.toString(16);
    const paddedHexCode = hexCode.padStart(2, '0');
    return paddedHexCode;
  });
  return hexCodes.join('');
}

async function hmac(key: ArrayBuffer, message: string): Promise<ArrayBuffer> {
  return crypto.subtle.sign({ name: 'HMAC', hash: 'SHA-256' }, await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), encoder.encode(message));
}

export async function cognitoRequest(operation: string, body: object): Promise<any> {
  const timestamp = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, "");
  const date = timestamp.substr(0, 8);

  const AWS_API_BODY = JSON.stringify(body);

  const canonicalQueryString = Object.keys(AWS_API_QUERY_PARAMS).sort().map(key => `${key}=${encodeURIComponent(AWS_API_QUERY_PARAMS[key])}`).join("&");
  const canonicalHeaders = `content-type:application/x-amz-json-1.0\nhost:${AWS_API_ENDPOINT}\nx-amz-date:${timestamp}\nx-amz-target:${TARGET}.${operation}\n`;
  const signedHeaders = "content-type;host;x-amz-date;x-amz-target";

  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(AWS_API_BODY));
  const canonicalRequest = `${AWS_HTTP_METHOD}\n${AWS_API_PATH}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${bufferToHex(digest)}`;

  const canonicalRequestHash = await crypto.subtle.digest('SHA-256', encoder.encode(canonicalRequest));

  const credentialScope = `${date}/${AWS_REGION}/${AWS_SERVICE_NAME}/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${timestamp}\n${credentialScope}\n${bufferToHex(canonicalRequestHash)}`;

  const kDate = await hmac(encoder.encode(`AWS4${AWS_SECRET_ACCESS_KEY}`), date);
  const kRegion = await hmac(kDate, AWS_REGION);
  const kService = await hmac(kRegion, AWS_SERVICE_NAME);
  const kSigning = await hmac(kService, "aws4_request");
  const signature = await hmac(kSigning, stringToSign);

  const authorizationHeader = `AWS4-HMAC-SHA256 Credential=${AWS_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${bufferToHex(signature)}`;
  const headers = {
    "Content-Type": "application/x-amz-json-1.0",
    "X-Amz-Date": timestamp,
    "X-Amz-Target": `${TARGET}.${operation}`,
    "Authorization": authorizationHeader,
  };
  const options: RequestInit = {
    method: AWS_HTTP_METHOD,
    headers: headers,
    body: AWS_API_BODY
  };
  try {
    const response = await fetch(`https://${AWS_API_ENDPOINT}${AWS_API_PATH}`, options);
    const data = await response.json();
    if (!response.ok) {
      console.log(data)
      throw new Error(`Error ${response.status}: ${data.Message ?? data.message}`);
    }
    return data;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

