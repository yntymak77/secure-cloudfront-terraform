import { Unit } from "aws-embedded-metrics";
import * as jwt from "jsonwebtoken";
import { JwksClient, SigningKey } from "jwks-rsa";
import { CONFIG } from "../tools/config";
import withTelemetry from "../tools/telemetry";

const iss =
  "https://cognito-idp." +
  CONFIG.REGION +
  ".amazonaws.com/" +
  CONFIG.USERPOOLID;

const validateRS256 = async (
  token: string,
  decodedToken: any,
  client: JwksClient,
): Promise<any> => {
  const { kid, alg } = decodedToken.header;
  return new Promise((resolve, reject) => {
    try {
      client.getSigningKey(kid, (keyError: Error | null, key: SigningKey) => {
        if (keyError) {
          reject(keyError);
        }
        jwt.verify(
          token,
          key.getPublicKey(),
          {
            algorithms: [alg],
            ignoreExpiration: true, // For dev apis testing, when deploying on production, this option is ignored
          },
          (verificationError: any, decoded: unknown) => {
            if (verificationError) {
              reject(verificationError);
            }
            resolve(decoded);
          }
        );
      });
    } catch (error) {
      reject(error);
    }
  });
};

const authenticateRequest = async (token: string): Promise<boolean> => {
  // Here you can, as an example, send an HTTP Request to a
  // backend that would check the authentication token
  const jwtToken = token.split(" ").pop() || "";

  return new Promise((resolve, reject) => {
    const decodedJwt = jwt.decode(jwtToken, { complete: true });
    console.log("Decoded Token", decodedJwt);
    if (!decodedJwt) {
      return reject(new Error("Not a valid JWT token"));
    }

    if (typeof decodedJwt?.payload === "string") {
      return reject(new Error("payload is invalid"));
    }
    // UserPool check
    if (iss.localeCompare(decodedJwt?.payload?.iss || "")) {
      return reject(new Error("invalid issuer, check config.js"));
    }

    const jwksClient = new JwksClient({
      jwksUri: `${iss}/.well-known/jwks.json`,
    });

    validateRS256(jwtToken, decodedJwt, jwksClient)
      .then((verifiedToken) => {
        console.log("---verified", verifiedToken);

        resolve(verifiedToken);
      })
      .catch((err) => reject(err));
  });
};

export const handler: AWSLambda.CloudFrontRequestHandler = async (event) => {
  return withTelemetry(async (telemetry) => {
    const request = event.Records[0].cf.request;

    const token = request.headers["authorization"][0].value;

    if (token) {
      const authenticated = await authenticateRequest(token);
      if (authenticated) {
        return request;
      }
    }

    telemetry.metrics.putMetric("AuthenticationFailure", 1, Unit.Count);
    telemetry.metrics.setProperty("ResponseStatus", "403");

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
    };
  });
};
