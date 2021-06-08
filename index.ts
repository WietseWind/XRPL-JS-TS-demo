import { XrplClient } from "xrpl-client";
import { derive, sign } from "xrpl-accountlib";

const secret = "sn2a___YOUR_SECRET_HERE___XvgHa";

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

  const { id, signedTransaction } = sign(
    {
      TransactionType: "Payment",
      Account: account.address,
      Destination: "rwietsevLFg8XSmG3bEZzFein1g8RBqWDZ",
      Amount: String(25 * 1_000_000),
      Sequence: account_data.Sequence,
      Fee: String(12),
      LastLedgerSequence: client.getState().ledger.last + 5, // Expect finality in max. 5 ledgers
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
      }
    }
  );
};

main();
