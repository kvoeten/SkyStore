import { expect, it } from "vitest";
import Discord from "next-auth/providers/discord";
import { skipStateCheck, validateAuthResponse } from "oauth4webapi";

it("accepts Discord issuer responses and rejects a mismatched issuer",()=>{
  const provider=Discord({issuer:"https://discord.com",clientId:"test-client",clientSecret:"test-secret"});
  const issuer=provider.options?.issuer;
  expect(issuer).toBe("https://discord.com");
  const response=new URLSearchParams({code:"test-code",iss:"https://discord.com"});
  expect(()=>validateAuthResponse({issuer:issuer!},{client_id:"test-client"},response,skipStateCheck)).not.toThrow();
  expect(()=>validateAuthResponse({issuer:"https://authjs.dev"},{client_id:"test-client"},response,skipStateCheck)).toThrow();
});
