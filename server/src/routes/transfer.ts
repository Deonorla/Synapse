import { Router } from 'express';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { getAgentWallet } from '../db/sqlite.ts';
import { suiClient } from '../config/sui.ts';

export const transferRouter = Router();

/**
 * POST /api/transfer/agent-to-user
 * Transfer SUI from the agent wallet to the user's wallet.
 * Body: { ownerAddress: string, recipientAddress: string, amountMist: number }
 */
transferRouter.post('/agent-to-user', async (req, res) => {
  try {
    const { ownerAddress, recipientAddress, amountMist } = req.body;

    if (!ownerAddress || !recipientAddress || !amountMist) {
      return res.status(400).json({
        error: 'ownerAddress, recipientAddress, and amountMist are required',
      });
    }

    if (amountMist <= 0) {
      return res.status(400).json({ error: 'amountMist must be greater than 0' });
    }

    // Get the encrypted agent wallet for this owner
    const wallet = await getAgentWallet(ownerAddress);
    if (!wallet) {
      return res.status(404).json({ error: 'No agent wallet found for this owner. Register first.' });
    }

    // Decrypt and initialize the agent keypair
    const agentKeypair = Ed25519Keypair.fromSecretKey(wallet.privateKeyStr);

    // Check agent balance
    const balance = await suiClient.getBalance({ owner: wallet.agentAddress });
    const availableMist = Number(balance.totalBalance);

    if (availableMist < amountMist) {
      return res.status(400).json({
        error: `Insufficient balance. Available: ${availableMist} MIST, Requested: ${amountMist} MIST`,
      });
    }

    // Build the transfer transaction
    const tx = new Transaction();
    tx.setSender(wallet.agentAddress);
    const [paymentCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountMist)]);
    tx.transferObjects([paymentCoin], tx.pure.address(recipientAddress));

    // Execute the transaction
    const builtTx = await tx.build({ client: suiClient });
    const signedTx = await agentKeypair.signTransaction(builtTx);

    const result = await suiClient.executeTransactionBlock({
      transactionBlock: signedTx.bytes,
      signature: signedTx.signature,
    });

    console.log(`[transfer] Agent ${wallet.agentAddress} sent ${amountMist} MIST to ${recipientAddress}. Digest: ${result.digest}`);

    res.json({
      message: 'Transfer successful',
      digest: result.digest,
      from: wallet.agentAddress,
      to: recipientAddress,
      amountMist,
    });
  } catch (error: any) {
    console.error('[transfer/agent-to-user]', error.stack || error);
    res.status(500).json({ error: error.message || 'Transfer failed' });
  }
});

/**
 * GET /api/transfer/balances?ownerAddress=...
 * Get both user and agent balances in one call.
 */
transferRouter.get('/balances', async (req, res) => {
  try {
    const ownerAddress = req.query.ownerAddress as string;
    if (!ownerAddress) {
      return res.status(400).json({ error: 'ownerAddress query parameter is required' });
    }

    // Get user (owner) balance
    const userBalance = await suiClient.getBalance({ owner: ownerAddress });

    // Get agent balance if wallet exists
    let agentAddress = null;
    let agentBalance = null;
    const wallet = await getAgentWallet(ownerAddress);
    if (wallet) {
      agentAddress = wallet.agentAddress;
      agentBalance = await suiClient.getBalance({ owner: wallet.agentAddress });
    }

    res.json({
      user: {
        address: ownerAddress,
        balanceMist: Number(userBalance.totalBalance),
      },
      agent: agentAddress
        ? {
            address: agentAddress,
            balanceMist: Number(agentBalance!.totalBalance),
          }
        : null,
    });
  } catch (error: any) {
    console.error('[transfer/balances]', error.stack || error);
    res.status(500).json({ error: error.message || 'Failed to fetch balances' });
  }
});
