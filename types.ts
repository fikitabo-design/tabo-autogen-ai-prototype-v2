
export type AssetType = 'Photo' | 'Vector' | 'Video';

export type Platform = 'Shutterstock' | 'Adobe Stock' | 'Dreamstime' | 'Teepublic';

export type ExportFormat = 'Simple CSV' | 'Contributor-specific CSV';

export interface Metadata {
  title: string;
  description: string;
  keywords: string;
  mainTag?: string; // Specific for Teepublic
  category1?: string; // Specific for Shutterstock
  category2?: string; // Specific for Shutterstock
}

export type AssetStatus = 'idle' | 'pending' | 'success' | 'error' | 'editing';

export interface Asset {
  id: string;
  file: File;
  name: string;
  type: AssetType;
  status: AssetStatus;
  metadata: Metadata;
  error?: string;
  previewUrl?: string;
}
