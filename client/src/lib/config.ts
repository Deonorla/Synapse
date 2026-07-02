export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:3002';

export const SUI_NETWORK = 'testnet' as const;

export const SYNAPSE_PACKAGE_ID =
  import.meta.env.VITE_SYNAPSE_PACKAGE_ID ||
  '0x0982401c235bbbf32b99e420f365eb7df0264c3f4ee7785978cd7d58a571e62b';

export const SEAL_PACKAGE_ID =
  import.meta.env.VITE_SEAL_PACKAGE_ID ||
  '0x984960ebddd75c15c6d38355ac462621db0ffc7d6647214c802cd3b685e1af3d';

export const CLOCK_OBJECT_ID = '0x6';

export const MIST_PER_SUI = 1_000_000_000;
