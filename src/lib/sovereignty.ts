export interface SovereigntyRecord {
  dataOwner: string;
  protocolOwner: string;
  assetOwner: string;
  trainingGranted: boolean;
  userKeepsData: boolean;
  protocolLearnsFromInput: boolean;
  directBlockchainAccess: boolean;
}

export function createSovereigntyRecord(params?: {
  dataOwner?: string;
  protocolOwner?: string;
  trainingGranted?: boolean;
}): SovereigntyRecord {
  const dataOwner = params?.dataOwner || "ECMcCready";
  return {
    dataOwner,
    protocolOwner: params?.protocolOwner || "ECMcCready",
    assetOwner: dataOwner,
    trainingGranted: params?.trainingGranted ?? true,
    userKeepsData: true,
    protocolLearnsFromInput: params?.trainingGranted ?? true,
    directBlockchainAccess: false,
  };
}