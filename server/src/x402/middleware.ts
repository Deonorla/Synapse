import { Request, Response, NextFunction } from 'express';
import { verifyPaymentProof } from './verify.ts';
import { getPrice, getSeller } from '../marketplace/discovery.ts';
import { agentAddress } from '../config/sui.ts';

/**
 * Express middleware that intercepts requests and enforces x402 Payment Required.
 * If fixedPriceMist is provided, it expects a flat fee to the fixedRecipientAddress (defaults to agentAddress).
 * If fixedPriceMist is NOT provided, it expects req.params.id to be a listing ID and dynamically fetches the price.
 */
export function requireX402Payment(fixedPriceMist?: number, fixedRecipientAddress?: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if a valid payment proof is provided in headers
      const txDigest = req.headers['x-sui-payment-digest'] as string;
      
      let expectedPrice = fixedPriceMist;
      let expectedRecipient = fixedRecipientAddress || agentAddress;

      // If no fixed price, we expect a listing ID
      if (expectedPrice === undefined) {
        const listingId = req.params.id;
        if (!listingId) {
          return res.status(400).json({ error: 'Listing ID is required for dynamic pricing' });
        }
        
        expectedPrice = await getPrice(listingId);
        expectedRecipient = await getSeller(listingId);
      }

      if (!txDigest) {
        // Return HTTP 402 with payment requirements
        return res.status(402).json({
          error: 'Payment Required',
          requirements: {
            amountMist: expectedPrice,
            token: 'SUI',
            recipient: expectedRecipient,
          }
        });
      }
      
      // Verify the payment on-chain
      const isValid = await verifyPaymentProof(txDigest, expectedPrice, expectedRecipient);
      
      if (!isValid) {
        return res.status(403).json({ error: 'Invalid payment proof. Ensure the recipient and amount match the listing.' });
      }

      // If valid, proceed to the actual route handler
      next();
    } catch (error: any) {
      console.error('[x402] Error in middleware:', error);
      res.status(500).json({ error: 'Internal Server Error during payment verification' });
    }
  };
}
