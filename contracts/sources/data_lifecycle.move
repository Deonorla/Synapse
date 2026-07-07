module synapse::data_lifecycle {
    use sui::object::{Self, UID};
    use sui::tx_context::TxContext;
    use sui::clock::{Self, Clock};
    use sui::transfer;
    use sui::event;

    /// Represents an encrypted AI memory blob stored on Walrus
    /// and managed by the Synapse Move contracts.
    public struct ManagedBlob has key, store {
        id: UID,
        blob_id: vector<u8>,
        agent_id: address,
        created_at: u64,
        expires_at: u64,
    }

    // =========================================================================
    // Events
    // =========================================================================

    public struct BlobRegistered has copy, drop {
        managed_blob_id: sui::object::ID,
        blob_id: vector<u8>,
        agent_id: address,
        expires_at: u64,
    }

    public struct BlobExtended has copy, drop {
        managed_blob_id: sui::object::ID,
        new_expires_at: u64,
    }

    public struct BlobPruned has copy, drop {
        managed_blob_id: sui::object::ID,
    }

    /// Register a new Walrus blob for lifecycle management
    public fun register_blob(
        blob_id: vector<u8>,
        duration_ms: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let current_time = clock::timestamp_ms(clock);
        let managed_blob = ManagedBlob {
            id: object::new(ctx),
            blob_id,
            agent_id: sui::tx_context::sender(ctx),
            created_at: current_time,
            expires_at: current_time + duration_ms,
        };

        event::emit(BlobRegistered {
            managed_blob_id: object::id(&managed_blob),
            blob_id,
            agent_id: managed_blob.agent_id,
            expires_at: managed_blob.expires_at,
        });

        // The blob is shared so operators and agents can interact with it
        transfer::public_share_object(managed_blob);
    }

    /// Extend the lifetime of a managed blob
    public fun extend_lifetime(
        blob: &mut ManagedBlob,
        additional_duration_ms: u64,
        _ctx: &mut TxContext
    ) {
        blob.expires_at = blob.expires_at + additional_duration_ms;

        event::emit(BlobExtended {
            managed_blob_id: object::id(blob),
            new_expires_at: blob.expires_at,
        });
    }

    public fun prune_expired(
        blob: ManagedBlob,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        assert!(clock::timestamp_ms(clock) > blob.expires_at, 0); // ENotExpired
        
        event::emit(BlobPruned {
            managed_blob_id: object::id(&blob),
        });

        let ManagedBlob { id, blob_id: _, agent_id: _, created_at: _, expires_at: _ } = blob;
        object::delete(id);
    }

    // =========================================================================
    // Seal Decryption Policy for Operators
    // =========================================================================

    /// The Seal threshold key servers call this via `dry_run_transaction_block`.
    /// If this function executes without aborting, Seal releases decryption keys
    /// for the agent's secure memory blobs.
    ///
    /// It succeeds only if the caller owns a valid OperatorCap.
    /// The `_id` parameter is the encryption ID (required by Seal's standard signature).
    public fun seal_approve_operator_access(
        _id: vector<u8>,
        _operator_cap: &synapse::access_control::OperatorCap,
        _ctx: &TxContext,
    ) {
        // If we reach here without aborting, the caller proved they own an OperatorCap.
        // Seal servers will release the threshold key shares.
    }
}
