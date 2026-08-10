import type {
  VoiceProvider,
  VoiceProviderName,
} from './voice-provider.interface';
import { ElevenLabsVoiceProvider } from './elevenlabs-provider';
import { SarvamVoiceProvider } from './sarvam-provider';
import { XAiVoiceProvider } from './xai-provider';

export function getVoiceProvider(
  providerName: VoiceProviderName
): VoiceProvider {
  switch (providerName) {
    case 'elevenlabs':
      return new ElevenLabsVoiceProvider();
    case 'sarvam':
      return new SarvamVoiceProvider();
    case 'xai':
      return new XAiVoiceProvider();
  }
}
