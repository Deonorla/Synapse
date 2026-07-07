/// Synapse Decentralized Data Marketplace
/// 
/// This module implements on-chain dataset listing, purchasing, and delisting.
/// Sellers list encrypted datasets with metadata; buyers pay SUI to receive
/// a soulbound PurchaseReceipt proving they bought access.
module synapse_marketplace::marketplace {
    use sui::clock::Clock;
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::event;

    // ─── Error codes ─────────────────────────────────────────────────────
    const EInsufficientPayment: u64 = 0;
    const EListingNotActive: u64 = 1;
    const ENotOwner: u64 = 2;

    // ─── Structs ─────────────────────────────────────────────────────────

    /// A listed dataset on the marketplace.
    public struct DatasetListing has key, store {
        id: UID,
        owner: address,
        title: vector<u8>,
        description: vector<u8>,
        price_mist: u64,
        blob_ids: vector<vector<u8>>,
        chunk_count: u64,
        seal_policy_id: vector<u8>,
        is_active: bool,
        created_at: u64,
    }

    /// Soulbound receipt proving a buyer purchased a dataset.
    public struct PurchaseReceipt has key {
        id: UID,
        listing_id: address,
        buyer: address,
        purchased_at: u64,
    }

    // ─── Events ──────────────────────────────────────────────────────────

    public struct DatasetListed has copy, drop {
        listing_id: address,
        owner: address,
        title: vector<u8>,
        price_mist: u64,
    }

    public struct DatasetPurchased has copy, drop {
        listing_id: address,
        buyer: address,
        price_mist: u64,
        receipt_id: address,
    }

    public struct DatasetDelisted has copy, drop {
        listing_id: address,
        owner: address,
    }

    // ─── Entry functions ─────────────────────────────────────────────────

    /// List a new encrypted dataset on the marketplace.
    entry fun list_dataset(
        title: vector<u8>,
        description: vector<u8>,
        price_mist: u64,
        blob_ids: vector<vector<u8>>,
        chunk_count: u64,
        seal_policy_id: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let listing = DatasetListing {
            id: object::new(ctx),
            owner: ctx.sender(),
            title,
            description,
            price_mist,
            blob_ids,
            chunk_count,
            seal_policy_id,
            is_active: true,
            created_at: clock.timestamp_ms(),
        };

        let listing_id = object::uid_to_address(&listing.id);

        event::emit(DatasetListed {
            listing_id,
            owner: ctx.sender(),
            title: listing.title,
            price_mist,
        });

        transfer::share_object(listing);
    }

    /// Purchase a dataset by sending the required SUI payment.
    /// Creates a soulbound PurchaseReceipt for the buyer.
    entry fun purchase_dataset(
        listing: &mut DatasetListing,
        payment: Coin<SUI>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(listing.is_active, EListingNotActive);
        assert!(coin::value(&payment) >= listing.price_mist, EInsufficientPayment);

        // Transfer payment to the seller
        transfer::public_transfer(payment, listing.owner);

        // Create soulbound receipt
        let receipt = PurchaseReceipt {
            id: object::new(ctx),
            listing_id: object::uid_to_address(&listing.id),
            buyer: ctx.sender(),
            purchased_at: clock.timestamp_ms(),
        };

        let receipt_id = object::uid_to_address(&receipt.id);

        event::emit(DatasetPurchased {
            listing_id: object::uid_to_address(&listing.id),
            buyer: ctx.sender(),
            price_mist: listing.price_mist,
            receipt_id,
        });

        transfer::transfer(receipt, ctx.sender());
    }

    /// Delist a dataset (only the owner can do this).
    entry fun delist_dataset(
        listing: &mut DatasetListing,
        ctx: &mut TxContext,
    ) {
        assert!(listing.owner == ctx.sender(), ENotOwner);
        listing.is_active = false;

        event::emit(DatasetDelisted {
            listing_id: object::uid_to_address(&listing.id),
            owner: ctx.sender(),
        });
    }
}
