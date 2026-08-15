/**
 * src/lib/whatsapp/embedded-signup.ts
 *
 * Client-side helper for Meta WhatsApp Embedded Signup Flow.
 * Dynamically loads the Facebook JavaScript SDK and triggers FB.login
 * with WhatsApp Business management scopes.
 */

declare global {
  interface Window {
    FB?: {
      init: (options: {
        appId: string;
        autoLogAppEvents?: boolean;
        xfbml?: boolean;
        version: string;
      }) => void;
      login: (
        callback: (response: {
          authResponse?: {
            code?: string;
            accessToken?: string;
            userID?: string;
            expiresIn?: number;
            signedRequest?: string;
          };
          status?: string;
        }) => void,
        options: {
          config_id?: string;
          response_type?: string;
          override_default_response_type?: boolean;
          scope?: string;
          extras?: Record<string, unknown>;
        }
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

let fbSdkLoadingPromise: Promise<void> | null = null;

/**
 * Loads and initializes the Facebook JavaScript SDK.
 */
export function loadFacebookSdk(appId: string): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }

  if (window.FB) {
    return Promise.resolve();
  }

  if (fbSdkLoadingPromise) {
    return fbSdkLoadingPromise;
  }

  fbSdkLoadingPromise = new Promise<void>((resolve, reject) => {
    window.fbAsyncInit = function () {
      if (window.FB) {
        window.FB.init({
          appId,
          autoLogAppEvents: true,
          xfbml: true,
          version: 'v21.0',
        });
        resolve();
      } else {
        reject(new Error('Facebook SDK failed to initialize'));
      }
    };

    const scriptId = 'facebook-jssdk';
    if (document.getElementById(scriptId)) {
      if (window.FB) resolve();
      return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.defer = true;
    script.onerror = () =>
      reject(new Error('Failed to load Facebook SDK script'));
    document.body.appendChild(script);
  });

  return fbSdkLoadingPromise;
}

export interface EmbeddedSignupResult {
  code: string;
  wabaId?: string;
  phoneNumberId?: string;
}

/**
 * Launches the Meta WhatsApp Embedded Signup popup.
 */
export async function launchWhatsAppEmbeddedSignup({
  appId,
  configId,
}: {
  appId: string;
  configId?: string;
}): Promise<EmbeddedSignupResult> {
  await loadFacebookSdk(appId);

  if (!window.FB) {
    throw new Error('Facebook SDK is not available');
  }

  return new Promise<EmbeddedSignupResult>((resolve, reject) => {
    let sessionWabaId: string | undefined;
    let sessionPhoneId: string | undefined;

    // Listen to postMessage events from Meta embedded signup popup
    const messageListener = (event: MessageEvent) => {
      if (
        event.origin.includes('facebook.com') ||
        event.origin.includes('meta.com')
      ) {
        try {
          const data =
            typeof event.data === 'string'
              ? JSON.parse(event.data)
              : event.data;
          if (data?.type === 'WA_EMBEDDED_SIGNUP') {
            if (data.event === 'FINISH') {
              sessionWabaId = data.data?.waba_id || sessionWabaId;
              sessionPhoneId = data.data?.phone_number_id || sessionPhoneId;
            }
          }
        } catch {
          // Ignore non-JSON postMessages
        }
      }
    };

    window.addEventListener('message', messageListener);

    const loginOptions: Parameters<NonNullable<typeof window.FB>['login']>[1] =
      {
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          feature: 'whatsapp_embedded_signup',
          version: 2,
          sessionInfoVersion: 2,
        },
      };

    if (configId && configId.trim()) {
      loginOptions.config_id = configId.trim();
    } else {
      loginOptions.scope =
        'whatsapp_business_management,whatsapp_business_messaging';
    }

    const fb = window.FB;
    if (!fb) {
      window.removeEventListener('message', messageListener);
      reject(new Error('Facebook SDK is not available'));
      return;
    }

    fb.login((response) => {
      window.removeEventListener('message', messageListener);

      if (response?.authResponse?.code) {
        resolve({
          code: response.authResponse.code,
          wabaId: sessionWabaId,
          phoneNumberId: sessionPhoneId,
        });
      } else {
        reject(
          new Error(
            response?.status === 'unknown'
              ? 'Facebook login was cancelled or closed.'
              : 'Failed to authenticate with Facebook.'
          )
        );
      }
    }, loginOptions);
  });
}
