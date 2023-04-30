/**
 * The root navigator is used to switch between major navigation flows of your app.
 * Generally speaking, it will contain an auth flow (registration, login, forgot password)
 * and a "main" flow (which is contained in your MainNavigator) which the user
 * will use once logged in.
 *
 * A root stack navigator is often used for displaying modals on top of all other content.
 * https://reactnavigation.org/docs/modal
 */

import { useAuthed } from 'lib/hooks/useAuthed'
import { YStack } from 'tamagui'
import { NavigationContainer } from '@react-navigation/native'
import { AuthNavigator } from './AuthNavigator'
import { MainNavigator } from './MainNavigator'
import { navigationRef } from './navigation-utilities'
import { NavigationProps } from './types'

export const RootNavigator = (props: NavigationProps) => {
  const authed = useAuthed()
  if (authed === null) {
    return <YStack f={1} bg="$black" />
  }
  return (
    <NavigationContainer ref={navigationRef} {...props}>
      {authed ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  )
}