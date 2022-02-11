import { Unit } from 'aws-embedded-metrics'
import * as jwt from 'jsonwebtoken';
import { CONFIG } from '../tools/config';
const jwkToPem = require('jwk-to-pem');

import withTelemetry from '../tools/telemetry'

const iss = 'https://cognito-idp.' + CONFIG.REGION + '.amazonaws.com/' + CONFIG.USERPOOLID;

const generatePems = () => {
  const pems: Record<string, any> = {};
  const keys = CONFIG.JWKS.keys;
  keys.forEach(key => {
    const key_id = key.kid;
    const modulus = key.n;
    const exponent = key.e;
    const key_type = key.kty;
    const jwk = { kty: key_type, n: modulus, e: exponent};
    const pem = jwkToPem(jwk as any);
    pems[key_id] = pem;
  });

  return pems;
}

const authenticateRequest = async (token: string): Promise<boolean> => {
  // Here you can, as an example, send an HTTP Request to a
  // backend that would check the authentication token
  const jwtToken = token.split(' ').pop() || "";
  const pems = generatePems();

  return new Promise((resolve, reject) => {
    const decodedJwt = jwt.decode(jwtToken, {complete: true});
    console.log("Decoded Token", decodedJwt);
    if (!decodedJwt) {
        
        return reject(new Error("Not a valid JWT token"));
    }

    if (typeof decodedJwt?.payload === 'string') {
        return reject(new Error("payload is invalid"));
    }
    // UserPool check
    if (decodedJwt?.payload?.iss != iss) {
        return reject(new Error("invalid issuer, check config.js"));
    }

    //Reject the jwt if it's not an 'Access Token'
    if (decodedJwt?.payload.token_use != 'access') {
        console.log();

        return reject(new Error("Not an access token"));
    }

    //Get the kid from the token and retrieve corresponding PEM
    const kid = decodedJwt?.header.kid as string;
    const pem = pems[kid];
    if (!pem) {
        return reject(new Error('Invalid access token'));
    }

    //Verify the signature of the JWT token to ensure it's really coming from your User Pool
    jwt.verify(jwtToken, pem, { issuer: iss }, function(err: any) {
      if(err) {
        return reject(err);
      } else {
        //Valid token. 
        console.log('Successful verification');
        //remove authorization header

        return resolve(true);
      }
    });
  })  
}

export const handler: AWSLambda.CloudFrontRequestHandler = async (event) => {
  return withTelemetry(async (telemetry) => {
    const request = event.Records[0].cf.request

    const token = request.headers['authorization'][0].value
  
    if (token) {
      const authenticated = await authenticateRequest(token)
      if (authenticated) {
        return request
      }
    }

    telemetry.metrics.putMetric('AuthenticationFailure', 1, Unit.Count)
    telemetry.metrics.setProperty('ResponseStatus', '403')
  
    return {
      status: "403",
      headers: {
        "content-type": [
          {
            key: "Content-Type",
            value: "application/json",
          },
        ],
        "cache-control": [
          {
            key: "Cache-Control",
            value: "no-cache",
          },
        ],
      },
      bodyEncoding: "text",
      body: JSON.stringify(
        {
          error: "Unauthenticated request",
        },
        null,
        2
      ),
    }
  })
}
