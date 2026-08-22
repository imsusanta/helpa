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
        cookie?: boolean;
        autoLogAppEvents?: boolean;
        xfbml?: boolean;
        version: string;
      }) => void;
      AppEvents?: {
        logPageView: () => void;
      };
      getLoginStatus?: (
        callback: (response: {
          authResponse?: {
            accessToken?: string;
            userID?: string;
            expiresIn?: number;
            signedRequest?: string;
          };
          status?: string;
        }) => void,
        roundtrip?: boolean
      ) => void;
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
    try {
      window.FB.init({
        appId,
        cookie: true,
        autoLogAppEvents: true,
        xfbml: true,
        version: 'v21.0',
      });
      window.FB.AppEvents?.logPageView();
    } catch {
      // Ignore
    }
    return Promise.resolve();
  }

  if (fbSdkLoadingPromise) {
    return fbSdkLoadingPromise;
  }

  fbSdkLoadingPromise = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (window.FB) {
        resolve();
      } else {
        fbSdkLoadingPromise = null;
        reject(
          new Error(
            'Facebook SDK load timed out. Please check your internet connection or disable ad/tracker blockers.'
          )
        );
      }
    }, 15000);

    window.fbAsyncInit = function () {
      clearTimeout(timeout);
      if (window.FB) {
        try {
          window.FB.init({
            appId,
            cookie: true,
            autoLogAppEvents: true,
            xfbml: true,
            version: 'v21.0',
          });
          window.FB.AppEvents?.logPageView();
          resolve();
        } catch (initErr) {
          fbSdkLoadingPromise = null;
          reject(
            new Error(
              `Facebook SDK init failed: ${initErr instanceof Error ? initErr.message : 'Unknown'}`
            )
          );
        }
      } else {
        fbSdkLoadingPromise = null;
        reject(new Error('Facebook SDK failed to initialize'));
      }
    };

    const scriptId = 'facebook-jssdk';
    const existing = document.getElementById(scriptId);
    if (existing) {
      if (window.FB) {
        clearTimeout(timeout);
        resolve();
      }
      return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';

    script.onload = () => {
      if (window.FB) {
        clearTimeout(timeout);
        try {
          window.FB.init({
            appId,
            cookie: true,
            autoLogAppEvents: true,
            xfbml: true,
            version: 'v21.0',
          });
          window.FB.AppEvents?.logPageView();
          resolve();
        } catch {
          resolve();
        }
      }
    };

    script.onerror = () => {
      clearTimeout(timeout);
      fbSdkLoadingPromise = null;
      reject(
        new Error(
          'Failed to load Facebook SDK script. If you are using an ad-blocker (uBlock, Brave Shields, Privacy Badger), please pause it for this domain.'
        )
      );
    };

    const firstScript = document.getElementsByTagName('script')[0];
    if (firstScript && firstScript.parentNode) {
      firstScript.parentNode.insertBefore(script, firstScript);
    } else {
      document.head.appendChild(script);
    }
  });

  return fbSdkLoadingPromise;
}

export interface LaunchWhatsAppEmbeddedSignupOptions {
  appId: string;
  configId?: string;
  mode?: 'standard' | 'coexistence';
}

export interface EmbeddedSignupResult {
  code?: string;
  accessToken?: string;
  wabaId?: string;
  phoneNumberId?: string;
  mode?: 'standard' | 'coexistence';
  sessionInfo?: Record<string, unknown>;
}

/**
 * Launches the Meta WhatsApp Embedded Signup popup.
 * Supports both standard new number onboarding and existing business coexistence.
 */
export async function launchWhatsAppEmbeddedSignup({
  appId,
  configId,
  mode = 'standard',
}: LaunchWhatsAppEmbeddedSignupOptions): Promise<EmbeddedSignupResult> {
  await loadFacebookSdk(appId);

  if (!window.FB) {
    throw new Error('Facebook SDK is not available');
  }

  return new Promise<EmbeddedSignupResult>((resolve, reject) => {
    let sessionWabaId: string | undefined;
    let sessionPhoneId: string | undefined;
    let sessionRawData: Record<string, unknown> | undefined;

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
            sessionRawData = data.data || sessionRawData;
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

    window.addEventListener?.('message', messageListener);

    const loginOptions: Parameters<NonNullable<typeof window.FB>['login']>[1] =
      {
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          feature: 'whatsapp_embedded_signup',
          featureType:
            mode === 'coexistence'
              ? 'whatsapp_business_app_onboarding'
              : 'whatsapp_embedded_signup',
          version: 'v4',
          sessionInfoVersion: 3,
          setup:
            mode === 'coexistence'
              ? { solution: 'coexistence', phone_flow: 'coexistence' }
              : {},
        },
      };

    if (configId && configId.trim()) {
      loginOptions.config_id = configId.trim();
    } else {
      loginOptions.scope =
        'whatsapp_business_management,whatsapp_business_messaging,public_profile';
    }

    const fb = window.FB;
    if (!fb) {
      window.removeEventListener?.('message', messageListener);
      reject(new Error('Facebook SDK is not available'));
      return;
    }

    fb.login((response) => {
      window.removeEventListener?.('message', messageListener);

      if (response?.authResponse?.code || response?.authResponse?.accessToken) {
        resolve({
          code: response.authResponse.code,
          accessToken: response.authResponse.accessToken,
          wabaId: sessionWabaId,
          phoneNumberId: sessionPhoneId,
          mode,
          sessionInfo: sessionRawData,
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

/**
 * Checks current Facebook login status using FB.getLoginStatus.
 */
export async function getFacebookLoginStatus(appId: string): Promise<{
  status?: string;
  authResponse?: {
    accessToken?: string;
    userID?: string;
    expiresIn?: number;
    signedRequest?: string;
  };
}> {
  await loadFacebookSdk(appId);
  return new Promise((resolve) => {
    if (!window.FB || !window.FB.getLoginStatus) {
      resolve({ status: 'unknown' });
      return;
    }
    window.FB.getLoginStatus((response) => {
      resolve(response);
    });
  });
}
