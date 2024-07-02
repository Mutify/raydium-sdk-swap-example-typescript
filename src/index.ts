import RaydiumSwap from './RaydiumSwap';
import { Transaction, VersionedTransaction } from '@solana/web3.js';
import 'dotenv/config';
import { swapConfig } from './swapConfig'; // Import the configuration
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { unlinkSync, existsSync, writeFileSync, readFileSync, createWriteStream } from 'fs';
import fetch from 'node-fetch';
import { get } from 'https';

const argv = yargs(hideBin(process.argv)).argv;
const tokenAAddress = argv.tokenAAddress as string;
const tokenBAddress = argv.tokenBAddress as string;
const amount = parseFloat(argv.amount as string);
const direction = argv.direction as 'in' | 'out';
const walletNumber = parseInt(argv.walletNumber);

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function downloadFile(url: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('Downloading file from', url, 'as', outputPath);

    const fileStream = createWriteStream(outputPath);
    get(url, response => {
      if (response.statusCode === 200) {
        response.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          console.log('Download completed');
          resolve();
        });
      } else {
        fileStream.close();
        reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
      }
    }).on('error', err => {
      fileStream.close();
      reject(err);
    });
  });
}


/**
 * Load pool keys from the Raydium API.
 * If the local cache file exists, it will load from there.
 * Otherwise, it will download the pool keys from the Raydium API and save them to the local cache file.
 *
 * @param url
 * @param localCachePath
 */
async function loadPoolKeysAndCache(url: string, localCachePath: string): Promise<any> {
  if (existsSync(localCachePath)) {
    console.log('Loading from cache');
    return JSON.parse(readFileSync(localCachePath, 'utf-8'));
  } else {
    console.log('Downloading pool keys');
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch pool keys: ${response.statusText}`);
    }
    const data = await response.json();
    writeFileSync(localCachePath, JSON.stringify(data, null, 2));
    return data;
  }
}

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
    1: '4BPXQidTyrEUqePXYJJKC3jgFfydYvnL4q8cprggx7tzzjxmdghKDkx9sjNPWwNAcZDQBdutW7SNzo19mFu3AoUC',
    2: '4MZQLG7zrfd4PjVUkkKaMRWa9sxvr7n3oB6sVLB2X7HjGeF4YCnYbcTz4gp6ecd5Q1rd7QiB7teY8rMRCcL9AUAu',
    3: '3FBjkYam3HREQwZ7ZoYnUJQyJaVPSAVzWfLFHEKVzmiEpZS9Ai4D6Tx3Gdz4nPAsczxe9pz6L8LLfLQGNhVjNCbg',
    4: '4gQqXpYneCbE36GWvvf67de7bi3w996VdBPh8m1YMdv3VJziGGm4JueDK6NgR7c3yEEXNaU2CDENXmNCJKFDP7ec',
    5: '4Zwwx5hHzQEYb58c92NbByack1TUAf4DWoGTPv6gW7AyKsjHfpbDnQJG5JgksB7sXc6qnvf6eynWWC8kaNccT9zk',
    6: '3g26GuuW7SUxi3xXUmHr6M8QnpY25cJz7fDPNCcyHrXtJizuEt6CwUXyS4XBXfiWb6V6NvLosFUBvGQ4wwTnwxJz',
    7: '4a9HJNTDr8K4dn5MjuyGraS5NNYkSS53ecSXvRQsTJD4F2Tsitrko3NdVBDrBMXHpsoQ5ytLmrXhWnhBLLTM7rw8',
    8: '5rDUt5FSCFiJikcTfodGkXJqtpBPTGjCi8ZtBniAWmwSedFSdVZHS1Ly8xoGh9VqpVp3jURdYoWwHn9sPeJ2zvTc',
    9: 'kA4LWJMpF9o8LgapeqcdKegJoNvvVDBGn3GWNJSF5UT54XZtV1o1fQv8z6HhH91TfN1RJY4kUYEaNu4e8reAy25',
    10: '4Q8rQutLQjJSaZvq8g3wUHQzHZG8K5LLq78vW5vLWuqRe2bCLeYNSnQYGoqyNXbJr6QGVGisqE1yw7Yn93cYtbZK',
  };

  const walletPrivateKey = wallets[walletNumber];

  console.log(`Using wallet private key number: ${walletNumber} which is: ${walletPrivateKey}`);


  /**
   * The RaydiumSwap instance for handling swaps.
   */
  const raydiumSwap = new RaydiumSwap(process.env.RPC_URL, walletPrivateKey);
  console.log(`Raydium swap initialized`);
  console.log(`Swapping ${amount} of ${tokenAAddress} for ${tokenBAddress}...`)

  const url = swapConfig.liquidityFile;
  const localCachePath = './liquidityPoolKeys.json'; // Path where you want to save the cache
  if (existsSync(localCachePath)) {

  } else {
    await downloadFile(url, localCachePath)
        .then(() => console.log('File successfully downloaded'))
        .catch(error => console.error('Error downloading file:', error));
  }

  /**
   * Load pool keys from the Raydium API to enable finding pool information.
   */
  await raydiumSwap.loadPoolKeys(localCachePath);
  console.log(`Loaded pool keys`);

  /**
   * Find pool information for the given token pair.
   */
  const poolInfo= raydiumSwap.findPoolInfoForTokens(tokenAAddress, tokenBAddress);

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


// usage yarn swap --tokenAAddress=my-custom-token-address --tokenBAddress=my-custom-token-address --amount=0.1 --direction=in
// swap(tokenAAddress, tokenBAddress, amount, direction, walletNumber);

function roundToDecimals(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

const swapWrap = async () => {
  const amount2 = getRandom(0.00073, 0.01); // random from 0.1 eur to 1.4 eur
  const roundedSolAmount = roundToDecimals(amount2, 9);

  console.log("Swapping amount: ", roundedSolAmount, " of token: ", tokenAAddress, " for token: ", tokenBAddress, " with direction: ", direction, " using wallet number: ", walletNumber);

  await swap(tokenAAddress, tokenBAddress, roundedSolAmount, direction, walletNumber);

  // sleep 10 seconds
  await sleepRandom(10, 25);
}

// lamur : E3HLt1EbaVQjJjXTbz18MuuQBXjBHKh4PNN2DMLdsSqf
const main = async () => {
  while (true) {
    await swapWrap().catch((err) => {
      console.error(err);
    });
  }
}

main();
