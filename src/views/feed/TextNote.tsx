import { useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { AuthedStackParams } from 'app/navigation/AuthedNavigator'
import { Note } from 'app/stores/eventTypes'
import { useUserMetadata } from 'lib/hooks'
import {
  generateRandomPlacekitten,
  timeAgoSince,
  truncateString,
} from 'lib/utils'
import { useMemo } from 'react'
import { Avatar, Paragraph, XStack, YStack } from 'tamagui'

export const TextNote = (props: { data: Note }) => {
  const data = props.data
  const time = timeAgoSince(new Date(data.created_at * 1000))
  const metadata = useUserMetadata(data.pubkey)
  const name =
    (metadata?.display_name ?? metadata?.name) || truncateString(data.pubkey, 8)
  const username = `${metadata?.name}` || ''
  const picture = useMemo(
    () => metadata?.picture || generateRandomPlacekitten(),
    [metadata]
  )
  const { navigate } =
    useNavigation<NativeStackNavigationProp<AuthedStackParams>>()
  return (
    <XStack
      mt="$5"
      space="$3"
      borderRadius="$2"
      width="85%"
      px="$2"
      onPress={() => console.log(data)}
    >
      <Avatar
        size="$3"
        circular
        mt="$2"
        onPress={() => navigate('profile', { pubkey: data.pubkey })}
        pressStyle={{ opacity: 0.8 }}
      >
        <Avatar.Image src={picture} />
      </Avatar>
      <YStack space="$1">
        <XStack space="$2">
          <Paragraph size="$3" fontWeight="700">
            {name}
          </Paragraph>
          <Paragraph size="$2" color="$color8" mt={1}>
            {username}
          </Paragraph>
          <Paragraph size="$2" color="$color8" ml={-2} mt={1}>
            • {time}
          </Paragraph>
        </XStack>
        <Paragraph size="$2" color="$color12">
          {data.content}
        </Paragraph>
      </YStack>
    </XStack>
  )
}