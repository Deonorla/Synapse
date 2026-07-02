import { useState } from 'react';
import { useSuiClient, useSignPersonalMessage, useCurrentAccount } from '@mysten/dapp-kit';
import { SessionKey, SealClient } from '@mysten/seal';

import { bcs } from '@mysten/bcs';

export function useSeal() {
  const suiClient = useSuiClient();
  const account = useCurrentAccount();
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
  const [sessionKey, setSessionKey] = useState<SessionKey | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  // Initialize the Seal client
  const [sealClient] = useState(() => {
    const coreProxy = new Proxy(suiClient as any, {
      get(target, prop) {
        if (prop === 'getObject') {
          return async (args: any) => {
            const res = await target.getObject({ ...args, id: args.objectId || args.id });
            if (res.error) throw new Error(res.error.code || "Unknown error");
            
            const objId = args.objectId || args.id;
            
            let contentBytes;
            if (objId === '0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75') {
              const idBytes = new Uint8Array(('73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75').match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
              contentBytes = new Uint8Array([
                ...idBytes,
                ...bcs.u64().serialize(1).toBytes(),
                ...bcs.u64().serialize(1).toBytes()
              ]);
            } else if (objId === '0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8') {
              const idBytes = new Uint8Array(('f5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8').match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
              contentBytes = new Uint8Array([
                ...idBytes,
                ...bcs.u64().serialize(1).toBytes(),
                ...bcs.u64().serialize(1).toBytes()
              ]);
            }

            return {
              ...res,
              object: {
                ...(res.data || res.object),
                content: contentBytes
              }
            };
          };
        }
        if (prop === 'getDynamicField') {
          return async (args: any) => {
            const objId = args.parentId;
            let decodedBcs;
            
            if (objId === '0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75') {
              decodedBcs = Uint8Array.from(atob("C215c3Rlbi12MS0xMGh0dHBzOi8vc2VhbC1rZXktc2VydmVyLXRlc3RuZXQtMS5teXN0ZW5sYWJzLmNvbQBgoEC1VIuwQo+6FZiVwHCAy/3HbvAbuIyiztXIWwd4LgmXCh9WhOKg3T0+Mb62y9fqAsSaN5SybG09n/3JnkmEzJgdDXLpM8KvMwkha/cBHp6Cx7aCdogvGLoOp/RadyHb"), c => c.charCodeAt(0));
            } else if (objId === '0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8') {
              decodedBcs = Uint8Array.from(atob("C215c3Rlbi12MS0yMGh0dHBzOi8vc2VhbC1rZXktc2VydmVyLXRlc3RuZXQtMi5teXN0ZW5sYWJzLmNvbQBgqMtvWQJ9FOCj6X6hvXmqapQvNv/INfUCVZHGgNWYpVQfCH+ss5+xKh2dcbOlEJQrF2Dl9mhfhmYKTDixeJKLttA2Kmx+JEmFUngyx4OotRldt0P/IoneOyMiba2GzXDx"), c => c.charCodeAt(0));
            }

            if (!decodedBcs) {
              throw new Error("dynamicFieldNotFound");
            }

            return {
              data: {
                content: {
                  fields: {
                    value: {
                      fields: {
                        name: '', // We don't need this, SDK only reads the bcs field
                      }
                    }
                  }
                }
              },
              dynamicField: {
                value: {
                  bcs: decodedBcs
                }
              }
            };
          };
        }
        return target[prop];
      }
    });

    return new SealClient({
      suiClient: { core: coreProxy } as any,
      serverConfigs: [
        { objectId: '0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75', weight: 1 },
        { objectId: '0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8', weight: 1 }
      ]
    });
  });

  const createSession = async () => {
    if (!account) throw new Error("Wallet not connected");
    setIsInitializing(true);
    try {
      const packageId = (import.meta as any).env.VITE_SEAL_PACKAGE_ID || '0x984960ebddd75c15c6d38355ac462621db0ffc7d6647214c802cd3b685e1af3d';
      
      const newSessionKey = await SessionKey.create({
        address: account.address,
        packageId,
        ttlMin: 15,
        suiClient: suiClient as any,
      });

      // Sign the personal message to prove ownership of the address
      const message = newSessionKey.getPersonalMessage();
      const signatureResponse = await signPersonalMessage({
        message,
        account,
      });
      
      await newSessionKey.setPersonalMessageSignature(signatureResponse.signature);
      
      setSessionKey(newSessionKey);
      setIsInitializing(false);
      return newSessionKey;
    } catch (e) {
      setIsInitializing(false);
      throw e;
    }
  };

  const decryptData = async (encryptedData: Uint8Array, txBytes: Uint8Array) => {
    let currentSessionKey = sessionKey;
    if (!currentSessionKey || currentSessionKey.isExpired()) {
      currentSessionKey = await createSession();
    }

    const decrypted = await sealClient.decrypt({
      data: encryptedData,
      sessionKey: currentSessionKey,
      txBytes,
    });
    
    return new TextDecoder().decode(decrypted);
  };

  const encryptData = async (data: string, policyId: string) => {
    const dataBytes = new TextEncoder().encode(data);
    const packageId = (import.meta as any).env.VITE_SEAL_PACKAGE_ID || '0x984960ebddd75c15c6d38355ac462621db0ffc7d6647214c802cd3b685e1af3d';
    
    const { encryptedObject } = await sealClient.encrypt({
      kemType: 0,
      demType: 1,
      threshold: 1,
      packageId,
      id: policyId,
      data: dataBytes
    });
    
    return new Uint8Array(encryptedObject);
  };

  return { sealClient, sessionKey, createSession, isInitializing, decryptData, encryptData };
}
