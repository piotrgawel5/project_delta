import { registerWebModule, NativeModule } from 'expo';

import { ChangeEventPayload } from './CredentialAuthModule.types';

type GoogleOneTapUiModuleEvents = {
  onChange: (params: ChangeEventPayload) => void;
};

class GoogleOneTapUiModule extends NativeModule<GoogleOneTapUiModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
}

export default registerWebModule(GoogleOneTapUiModule, 'GoogleOneTapUiModule');
