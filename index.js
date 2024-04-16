const LitJsSdk = require("@lit-protocol/lit-node-client");
const {
  LitAbility,
  LitActionResource,
  RecapSessionCapabilityObject,
} = require("@lit-protocol/auth-helpers");
const ethers = require("ethers");
const { SiweMessage } = require("siwe");

const LIT_ACTION_CODE = `
const go = async () => {
    // Making a http request to 127.0.0.1 doesn't work, because we require HTTPS.  The request is automatically redirected
    // to https://externalIp/web/execute, but the request fails becuase that uses port 443 by default, and that's only
    // accessible from the outside world.  We need to use port 8443, so we need to extract the external IP address from the error message
    let externalIp;
    try {
        const resp = await fetch("http://127.0.0.1/web/execute", {
            method: "POST",
        })
    } catch(e) {
        // error looks like this:
        // TypeError: error sending request for url (https://84.16.248.164/web/execute#undefined): error trying to connect: tcp connect error: Connection refused (os error 111)
        // we want to use a regex to extract the IP address from the error message and append port 8443 to it.  This is required for the request to work from inside the encrypted VM
        const r = /\\b\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\b/
        const a = e.toString();
        externalIp = a.match(r)[0]
    }

    // define the child lit action code.  This could also be an IPFS CID.
    const childLitActionCode = "Lit.Actions.setResponse({response: 'Hello from the child'})";
    const childLitActionCodeBase64Encoded = btoa(childLitActionCode);

    // define the child request body.  you have to pass authSig through.
    const body = JSON.stringify({
        authSig,
        jsParams: {},
        code: childLitActionCodeBase64Encoded
    })

    // make the request - it's important that these requests have the same child correlation id, because the
    // nodes use this to match up signing requests.  signing will fail if a request to sign comes in to different nodes with different correlation ids
    const resp = await fetch("https://" +externalIp + ":8443/web/execute", {
        method: "POST",
        headers: {
            "X-Correlation-Id": childCorrelationId,
            "Content-Type": "application/json",
        },
        body
    })
    const jsonResponse = await resp.json();

    // we just return the child response as the response to the parent, but you could do anything you want with it
    Lit.Actions.setResponse({response: JSON.stringify(jsonResponse)})
};
go();
`;

const getAuthSig = async () => {
  const privateKey = process.env.LIT_ROLLUP_MAINNET_DEPLOYER_PRIVATE_KEY;
  const wallet = new ethers.Wallet(privateKey);
  const address = await wallet.getAddress();

  // Craft the SIWE message
  const domain = "localhost";
  const origin = "https://localhost/login";
  const statement =
    "This is a test statement.  You can put anything you want here.";
  let siweMessage = new SiweMessage({
    domain,
    address: address,
    statement,
    uri: origin,
    version: "1",
    chainId: 1,
    expirationTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });

  const sessionCapabilityObject = new RecapSessionCapabilityObject({}, []);
  const litActionResource = new LitActionResource("*");
  sessionCapabilityObject.addCapabilityForResource(
    litActionResource,
    LitAbility.LitActionExecution
  );
  siweMessage = sessionCapabilityObject.addToSiweMessage(siweMessage);

  const messageToSign = siweMessage.prepareMessage();

  // Sign the message and format the authSig
  const signature = await wallet.signMessage(messageToSign);

  const authSig = {
    sig: signature,
    derivedVia: "web3.eth.personal.sign",
    signedMessage: messageToSign,
    address: address,
  };

  return authSig;
};

const main = async () => {
  const client = new LitJsSdk.LitNodeClient({
    litNetwork: "manzano",
  });
  await client.connect();

  const authSig = await getAuthSig();

  // each child function you call should have a unique child correlation ID.
  // typically this is set automatically for you by the SDK, but in this case we're doing the SDK's work inside the lit action,
  // so we need to set it manually.
  const childCorrelationId = Math.random().toString(16).slice(2);

  const response = await litNodeClient.executeJs({
    code: LIT_ACTION_CODE,
    authSig,
    jsParams: {
      childCorrelationId,
      authSig,
    },
  });

  console.log("response: ", response);

  process.exit(0);
};

main()
  .catch(console.error)
  .finally(() => process.exit(0));
