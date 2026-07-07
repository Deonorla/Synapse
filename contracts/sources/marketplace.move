/// Marketplace module for Synapse: the on-chain knowledge economy.
///
/// Sellers list encrypted datasets with metadata and pricing.
/// Buyers purchase access by paying SUI, receiving a soulbound PurchaseReceipt.
/// Seal threshold servers validate decryption by dry-running `seal_approve_purchase`,
/// which succeeds only if the caller owns a valid PurchaseReceipt for the listing.
module synapse::marketplace {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::clock::{Self, Clock};
    use sui::event;
    use std::string::String;

    // =========================================================================
    // Error Constants
    // =========================================================================
    const EInsufficientPayment: u64 = 0;
    const EListingNotActive: u64 = 1;
    const ENotListingOwner: u64 = 2;
    const EReceiptMismatch: u64 = 3;

    // =========================================================================
    // Core Types
    // =========================================================================

    /// A dataset listed for sale on the marketplace.
    /// Shared object so any agent can read its metadata and purchase.
    public struct DatasetListing has key, store {
        id: UID,
        /// Seller's address
        owner: address,
        /// Human-readable title
        title: String,
        /// Description of what the dataset contains
        description: String,
        /// Price in MIST (1 SUI = 1_000_000_000 MIST)
        price_mist: u64,
        /// Walrus blob IDs containing the encrypted data chunks
        blob_ids: vector<vector<u8>>,
        /// Number of chunks in the dataset
        chunk_count: u64,
        /// Seal encryption policy ID used to encrypt the data
        seal_policy_id: vector<u8>,
        /// Whether the listing is currently active
        is_active: bool,
        /// Timestamp when the listing was created
        created_at: u64,
    }

    /// Proof that an agent has purchased a specific dataset.
    /// Soulbound (no `store` ability) — cannot be transferred or traded.
    /// The Seal threshold servers check for this during dry-run to release keys.
    public struct PurchaseReceipt has key {
        id: UID,
        /// The ID of the DatasetListing that was purchased
        listing_id: ID,
        /// The buyer's address
        buyer: address,
        /// Timestamp of purchase
        purchased_at: u64,
    }

    /// Admin capability for marketplace governance
    public struct MarketplaceAdminCap has key, store {
        id: UID,
    }

    // =========================================================================
    // Events
    // =========================================================================

    public struct DatasetListed has copy, drop {
        listing_id: ID,
        owner: address,
        title: String,
        price_mist: u64,
        chunk_count: u64,
    }

    public struct DatasetPurchased has copy, drop {
        listing_id: ID,
        buyer: address,
        price_paid: u64,
    }

    public struct DatasetDelisted has copy, drop {
        listing_id: ID,
        owner: address,
    }

    // =========================================================================
    // Initialization
    // =========================================================================

    fun init(ctx: &mut TxContext) {
        let admin_cap = MarketplaceAdminCap {
            id: object::new(ctx),
        };
        transfer::public_transfer(admin_cap, tx_context::sender(ctx));
    }

    // =========================================================================
    // Seller Functions
    // =========================================================================

    /// Create a new dataset listing on the marketplace.
    /// The listing is shared so any potential buyer can view and purchase it.
    public fun list_dataset(
        title: String,
        description: String,
        price_mist: u64,
        blob_ids: vector<vector<u8>>,
        chunk_count: u64,
        seal_policy_id: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let listing = DatasetListing {
            id: object::new(ctx),
            owner: tx_context::sender(ctx),
            title,
            description,
            price_mist,
            blob_ids,
            chunk_count,
            seal_policy_id,
            is_active: true,
            created_at: clock::timestamp_ms(clock),
        };

        event::emit(DatasetListed {
            listing_id: object::id(&listing),
            owner: tx_context::sender(ctx),
            title: listing.title,
            price_mist,
            chunk_count,
        });

        transfer::public_share_object(listing);
    }

    /// Delist a dataset (seller only). Marks inactive but does not delete
    /// so existing PurchaseReceipts remain valid for already-purchased data.
    public fun delist_dataset(
        listing: &mut DatasetListing,
        ctx: &mut TxContext,
    ) {
        assert!(listing.owner == tx_context::sender(ctx), ENotListingOwner);
        listing.is_active = false;

        event::emit(DatasetDelisted {
            listing_id: object::id(listing),
            owner: listing.owner,
        });
    }

    // =========================================================================
    // Buyer Functions
    // =========================================================================

    /// Purchase access to a dataset. Pays the seller directly in SUI.
    /// Mints a soulbound PurchaseReceipt to the buyer.
    public fun purchase_dataset(
        listing: &DatasetListing,
        payment: Coin<SUI>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(listing.is_active, EListingNotActive);
        assert!(coin::value(&payment) >= listing.price_mist, EInsufficientPayment);

        // Transfer payment directly to the seller
        transfer::public_transfer(payment, listing.owner);

        // Mint soulbound receipt for the buyer
        let receipt = PurchaseReceipt {
            id: object::new(ctx),
            listing_id: object::id(listing),
            buyer: tx_context::sender(ctx),
            purchased_at: clock::timestamp_ms(clock),
        };

        event::emit(DatasetPurchased {
            listing_id: object::id(listing),
            buyer: tx_context::sender(ctx),
            price_paid: listing.price_mist,
        });

        // Soulbound: use transfer::transfer (not public_transfer) because
        // PurchaseReceipt lacks the `store` ability.
        transfer::transfer(receipt, tx_context::sender(ctx));
    }

    // =========================================================================
    // Seal Decryption Policy
    // =========================================================================

    /// The Seal threshold key servers call this via `dry_run_transaction_block`.
    /// If this function executes without aborting, Seal releases decryption keys.
    ///
    /// It succeeds only if:
    /// 1. The caller owns a valid PurchaseReceipt (enforced by Sui object resolution)
    /// 2. The receipt's listing_id matches the listing being decrypted
    ///
    /// The `_id` parameter is the encryption ID (required by Seal's standard signature).
    public fun seal_approve_purchase(
        _id: vector<u8>,
        listing: &DatasetListing,
        receipt: &PurchaseReceipt,
        _ctx: &TxContext,
    ) {
        // Verify the receipt is for this specific listing
        assert!(receipt.listing_id == object::id(listing), EReceiptMismatch);
        // If we reach here without aborting, the caller proved:
        // 1. They own the PurchaseReceipt (Sui runtime enforces this)
        // 2. The receipt matches the listing they're trying to decrypt
        // Seal servers will release the threshold key shares.
    }

    // =========================================================================
    // View Functions (for off-chain queries)
    // =========================================================================

    public fun get_price(listing: &DatasetListing): u64 {
        listing.price_mist
    }

    public fun get_owner(listing: &DatasetListing): address {
        listing.owner
    }

    public fun is_active(listing: &DatasetListing): bool {
        listing.is_active
    }

    public fun get_blob_ids(listing: &DatasetListing): &vector<vector<u8>> {
        &listing.blob_ids
    }

    public fun get_chunk_count(listing: &DatasetListing): u64 {
        listing.chunk_count
    }

    public fun get_receipt_listing_id(receipt: &PurchaseReceipt): ID {
        receipt.listing_id
    }

    public fun get_receipt_buyer(receipt: &PurchaseReceipt): address {
        receipt.buyer
    }
}
