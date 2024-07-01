import RaydiumSwap from './RaydiumSwap';
import { Transaction, VersionedTransaction } from '@solana/web3.js';
import 'dotenv/config';
import { swapConfig } from './swapConfig'; // Import the configuration
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { unlinkSync, existsSync, writeFileSync } from 'fs';

const argv = yargs(hideBin(process.argv)).argv;
const tokenAAddress = argv.tokenAAddress as string;
const tokenBAddress = argv.tokenBAddress as string;
const amount = parseFloat(argv.amount as string);
const direction = argv.direction as 'in' | 'out';
const walletNumber = parseInt(argv.walletNumber);

/**
 * Performs a token swap on the Raydium protocol.
 * Depending on the configuration, it can execute the swap or simulate it.
 */
const swap = async (tokenAAddress: string, tokenBAddress: string, amount: number, direction: 'in' | 'out', walletNumber: number) => {
  // Remove the swapDetails.json file if it exists
  if (existsSync('swapDetails.json')) {
    unlinkSync('swapDetails.json');
  }

  const wallets = {
    1: '4BPXQidTyrEUqePXYJJKC3jgFfydYvnL4q8cprggx7tzzjxmdghKDkx9sjNPWwNAcZDQBdutW7SNzo19mFu3AoUC'
  };

  const walletPrivateKey = wallets[walletNumber];

  console.log(`Using wallet private key number: ${walletNumber} which is: ${walletPrivateKey}`);


  /**
   * The RaydiumSwap instance for handling swaps.
   */
  const raydiumSwap = new RaydiumSwap(process.env.RPC_URL, walletPrivateKey);
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
    const {transaction: tx, swapDetails} = await raydiumSwap.getSwapTransaction(
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

      const solScanUrl = `https://solscan.io/tx/${txid}`;
      swapDetails.solScanUrl = solScanUrl;
      const finalFile = {
        solScanUrl: solScanUrl,
        amountIn: parseInt(swapDetails.amountIn.numerator, 16) / parseInt(swapDetails.amountIn.denominator, 16),
        amountOut: parseInt(swapDetails.amountOut.numerator, 16) / parseInt(swapDetails.amountOut.denominator, 16),
        minAmountOut: parseInt(swapDetails.minAmountOut.numerator, 16) / parseInt(swapDetails.minAmountOut.denominator, 16),
        fee: parseInt(swapDetails.fee.numerator, 16) / parseInt(swapDetails.fee.denominator, 16),
        currentPrice: parseInt(swapDetails.currentPrice.numerator, 16) / parseInt(swapDetails.currentPrice.denominator, 16),
        executionPrice: parseInt(swapDetails.executionPrice.numerator, 16) / parseInt(swapDetails.executionPrice.denominator, 16),
        priceImpact: parseInt(swapDetails.priceImpact.numerator, 16) / parseInt(swapDetails.priceImpact.denominator, 16),
      }
      console.log(solScanUrl);

      // Write the swapDetails object to a file
      writeFileSync('swapDetails.json', JSON.stringify(finalFile));
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

// Function to generate a random number between min and max
const getRandom = (min: number, max: number) => {
  return Math.random() * (max - min) + min;
}

// Function to sleep for a random duration between min and max seconds
const sleepRandom = async (min: number, max: number) => {
  const ms = getRandom(min, max) * 1000;
  return new Promise(resolve => setTimeout(resolve, ms));
}

// The while loop
// while (true) {
//   const amount2 = getRandom(0.000073, 0.000727);
//   swap(tokenAAddress, tokenBAddress, amount2, direction, walletNumber);
  //     .then(() => sleepRandom(5, 10))
  //     .then(() => console.log('Cycle completed'))
  //     .catch(error => console.error('An error occurred:', error));
  //
  // sleepRandom(5, 10).then(() => console.log('Sleeping...'));
// }


// usage yarn swap --tokenAAddress=my-custom-token-address --tokenBAddress=my-custom-token-address --amount=0.1 --direction=in
// swap(tokenAAddress, tokenBAddress, amount, direction, walletNumber);

function roundToDecimals(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

const swapWrap = async () => {
  const amount2 = getRandom(0.000073, 0.000727);
  const roundedSolAmount = roundToDecimals(amount2, 9);
  // await swap(tokenAAddress, tokenBAddress, roundedSolAmount, direction, walletNumber);
  console.log("Swapping amount: ", roundedSolAmount, " of token: ", tokenAAddress, " for token: ", tokenBAddress, " with direction: ", direction, " using wallet number: ", walletNumber);
  // sleep 10 seconds
  await sleepRandom(2, 6);
}

const main = async () => {
  while (true) {
    await swapWrap().catch((err) => {
      console.error(err);
    });
  }
}

main();
