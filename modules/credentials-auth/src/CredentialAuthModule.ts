import { NativeModule, requireNativeModule } from 'expo';

import { CredentialAuthModuleEvents } from './CredentialAuthModule.types';

declare class CredentialAuthModule extends NativeModule<CredentialAuthModuleEvents> {
  PI: number;
  hello(): string;
  setValueAsync(value: string): Promise<void>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<CredentialAuthModule>('CredentialAuth');
