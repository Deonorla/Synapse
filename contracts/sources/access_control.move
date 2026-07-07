module synapse::access_control {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;

    /// Capability granting decryption rights to compliance operators
    /// or platform admins. Used for platform-level management, not
    /// individual marketplace purchases (which use PurchaseReceipt).
    public struct OperatorCap has key, store {
        id: UID,
    }

    /// Admin capability for the access control module
    public struct AdminCap has key, store {
        id: UID,
    }

    /// Initialize the module and grant AdminCap to the deployer
    fun init(ctx: &mut TxContext) {
        let admin_cap = AdminCap {
            id: object::new(ctx),
        };
        transfer::public_transfer(admin_cap, tx_context::sender(ctx));
    }

    /// Mint an operator capability. Gated by AdminCap.
    public fun mint_operator_cap(
        _admin: &AdminCap,
        recipient: address,
        ctx: &mut TxContext
    ) {
        let cap = OperatorCap {
            id: object::new(ctx),
        };
        transfer::public_transfer(cap, recipient);
    }
}
