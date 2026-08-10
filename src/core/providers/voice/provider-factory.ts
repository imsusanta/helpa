import { VoicePlatformProvider } from './voice-provider.interface';
import { SarvamVoiceProvider } from './sarvam-provider';
import { XAiVoiceProvider } from './xai-provider';
import { ElevenLabsVoiceProvider } from './elevenlabs-provider';

export function getVoiceProvider(
  providerName: 'sarvam' | 'xai' | 'elevenlabs'
): VoicePlatformProvider {
  switch (providerName) {
    case 'sarvam':
      return new SarvamVoiceProvider();
    case 'xai':
      return new XAiVoiceProvider();
    case 'elevenlabs':
      return new ElevenLabsVoiceProvider();
    default:
      return new SarvamVoiceProvider();
  }
}
