// const jwkToPem = require("jwk-to-pem"),
//   axios = require("axios"),
//   jwt = require("jsonwebtoken");

import jwkToPem from 'jwk-to-pem';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { injectable } from 'inversify';

export interface CognitoConfig {
  region?: string,
  cognitoUserPoolId?: string,
  tokenUse?: "access" | "id",
  tokenExpiration?: number,
  [key: string]: any,
};

export default class CognitoInstance {
  private userPoolId: string;
  private tokenUse: string;
  private tokenExpiration: number;
  private iss: string;
  private hasFinishedProcessing: Promise<void>;
  private pems: any;

  constructor(config: CognitoConfig) {
    if (!config)
      throw new TypeError(
        "Options not found. Please refer to README for usage example at https://github.com/ghdna/cognito-express"
      );

    if (configurationIsCorrect(config)) {
      this.userPoolId = config.cognitoUserPoolId;
      this.tokenUse = config.tokenUse;
      this.tokenExpiration = config.tokenExpiration || 3600000;
      this.iss = `https://cognito-idp.${config.region}.amazonaws.com/${this.userPoolId}`;
      this.hasFinishedProcessing = this.init();
      this.pems = {};
    }
  }

  async init() {
      try {
        const response = await axios(`${this.iss}/.well-known/jwks.json`);
        if (response.data.keys) {
          const keys = response.data.keys;
          for (let i = 0; i < keys.length; i++) {
            const key_id = keys[i].kid;

            const modulus = keys[i].n;
            const exponent = keys[i].e;
            const key_type = keys[i].kty;
            const jwk = {
              kty: key_type,
              n: modulus,
              e: exponent,
            };
            const pem = jwkToPem(jwk);
            this.pems[key_id] = pem;
          }
        }
      } catch (err) {
        console.error(err);
        throw "Unable to generate certificate due to \n" + err;
      }
  }

  async validate(token: string): Promise<string | object> {
    await this.hasFinishedProcessing;
      const decodedJwt = jwt.decode(token, {
        complete: true,
      });
      try {
        console.log(decodedJwt);

        if (!decodedJwt) throw new TypeError("Not a valid JWT token");

        if (decodedJwt.payload.iss !== this.iss)
          throw new TypeError("token is not from your User Pool");

        if (decodedJwt.payload.token_use !== this.tokenUse)
          throw new TypeError(`Not an ${this.tokenUse} token`);

        const kid = decodedJwt.header.kid;
        const pem = this.pems[kid];

        if (!pem) throw new TypeError(`Invalid ${this.tokenUse} token`);

        const result = jwt.verify(token, pem, {
          issuer: this.iss,
          maxAge: this.tokenExpiration.toString()
        })
        return result;

      } catch (error) {
        console.error(error);
        throw (error);
      }
  }
}

function configurationIsCorrect(config: CognitoConfig) {
  let configurationPassed = false;
  switch (true) {
    case !config.region:
      throw new TypeError("AWS Region not specified in constructor");

    case !config.cognitoUserPoolId:
      throw new TypeError(
        "Cognito User Pool ID is not specified in constructor"
      );

    case !config.tokenUse:
      throw new TypeError(
        "Token use not specified in constructor. Possible values 'access' | 'id'"
      );

    case !(config.tokenUse == "access" || config.tokenUse == "id"):
      throw new TypeError(
        "Token use values not accurate in the constructor. Possible values 'access' | 'id'"
      );

    default:
      configurationPassed = true;
  }
  return configurationPassed;
}
