import { RouteProp, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useEffect } from 'react'
import { ActivityIndicator } from 'react-native'
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view'
import { Channel } from 'stores/eventTypes'
import { Screen } from 'views/shared'

import { MessageInput } from './MessageInput'
import { MessageList } from './MessageList'
import { useUserMetadataForChannel } from './useUserMetadataForChannel'

type ChannelScreenProps = {
  navigation: NativeStackNavigationProp<StackNavigatorParams, 'channel'>
  route: RouteProp<StackNavigatorParams, 'channel'>
}

export const ChannelScreen = ({ navigation, route }: ChannelScreenProps) => {
  const { channel } = route.params
  const { setOptions } = useNavigation()

  useUserMetadataForChannel(channel?.id ?? '')

  useEffect(() => {
    setOptions({ title: channel?.name ?? 'Unnamed Channel' })
  }, [channel])

  if (!channel)
    return (
      <Screen>
        <ActivityIndicator />
      </Screen>
    )
  return (
    <Screen>
      <MessageList channelId={channel.id} />
      <MessageInput channelId={channel.id} />
    </Screen>
  )
}

export type StackNavigatorParams = {
  home: undefined
  create: undefined
  login: undefined
  channel: { channel: Channel }
}