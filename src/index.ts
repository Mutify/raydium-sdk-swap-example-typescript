import RaydiumSwap from './RaydiumSwap';
import { Transaction, VersionedTransaction } from '@solana/web3.js';
import 'dotenv/config';
import { swapConfig } from './swapConfig'; // Import the configuration
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const argv = yargs(hideBin(process.argv)).argv;
const tokenAAddress = argv.tokenAAddress as string;
const tokenBAddress = argv.tokenBAddress as string;
const amount = parseFloat(argv.amount as string);
const direction = argv.direction as 'in' | 'out';

/**
 * Performs a token swap on the Raydium protocol.
 * Depending on the configuration, it can execute the swap or simulate it.
 */
const swap = async (tokenAAddress: string, tokenBAddress: string, amount: number, direction: 'in' | 'out') => {
  /**
   * The RaydiumSwap instance for handling swaps.
   */
  const raydiumSwap = new RaydiumSwap(process.env.RPC_URL, process.env.WALLET_PRIVATE_KEY);
  console.log(`Raydium swap initialized`);
  console.log(`Swapping ${amount} of ${tokenAAddress} for ${tokenBAddress}...`)

  /**
   * Load pool keys from the Raydium API to enable finding pool information.
   */
  await raydiumSwap.loadPoolKeys(swapConfig.liquidityFile);
  console.log(`Loaded pool keys`);

  /**
   * Find pool information for the given token pair.
   */
  const poolInfo = raydiumSwap.findPoolInfoForTokens(tokenAAddress, tokenBAddress);
  if (!poolInfo) {
    console.error('Pool info not found');
    process.exit(1);
    return 'Pool info not found';
  } else {
    console.log('Found pool info');
  }

  try {
    const tx = await raydiumSwap.getSwapTransaction(
        tokenBAddress,
        amount,
        poolInfo,
        swapConfig.maxLamports,
        swapConfig.useVersionedTransaction,
        direction
    );

    if (swapConfig.executeSwap) {
      const txid = swapConfig.useVersionedTransaction
          ? await raydiumSwap.sendVersionedTransaction(tx as VersionedTransaction, swapConfig.maxRetries)
          : await raydiumSwap.sendLegacyTransaction(tx as Transaction, swapConfig.maxRetries);

      console.log(`https://solscan.io/tx/${txid}`);
    } else {
      const simRes = swapConfig.useVersionedTransaction
          ? await raydiumSwap.simulateVersionedTransaction(tx as VersionedTransaction)
          : await raydiumSwap.simulateLegacyTransaction(tx as Transaction);

      console.log(simRes);
    }
  } catch (error) {
    console.error('An error occurred:', error);
    process.exit(1);
  }
};

// usage yarn swap --tokenAAddress=my-custom-token-address --tokenBAddress=my-custom-token-address --amount=0.1 --direction=in
swap(tokenAAddress, tokenBAddress, amount, direction);
