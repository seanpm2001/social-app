import React from 'react'
import * as Notifications from 'expo-notifications'
import {getBadgeCountAsync, setBadgeCountAsync} from 'expo-notifications'
import {BskyAgent} from '@atproto/api'

import {logger} from '#/logger'
import {SessionAccount, useAgent, useSession} from '#/state/session'
import {logEvent, useGate} from 'lib/statsig/statsig'
import {devicePlatform, isNative} from 'platform/detection'
import BackgroundNotificationHandler from '../../../modules/expo-background-notification-handler'

const SERVICE_DID = (serviceUrl?: string) =>
  serviceUrl?.includes('staging')
    ? 'did:web:api.staging.bsky.dev'
    : 'did:web:api.bsky.app'

async function registerPushToken(
  getAgent: () => BskyAgent,
  account: SessionAccount,
  token: Notifications.DevicePushToken,
) {
  try {
    await getAgent().api.app.bsky.notification.registerPush({
      serviceDid: SERVICE_DID(account.service),
      platform: devicePlatform,
      token: token.data,
      appId: 'xyz.blueskyweb.app',
    })
    logger.debug(
      'Notifications: Sent push token (init)',
      {
        tokenType: token.type,
        token: token.data,
      },
      logger.DebugContext.notifications,
    )
  } catch (error) {
    logger.error('Notifications: Failed to set push token', {message: error})
  }
}

async function getPushToken(skipPermissionCheck = false) {
  const granted =
    skipPermissionCheck || (await Notifications.getPermissionsAsync()).granted
  if (granted) {
    Notifications.getDevicePushTokenAsync()
  }
}

export function useNotificationsRegistration() {
  const {getAgent} = useAgent()
  const {currentAccount} = useSession()

  React.useEffect(() => {
    if (!currentAccount) {
      return
    }

    getPushToken()

    // According to the Expo docs, there is a chance that the token will change while the app is open in some rare
    // cases. This will fire `registerPushToken` whenever that happens.
    const subscription = Notifications.addPushTokenListener(async newToken => {
      registerPushToken(getAgent, currentAccount, newToken)
    })

    return () => {
      subscription.remove()
    }
  }, [currentAccount, getAgent])
}

export function useRequestNotificationsPermission() {
  const gate = useGate()
  const {currentAccount} = useSession()

  return React.useCallback(
    async (context: 'StartOnboarding' | 'AfterOnboarding' | 'Login') => {
      const permissions = await Notifications.getPermissionsAsync()

      if (
        !currentAccount ||
        !isNative ||
        permissions?.status === 'granted' ||
        (permissions?.status === 'denied' && !permissions?.canAskAgain)
      ) {
        return
      }
      if (
        context === 'StartOnboarding' &&
        gate('request_notifications_permission_after_onboarding')
      ) {
        return
      }
      if (
        context === 'AfterOnboarding' &&
        !gate('request_notifications_permission_after_onboarding')
      ) {
        return
      }

      const res = await Notifications.requestPermissionsAsync()
      logEvent('notifications:request', {
        context: context,
        status: res.status,
      })

      if (res.granted) {
        // This will fire a pushTokenEvent, which will handle registration of the token
        getPushToken(true)
      }
    },
    [gate, currentAccount],
  )
}

export async function decrementBadgeCount(by: number | 'reset' = 1) {
  if (!isNative) return

  let count = await getBadgeCountAsync()

  if (by === 'reset') {
    count = 0
  } else {
    count -= by
    if (count < 0) {
      count = 0
    }
  }

  await BackgroundNotificationHandler.setBadgeCountAsync(count)
  await setBadgeCountAsync(count)
}
