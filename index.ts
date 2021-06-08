import { XrplClient } from "xrpl-client";
import { derive, sign } from "xrpl-accountlib";

// Please only do this if you want to build your own platform & sign headless.
// It's bad practice to add your secret to source code or a config file. In
// this case it's for demonstration/educational purposes only.
//
// If you want to interact with end users, please use the XUMM SDK, and
// NEVER ask for end user secrets! You do not want that responsibility!
//    > https://www.npmjs.com/package/xumm-sdk
//    > https://dev.to/wietse/how-to-use-the-xumm-sdk-in-node-js-5380

const secret = "sh8tjTEJTRaBNdiJkmk4kzsWpbThS";

const client = new XrplClient("wss://hooks-testnet.xrpl-labs.com");
const account = derive.familySeed(secret);

console.log("Account address:", account.address);

const main = async () => {
  const { account_data } = await client.send({
    command: "account_info",
    account: account.address,
  });

  console.log(
    `Account balance (XRP) ${Number(account_data.Balance) / 1_000_000}`
  );

  // Wait until we know what the current ledger index is
  await client.ready();

  const LastLedgerSequence = client.getState().ledger.last + 2; // Expect finality in max. 5 ledgers

  const { id, signedTransaction } = sign(
    {
      TransactionType: "Payment",
      Account: account.address,
      Destination: "rwietsevLFg8XSmG3bEZzFein1g8RBqWDZ",
      Amount: String(25 * 1_000_000),
      Sequence: account_data.Sequence,
      Fee: String(12),
      LastLedgerSequence,
    },
    account
  );

  console.log("Transaction hash:", id);

  client.send({ command: "subscribe", accounts: [account.address] });

  client
    .send({ command: "submit", tx_blob: signedTransaction })
    .then(({ accepted, engine_result }) =>
      console.log("Transaction sent:", accepted, engine_result)
    );

  client.on(
    "transaction",
    ({ transaction, meta, ledger_index, engine_result }) => {
      if (transaction.hash === id) {
        console.log(
          `Transaction in ledger:\n  ${ledger_index}\nTransaction status:\n  ${engine_result}\nDelivered amount:\n  ${meta.delivered_amount}`
        );
        if (typeof meta.delivered_amount === "string") {
          const xrp = Number(meta.delivered_amount) / 1_000_000;
          console.log(`Delivered amount in XRP instead of drops:\n  ${xrp}`);
        }
        client.close();
      }
    }
  );

  client.on("ledger", ({ ledger_index }) => {
    if (ledger_index > LastLedgerSequence) {
      console.log(
        "Past last ledger & transaction not seen. Transaction failed"
      );
      client.close();
    }
  });
};

main();
